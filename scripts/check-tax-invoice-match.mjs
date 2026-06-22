// 세금계산서 매칭 안 된 일계표 매출 분석
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 모든 일계표 매출 (보정/placeholder 제외)
const sales = await prisma.transaction.findMany({
  where: {
    type: 'SALE',
    description: { startsWith: '일계표 매출' },
  },
  include: {
    client: { select: { name: true } },
    taxInvoices: { select: { id: true } },
  },
  orderBy: { date: 'asc' },
})

console.log(`전체 일계표 매출: ${sales.length}건`)

// 세금계산서 매칭 분류
const matched = sales.filter(s => s.taxInvoices.length > 0)
const unmatched = sales.filter(s => s.taxInvoices.length === 0)

// taxStatus 별
const byStatus = {
  PENDING: sales.filter(s => s.taxStatus === 'PENDING'),
  ISSUED: sales.filter(s => s.taxStatus === 'ISSUED'),
  COMPLETED: sales.filter(s => s.taxStatus === 'COMPLETED'),
  null: sales.filter(s => !s.taxStatus),
}

console.log(`\n=== TaxInvoice 매칭 기준 ===`)
console.log(`  📄 매칭됨: ${matched.length}건 (₩${matched.reduce((s,t)=>s+t.totalAmount,0).toLocaleString()})`)
console.log(`  ⚠ 미매칭:  ${unmatched.length}건 (₩${unmatched.reduce((s,t)=>s+t.totalAmount,0).toLocaleString()})`)

console.log(`\n=== taxStatus 컬럼 기준 (사용자 수동 변경) ===`)
console.log(`  null (기본):  ${byStatus.null.length}건`)
console.log(`  PENDING:      ${byStatus.PENDING.length}건`)
console.log(`  ISSUED:       ${byStatus.ISSUED.length}건`)
console.log(`  COMPLETED:    ${byStatus.COMPLETED.length}건`)

// 거래처별 미매칭 TOP
const unmatchedByClient = new Map()
for (const s of unmatched) {
  const name = s.client?.name ?? '-'
  if (!unmatchedByClient.has(name)) unmatchedByClient.set(name, { count: 0, amount: 0 })
  const v = unmatchedByClient.get(name)
  v.count++
  v.amount += s.totalAmount
}
const topClients = [...unmatchedByClient.entries()]
  .sort((a, b) => b[1].amount - a[1].amount)
  .slice(0, 30)

console.log(`\n=== 미매칭 매출 TOP 30 거래처 (금액 큰 순) ===`)
console.log('거래처'.padEnd(35) + '건수'.padStart(8) + '금액'.padStart(18))
console.log('─'.repeat(65))
for (const [name, v] of topClients) {
  console.log((name.length > 33 ? name.slice(0, 32) + '…' : name).padEnd(35) + String(v.count).padStart(8) + `₩${v.amount.toLocaleString()}`.padStart(18))
}

// 카레클린트 자세히
const car = unmatched.filter(s => (s.client?.name ?? '').includes('카레클린트'))
console.log(`\n=== 주식회사 카레클린트 미매칭 매출 ${car.length}건 ===`)
for (const s of car) {
  console.log(`  ${s.date.toISOString().slice(0,10)} | ₩${s.totalAmount.toLocaleString().padStart(12)} | taxStatus: ${s.taxStatus ?? 'null'}`)
}

// 월별 미매칭
const byMonth = new Map()
for (const s of unmatched) {
  const m = s.date.toISOString().slice(0, 7)
  if (!byMonth.has(m)) byMonth.set(m, { count: 0, amount: 0 })
  const v = byMonth.get(m)
  v.count++
  v.amount += s.totalAmount
}
console.log(`\n=== 월별 미매칭 매출 ===`)
for (const [m, v] of [...byMonth.entries()].sort()) {
  console.log(`  ${m} | ${v.count}건 | ₩${v.amount.toLocaleString()}`)
}

await prisma.$disconnect()
