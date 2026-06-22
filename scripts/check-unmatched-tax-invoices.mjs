// 업로드된 세금계산서 중 매출 매칭 안 된 것
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const allTax = await prisma.taxInvoice.findMany({
  include: { client: { select: { name: true } } },
  orderBy: { issueDate: 'desc' },
})

const matched = allTax.filter(t => t.matchedTransactionId)
const unmatched = allTax.filter(t => !t.matchedTransactionId)

console.log(`전체 업로드된 세금계산서: ${allTax.length}건`)
console.log(`  ✅ 매출 매칭됨: ${matched.length}건 (₩${matched.reduce((s,t)=>s+t.totalAmount,0).toLocaleString()})`)
console.log(`  ⚠ 매칭 안 됨:  ${unmatched.length}건 (₩${unmatched.reduce((s,t)=>s+t.totalAmount,0).toLocaleString()})`)

// status 별
const byStatus = {}
for (const t of allTax) {
  byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
}
console.log(`\n=== status 분포 ===`)
for (const [k, v] of Object.entries(byStatus)) console.log(`  ${k}: ${v}건`)

// 거래처별 미매칭
const byClient = new Map()
for (const t of unmatched) {
  const name = t.client?.name ?? t.clientNameRaw ?? '-'
  if (!byClient.has(name)) byClient.set(name, { count: 0, amount: 0, items: [] })
  const v = byClient.get(name)
  v.count++
  v.amount += t.totalAmount
  v.items.push(t)
}

const sorted = [...byClient.entries()].sort((a, b) => b[1].amount - a[1].amount)

console.log(`\n=== 거래처별 미매칭 세금계산서 (금액 큰 순) ===`)
console.log('거래처'.padEnd(35) + '건수'.padStart(8) + '금액'.padStart(18))
console.log('─'.repeat(65))
for (const [name, v] of sorted) {
  console.log((name.length > 33 ? name.slice(0, 32) + '…' : name).padEnd(35) + String(v.count).padStart(8) + `₩${v.amount.toLocaleString()}`.padStart(18))
}

console.log(`\n=== 미매칭 세금계산서 상세 (TOP 50) ===`)
const allUnmatched = unmatched.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 50)
for (const t of allUnmatched) {
  const name = t.client?.name ?? t.clientNameRaw ?? '-'
  console.log(`  ${t.issueDate.toISOString().slice(0,10)} | ${name.padEnd(28)} | 공급가 ${t.supplyAmount.toLocaleString().padStart(12)} | 부가세 ${t.taxAmount.toLocaleString().padStart(10)} | 합계 ${t.totalAmount.toLocaleString().padStart(12)} | ${t.itemName ?? ''}`)
}

// 미매칭 원인 추정
console.log(`\n=== 미매칭 원인 분석 ===`)
let noClient = 0
let clientButNoMatch = 0
let businessNumberOnly = 0
for (const t of unmatched) {
  if (!t.clientId) noClient++
  else clientButNoMatch++
  if (t.businessNumber && !t.clientId) businessNumberOnly++
}
console.log(`  거래처 매칭 실패 (clientId null): ${noClient}건`)
console.log(`  거래처는 있는데 매출 매칭 실패:   ${clientButNoMatch}건`)
console.log(`  사업자번호만 있고 거래처 매칭 X: ${businessNumberOnly}건`)

await prisma.$disconnect()
