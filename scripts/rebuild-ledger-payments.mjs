// 일계표에 적힌 실제 입금액으로 [일계표] 마커 ArPayment 재생성
//
// 절차:
//   1. 일계표 .xls 파일들 파싱 → 거래처×날짜 단위 실제 입금액 (vat 포함)
//   2. 기존 [일계표] 마커 ArPayment 삭제
//   3. 거래처별 가장 오래된 AR 에 1건 = 실제 입금액 그대로 생성
//   4. 거래처별 모든 AR remainingAmount/status 재계산
//
// 사용:
//   node scripts/rebuild-ledger-payments.mjs --dry   (변경 없이 영향 분석)
//   node scripts/rebuild-ledger-payments.mjs         (실제 적용)
import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const DRY = process.argv.includes('--dry')

const FILES = [
  'D:/Dropbox/일계표(리스트)_3월.xls',
  'D:/Dropbox/일계표.xls',                       // 4월 분
  'D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.04/일계표(리스트)_260604_101810.xls', // 4월+5월
  'D:/Dropbox/일계표 06.02.xls',                 // 6/2
]

function parseSheetDate(name) {
  // "26.04.01" → 2026-04-01
  const m = name.match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})$/)
  if (!m) return null
  return new Date(2000 + parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 12, 0, 0)
}
function parseAmt(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = parseFloat(String(v).replace(/,/g, ''))
  return isNaN(n) ? 0 : Math.abs(n)
}

// (clientName, dateStr) → 입금합 (vat 포함)
const ledger = new Map()
const key = (c, d) => `${c}__${d}`

let totalRowsRead = 0
for (const path of FILES) {
  try {
    const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
    for (const sn of wb.SheetNames) {
      const d = parseSheetDate(sn)
      if (!d) continue
      const dateStr = d.toISOString().slice(0, 10)
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' })
      for (const r of rows) {
        const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
        if (!Number.isFinite(no) || no <= 0) continue
        const account = String(r[1] ?? '').trim()
        if (account !== '입금') continue
        const client = String(r[2] ?? '').trim()
        if (!client) continue
        const amount = parseAmt(r[8]) + parseAmt(r[9])   // 금액 + 부가세
        if (amount === 0) continue
        const k = key(client, dateStr)
        ledger.set(k, (ledger.get(k) ?? 0) + amount)
        totalRowsRead++
      }
    }
  } catch (e) {
    console.error(`파일 읽기 실패: ${path} — ${e.message}`)
  }
}
console.log(`일계표 입금 행 ${totalRowsRead}건 / 그룹 ${ledger.size}건`)
const ledgerTotal = Array.from(ledger.values()).reduce((s, v) => s + v, 0)
console.log(`일계표 입금 총합: ₩${ledgerTotal.toLocaleString()}`)

// 현재 DB [일계표] 마커 ArPayment
const dbPayments = await prisma.arPayment.findMany({
  where: { notes: { startsWith: '[일계표]' } },
  include: { receivable: { include: { client: { select: { name: true } } } } },
})
const dbTotal = dbPayments.reduce((s, p) => s + p.amount, 0)
console.log(`\nDB ArPayment ([일계표]) ${dbPayments.length}건 / ₩${dbTotal.toLocaleString()}`)
console.log(`차이: ₩${(ledgerTotal - dbTotal).toLocaleString()}`)

if (DRY) {
  // 거래처별 차이 상위 표시
  const diffByClient = new Map()
  for (const [k, amt] of ledger) {
    const [c] = k.split('__')
    diffByClient.set(c, (diffByClient.get(c) ?? 0) + amt)
  }
  for (const p of dbPayments) {
    const c = p.receivable.client.name
    diffByClient.set(c, (diffByClient.get(c) ?? 0) - p.amount)
  }
  const sorted = Array.from(diffByClient.entries()).filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  console.log(`\n=== 거래처별 차이 상위 30건 ===`)
  for (const [c, d] of sorted.slice(0, 30)) {
    console.log(`  ${c.padEnd(30)} ${d > 0 ? '+' : ''}${d.toLocaleString()}`)
  }
  await prisma.$disconnect()
  process.exit(0)
}

// --- 실제 적용 ---
console.log('\n=== 적용 시작 ===')

// 1) 기존 [일계표] 마커 ArPayment 전부 삭제
const deleted = await prisma.arPayment.deleteMany({ where: { notes: { startsWith: '[일계표]' } } })
console.log(`기존 [일계표] ArPayment 삭제: ${deleted.count}건`)

// 2) 거래처별 가장 오래된 AR 매핑
const allArs = await prisma.accountsReceivable.findMany({
  include: { client: { select: { name: true } } },
  orderBy: { createdAt: 'asc' },
})
const arByClient = new Map()  // clientName → AR
for (const ar of allArs) {
  const n = ar.client.name
  if (!arByClient.has(n)) arByClient.set(n, ar)  // 첫번째 = 가장 오래된
}

// 3) 일계표 그룹별로 ArPayment 재생성
let created = 0, skipped = 0
const skippedClients = []
for (const [k, amount] of ledger) {
  const [client, dateStr] = k.split('__')
  const ar = arByClient.get(client)
  if (!ar) {
    skipped++
    skippedClients.push({ client, dateStr, amount })
    continue
  }
  await prisma.arPayment.create({
    data: {
      receivableId: ar.id,
      amount,
      paymentDate: new Date(`${dateStr}T12:00:00`),
      paymentMethod: '입금',
      notes: `[일계표] ${dateStr} | ${client}`,
    },
  })
  created++
}
console.log(`ArPayment 생성: ${created}건 / skip(AR없음): ${skipped}건`)
if (skipped > 0) {
  const sum = skippedClients.reduce((s, x) => s + x.amount, 0)
  console.log(`  skip 합계: ₩${sum.toLocaleString()}`)
  console.log('  skip 거래처(상위 10):')
  for (const x of skippedClients.slice(0, 10)) console.log(`    ${x.client} ${x.dateStr} ₩${x.amount.toLocaleString()}`)
}

// 4) 거래처별 AR 잔액 재계산
const clientIds = Array.from(new Set(allArs.map(a => a.clientId)))
let recalc = 0
for (const cid of clientIds) {
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
      recalc++
    }
  }
}
console.log(`AR 잔액 재계산: ${recalc}건 갱신`)

await prisma.$disconnect()
console.log('\n완료.')
