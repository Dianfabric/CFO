import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const start = new Date('2026-03-01T00:00:00Z')
const end = new Date('2026-03-31T23:59:59Z')

const txs = await prisma.transaction.findMany({
  where: {
    type: 'PURCHASE',
    date: { gte: start, lte: end },
    OR: [
      { description: { startsWith: '해외운송비' } },
      { description: { contains: '관세' } },
    ],
  },
  include: { items: true },
  orderBy: { date: 'asc' },
})

console.log(`=== 3월 해외/관세 거래 (${txs.length}건) ===`)
let total = 0
for (const tx of txs) {
  total += tx.totalAmount
  console.log(`${tx.date.toISOString().slice(0,10)} | ${tx.description} | ₩${tx.totalAmount.toLocaleString()} | notes=${tx.notes ?? ''}`)
}
console.log(`총 ₩${total.toLocaleString()}\n`)

const mc = await prisma.monthlyCost.findMany({
  where: { yearMonth: '2026-03' },
  include: { costCategory: true },
})
console.log('=== 3월 MonthlyCost ===')
for (const m of mc) {
  console.log(`${m.costCategory.name} | ₩${m.amount.toLocaleString()} | source=${m.source} | notes=${m.notes ?? ''}`)
}

await prisma.$disconnect()
