import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const todayKST = new Date()
todayKST.setHours(0, 0, 0, 0)
const sinceUTC = new Date(todayKST.getTime() - 9 * 60 * 60 * 1000)

console.log(`기준 시각: createdAt >= ${sinceUTC.toISOString()}`)
console.log(`(= KST ${todayKST.toISOString().slice(0,10)} 00:00 이후)\n`)

const txs = await prisma.transaction.findMany({
  where: { createdAt: { gte: sinceUTC } },
  orderBy: { createdAt: 'asc' },
})

console.log(`총 ${txs.length}건 거래\n`)

const byType = {}
for (const tx of txs) {
  const key = tx.description ?? '(no desc)'
  if (!byType[key]) byType[key] = { count: 0, total: 0 }
  byType[key].count++
  byType[key].total += tx.totalAmount
}

console.log('=== description 별 집계 ===')
const sorted = Object.entries(byType).sort((a, b) => b[1].total - a[1].total)
for (const [k, v] of sorted) {
  console.log(`  ${k.padEnd(45)} ${String(v.count).padStart(3)}건  ₩${v.total.toLocaleString().padStart(15)}`)
}

const grand = txs.reduce((s, t) => s + t.totalAmount, 0)
console.log(`\n합계: ₩${grand.toLocaleString()}`)

const arCount = await prisma.accountsReceivable.count({
  where: { transactionId: { in: txs.map(t => t.id) } }
})
console.log(`관련 AccountsReceivable: ${arCount}건`)

await prisma.$disconnect()
