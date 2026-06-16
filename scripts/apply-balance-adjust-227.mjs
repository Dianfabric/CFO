// 거래처잔액.xls → DB 잔액 보정 적용 (2/27자, 매입 제외 40개)
import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const prisma = new PrismaClient()

const FILE = 'D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/거래처잔액.xls'
const ADJUST_DATE = new Date('2026-02-27T12:00:00')

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = parseFloat(String(v).replace(/,/g, '').trim())
  return isNaN(n) ? 0 : n
}
function normalize(name) {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s\-_·.&/]/g, '')
    .trim()
    .toUpperCase()
}

// 카테고리 (매입 제외)
const EXCLUDED_RANGES = [
  [153, 164],  // 6.? (매입 의심)
  [165, 203],  // 7.공장 (매입)
]
const isExcluded = (idx) => EXCLUDED_RANGES.some(([s, e]) => idx >= s && idx < e)

// 파일 파싱
const wb = XLSX.read(readFileSync(FILE), { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
const fileClients = []
for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const name = String(r[0] ?? '').trim()
  if (!name) continue
  if (/^(소계|총계|합계|합 계)/.test(name) || /^소계:/.test(name) || /^총계\(/.test(name)) continue
  if (isExcluded(i)) continue
  const balance = parseNum(r[7])
  fileClients.push({ name, balance })
}

// DB 잔액 계산
const dbClients = await prisma.client.findMany({
  include: { accountsReceivable: { include: { payments: { select: { amount: true } } } } },
})
const dbBalanceMap = new Map()
for (const c of dbClients) {
  let totalOrig = 0, totalPaid = 0
  for (const ar of c.accountsReceivable) {
    totalOrig += ar.originalAmount
    totalPaid += ar.payments.reduce((s, p) => s + p.amount, 0)
  }
  dbBalanceMap.set(normalize(c.name), { id: c.id, name: c.name, balance: totalOrig - totalPaid })
}

// 매칭 → 보정 대상 추출
const adjustments = []
for (const f of fileClients) {
  const norm = normalize(f.name)
  let db = dbBalanceMap.get(norm)
  if (!db) {
    for (const [k, v] of dbBalanceMap) {
      if (norm.length >= 3 && (k.includes(norm) || norm.includes(k))) {
        if (norm.length >= 4 || k.length >= 4) { db = v; break }
      }
    }
  }
  if (!db) continue
  const diff = f.balance - db.balance
  if (Math.abs(diff) < 1) continue
  adjustments.push({ clientId: db.id, fileName: f.name, dbName: db.name, before: db.balance, after: f.balance, diff })
}

console.log(`보정 대상: ${adjustments.length}개`)
console.log()

// 백업
const backup = {
  appliedAt: new Date().toISOString(),
  adjustDate: '2026-02-27',
  source: FILE,
  excludedCategories: ['6.?(매입 의심)', '7.공장(매입)'],
  beforeState: adjustments.map(a => ({
    clientId: a.clientId, clientName: a.dbName,
    before: a.before, after: a.after, diff: a.diff,
  })),
  createdTransactionIds: [],
  createdReceivableIds: [],
  createdPaymentIds: [],
}

let salesAdded = 0, paysAdded = 0
let errCnt = 0

for (const a of adjustments) {
  try {
    if (a.diff > 0) {
      // SALE 추가
      const tx = await prisma.transaction.create({
        data: {
          date: ADJUST_DATE,
          type: 'SALE',
          clientId: a.clientId,
          description: `이월 매출 보정 - ${a.dbName}`,
          totalAmount: a.diff,
          taxAmount: 0,
          paymentMethod: 'CREDIT',
          paymentStatus: 'UNPAID',
          channel: 'B2B',
        },
      })
      const ar = await prisma.accountsReceivable.create({
        data: {
          clientId: a.clientId,
          transactionId: tx.id,
          originalAmount: a.diff,
          remainingAmount: a.diff,
          status: 'OUTSTANDING',
          notes: '2026-02-27 거래처잔액 엑셀 일치',
        },
      })
      backup.createdTransactionIds.push(tx.id)
      backup.createdReceivableIds.push(ar.id)
      salesAdded++
      console.log(`  ✓ 🔴 ${a.dbName.padEnd(30)} | ${a.before.toLocaleString().padStart(15)} → ${a.after.toLocaleString().padStart(15)} (+${a.diff.toLocaleString()})`)
    } else {
      // ArPayment 추가 — 가장 오래된 AR에
      const targetAr = await prisma.accountsReceivable.findFirst({
        where: { clientId: a.clientId },
        orderBy: { createdAt: 'asc' },
      })
      let arId = targetAr?.id
      if (!arId) {
        // AR 없으면 placeholder 생성
        const ph = await prisma.transaction.create({
          data: {
            date: ADJUST_DATE,
            type: 'SALE',
            clientId: a.clientId,
            description: '선수금 placeholder',
            totalAmount: 0,
            taxAmount: 0,
            paymentMethod: 'CREDIT',
            paymentStatus: 'PAID',
            channel: 'B2B',
          },
        })
        const newAr = await prisma.accountsReceivable.create({
          data: { clientId: a.clientId, transactionId: ph.id, originalAmount: 0, remainingAmount: 0, status: 'PAID' },
        })
        arId = newAr.id
        backup.createdTransactionIds.push(ph.id)
        backup.createdReceivableIds.push(newAr.id)
      }
      const pay = await prisma.arPayment.create({
        data: {
          receivableId: arId,
          amount: Math.abs(a.diff),
          paymentDate: ADJUST_DATE,
          paymentMethod: 'TRANSFER',
          notes: '[수동 보정] 2026-02-27 거래처잔액 엑셀 일치',
        },
      })
      backup.createdPaymentIds.push(pay.id)
      paysAdded++
      console.log(`  ✓ 🔵 ${a.dbName.padEnd(30)} | ${a.before.toLocaleString().padStart(15)} → ${a.after.toLocaleString().padStart(15)} (${a.diff.toLocaleString()})`)
    }
  } catch (e) {
    errCnt++
    console.error(`  ❌ ${a.dbName}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// 거래처별 잔액 재계산
console.log('\n=== 잔액 재계산 중 ===')
const touchedClients = [...new Set(adjustments.map(a => a.clientId))]
for (const cid of touchedClients) {
  const ars = await prisma.accountsReceivable.findMany({
    where: { clientId: cid },
    include: { payments: { select: { amount: true } } },
  })
  for (const ar of ars) {
    const paid = ar.payments.reduce((s, p) => s + p.amount, 0)
    const rem = Math.max(0, ar.originalAmount - paid)
    const status = rem === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OUTSTANDING'
    if (rem !== ar.remainingAmount || status !== ar.status) {
      await prisma.accountsReceivable.update({
        where: { id: ar.id },
        data: { remainingAmount: rem, status },
      })
    }
  }
}

// 백업 저장
writeFileSync(
  'D:/CFO/scripts/backup/balance-adjust-applied-2026-02-27.json',
  JSON.stringify(backup, null, 2),
)

console.log(`\n=== 결과 ===`)
console.log(`SALE 추가:    ${salesAdded}건`)
console.log(`Payment 추가: ${paysAdded}건`)
console.log(`실패:         ${errCnt}건`)
console.log(`거래처 갱신:  ${touchedClients.length}개`)
console.log(`\n💾 백업: scripts/backup/balance-adjust-applied-2026-02-27.json`)
console.log(`   (롤백 시 createdTransactionIds/createdReceivableIds/createdPaymentIds 삭제)`)

await prisma.$disconnect()
