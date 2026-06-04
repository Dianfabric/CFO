import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const clients = await prisma.client.findMany({
  where: { name: { contains: '유진디자인' } },
})
console.log(`거래처: ${clients.length}건`)
for (const c of clients) console.log(`  [${c.id}] ${c.name}`)

const ids = clients.map(c => c.id)

// SALE 거래 + items
const sales = await prisma.transaction.findMany({
  where: { type: 'SALE', clientId: { in: ids } },
  include: { items: true },
  orderBy: { date: 'asc' },
})
console.log(`\n=== SALE 거래 ${sales.length}건 ===`)
let totalSale = 0
for (const tx of sales) {
  totalSale += tx.totalAmount
  console.log(`  ${tx.date.toISOString().slice(0,10)} | total ₩${tx.totalAmount.toLocaleString()} | tax ₩${tx.taxAmount.toLocaleString()} | ${tx.description}`)
}
console.log(`  총합: ₩${totalSale.toLocaleString()}`)

// AR
const ars = await prisma.accountsReceivable.findMany({
  where: { clientId: { in: ids } },
  include: { payments: { orderBy: { paymentDate: 'asc' } }, transaction: { select: { date: true } } },
  orderBy: { createdAt: 'asc' },
})
console.log(`\n=== AR ${ars.length}건 ===`)
for (const ar of ars) {
  console.log(`  ${ar.transaction.date.toISOString().slice(0,10)} | 원금 ₩${ar.originalAmount.toLocaleString()} | 잔액 ₩${ar.remainingAmount.toLocaleString()} | ${ar.status}`)
  for (const p of ar.payments) {
    console.log(`     ↳ ${p.paymentDate.toISOString().slice(0,10)} 입금 ₩${p.amount.toLocaleString()} | ${p.notes}`)
  }
}

// 모든 ArPayment for this client (matched + 어디든)
const allPay = await prisma.arPayment.findMany({
  where: { receivable: { clientId: { in: ids } } },
  include: { receivable: { include: { transaction: { select: { date: true, description: true } } } } },
  orderBy: { paymentDate: 'asc' },
})
console.log(`\n=== 모든 ArPayment ${allPay.length}건 ===`)
let totalPay = 0
for (const p of allPay) {
  totalPay += p.amount
  console.log(`  ${p.paymentDate.toISOString().slice(0,10)} | ₩${p.amount.toLocaleString()} | AR=${p.receivable.transaction.date.toISOString().slice(0,10)} ${p.receivable.transaction.description} | ${p.notes}`)
}
console.log(`  총합: ₩${totalPay.toLocaleString()}`)

await prisma.$disconnect()
