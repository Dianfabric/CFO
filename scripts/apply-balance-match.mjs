// 엑셀 잔액에 DB 잔액 일치시키기
// - 차액 > 0 : 매출(SALE) 추가
// - 차액 < 0 : 입금(ArPayment) 추가
// 모든 변경은 백업 JSON 에 기록 → rollback-balance-match.mjs 로 복구 가능

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const DRY = process.argv.includes('--dry')
const TODAY = '2026-06-04'
const TODAY_DATE = new Date(`${TODAY}T12:00:00`)
const BACKUP_DIR = 'D:/CFO/scripts/backup'
const BACKUP_FILE = `${BACKUP_DIR}/balance-match-${TODAY}.json`

function normName(name) {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
}

// 엑셀 잔액
const wb = XLSX.read(readFileSync('D:/Dropbox/거래처별 현재 미수금 현황.xls'), { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
const excelMap = new Map()
for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const name = String(r[0] ?? '').trim()
  if (!name) continue
  const balance = parseFloat(String(r[7] ?? 0).replace(/,/g, '')) || 0
  excelMap.set(normName(name), { name, balance })
}

// DB 잔액 거래처별 계산
const ars = await prisma.accountsReceivable.findMany({
  include: {
    client: { select: { id: true, name: true } },
    payments: { select: { amount: true } },
  },
})
const dbMap = new Map()
for (const ar of ars) {
  const cid = ar.clientId
  if (!dbMap.has(cid)) dbMap.set(cid, { clientId: cid, name: ar.client.name, totalOrig: 0, totalPaid: 0 })
  const e = dbMap.get(cid)
  e.totalOrig += ar.originalAmount
  e.totalPaid += ar.payments.reduce((s, p) => s + p.amount, 0)
}

// 보정 대상 결정 (차액 != 0인 거래처)
const targets = []
for (const [, db] of dbMap) {
  const dbBal = db.totalOrig - db.totalPaid
  const excel = excelMap.get(normName(db.name))
  const exBal = excel ? excel.balance : 0
  const diff = exBal - dbBal
  if (diff !== 0) targets.push({ ...db, dbBal, exBal, diff })
}

console.log(`보정 대상 거래처: ${targets.length}곳`)
const totalPosDiff = targets.filter(t => t.diff > 0).reduce((s, t) => s + t.diff, 0)
const totalNegDiff = targets.filter(t => t.diff < 0).reduce((s, t) => s + t.diff, 0)
console.log(`매출 추가 합계: ₩${totalPosDiff.toLocaleString()}`)
console.log(`입금 추가 합계: ₩${(-totalNegDiff).toLocaleString()}`)

if (DRY) {
  console.log('\nDRY-RUN — 실제 적용은: node scripts/apply-balance-match.mjs')
  await prisma.$disconnect()
  process.exit(0)
}

// === 실제 적용 ===
const backup = {
  appliedAt: new Date().toISOString(),
  today: TODAY,
  createdTransactionIds: [],
  createdReceivableIds: [],
  createdPaymentIds: [],
  arBalanceSnapshot: [], // {id, remainingAmount, status} — 이전 상태
}

// AR 잔액 스냅샷 (모든 AR)
for (const ar of ars) {
  backup.arBalanceSnapshot.push({
    id: ar.id,
    remainingAmount: ar.remainingAmount,
    status: ar.status,
  })
}

let countSale = 0, countPay = 0
for (const t of targets) {
  if (t.diff > 0) {
    // 매출 추가
    const tx = await prisma.transaction.create({
      data: {
        date: TODAY_DATE,
        type: 'SALE',
        clientId: t.clientId,
        description: `이월 매출 보정 - ${t.name}`,
        totalAmount: t.diff,
        taxAmount: 0,
        paymentMethod: 'CREDIT',
        paymentStatus: 'UNPAID',
        channel: 'B2B',
      },
    })
    backup.createdTransactionIds.push(tx.id)
    const newAr = await prisma.accountsReceivable.create({
      data: {
        clientId: t.clientId,
        transactionId: tx.id,
        originalAmount: t.diff,
        remainingAmount: t.diff,
        status: 'OUTSTANDING',
        notes: `[보정] ${TODAY} 엑셀 잔액 일치`,
      },
    })
    backup.createdReceivableIds.push(newAr.id)
    countSale++
  } else {
    // 입금 추가 (가장 오래된 AR에 묶음)
    const targetAr = await prisma.accountsReceivable.findFirst({
      where: { clientId: t.clientId },
      orderBy: { createdAt: 'asc' },
    })
    if (!targetAr) { console.warn(`  ! AR 없어서 skip: ${t.name}`); continue }
    const pay = await prisma.arPayment.create({
      data: {
        receivableId: targetAr.id,
        amount: Math.abs(t.diff),
        paymentDate: TODAY_DATE,
        paymentMethod: '입금',
        notes: `[수동 보정] ${TODAY} 엑셀 잔액 일치`,
      },
    })
    backup.createdPaymentIds.push(pay.id)
    countPay++
  }
}
console.log(`\n매출 생성: ${countSale}건 / 입금 생성: ${countPay}건`)

// AR 잔액 재계산 (전체 거래처)
const allArs = await prisma.accountsReceivable.findMany({
  include: { payments: { select: { amount: true } } },
})
let recalc = 0
for (const ar of allArs) {
  const paid = ar.payments.reduce((s, p) => s + p.amount, 0)
  const rem = Math.max(0, ar.originalAmount - paid)
  const status = rem === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OUTSTANDING'
  if (rem !== ar.remainingAmount || status !== ar.status) {
    await prisma.accountsReceivable.update({
      where: { id: ar.id },
      data: { remainingAmount: rem, status },
    })
    recalc++
  }
}
console.log(`AR 잔액 재계산: ${recalc}건 갱신`)

// 백업 저장
if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2), 'utf8')
console.log(`\n백업 저장: ${BACKUP_FILE}`)
console.log(`롤백: node scripts/rollback-balance-match.mjs ${BACKUP_FILE}`)

await prisma.$disconnect()
