import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const start = new Date('2026-03-01T00:00:00Z')
const end = new Date('2026-03-31T23:59:59Z')

const sales = await prisma.transaction.findMany({
  where: {
    type: 'SALE',
    date: { gte: start, lte: end },
    items: { some: { productName: { contains: 'BOHO' } } }
  },
  include: { items: true }
})

console.log('=== BOHO 매출 ===')
let totalSaleQty = 0
for (const tx of sales) {
  for (const i of tx.items) {
    if (!i.productName?.includes('BOHO')) continue
    totalSaleQty += i.quantity
    console.log(`${tx.date.toISOString().slice(0,10)} | ${i.productName} | qty=${i.quantity} | unitPrice=${i.unitPrice} | amount=₩${i.amount.toLocaleString()}`)
  }
}
console.log(`총 BOHO 매출 수량: ${totalSaleQty} 야드`)

const costs = await prisma.transactionItem.findMany({
  where: {
    transaction: {
      type: 'PURCHASE',
      date: { gte: start, lte: end },
      description: { startsWith: '원단 매입원가' },
    },
    productName: { contains: 'BOHO' }
  },
  include: { transaction: { select: { date: true, description: true } } }
})

console.log('\n=== BOHO 원가 ===')
let totalCost = 0, totalCostQty = 0
for (const c of costs) {
  totalCost += c.amount
  totalCostQty += c.quantity
  console.log(`${c.transaction.date.toISOString().slice(0,10)} | ${c.productName} | qty=${c.quantity} | unitPrice=${c.unitPrice} | amount=₩${c.amount.toLocaleString()} | notes=${c.notes ?? ''}`)
}
console.log(`총 원가 수량: ${totalCostQty} | 총 원가: ₩${totalCost.toLocaleString()}`)

await prisma.$disconnect()
