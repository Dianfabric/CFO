import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const clients = await prisma.client.findMany({
  where: { name: { contains: '얄란' } },
})

console.log(`거래처: ${clients.length}건`)
for (const c of clients) console.log(`  [${c.id}] ${c.name}`)
console.log()

if (clients.length === 0) {
  await prisma.$disconnect()
  process.exit(0)
}

const ids = clients.map(c => c.id)

// 매출 거래
const sales = await prisma.transaction.findMany({
  where: { type: 'SALE', clientId: { in: ids } },
  include: { items: true, client: { select: { name: true } } },
  orderBy: { date: 'asc' },
})

console.log(`=== 매출(SALE) 거래 ${sales.length}건 ===`)
let totalSale = 0
for (const tx of sales) {
  totalSale += tx.totalAmount
  const d = tx.date.toISOString().slice(0, 10)
  console.log(`\n[${tx.id.slice(0,8)}] ${d} | ${tx.client?.name}`)
  console.log(`   매출 ₩${tx.totalAmount.toLocaleString()} | 담당:${tx.salesPerson ?? '-'}`)
  for (const it of tx.items) {
    console.log(`    - ${it.productName} ${it.quantity} = ₩${it.amount.toLocaleString()}`)
  }
}
console.log(`\n총 매출 ₩${totalSale.toLocaleString()}`)

// AR
const ars = await prisma.accountsReceivable.findMany({
  where: { clientId: { in: ids } },
  include: { payments: true, transaction: true },
  orderBy: { createdAt: 'asc' },
})

console.log(`\n=== 미수금(AR) ${ars.length}건 ===`)
let totalOrig = 0, totalRem = 0
for (const ar of ars) {
  totalOrig += ar.originalAmount
  totalRem += ar.remainingAmount
  const d = ar.transaction.date.toISOString().slice(0, 10)
  console.log(`  ${d} | 원금 ₩${ar.originalAmount.toLocaleString()} | 잔액 ₩${ar.remainingAmount.toLocaleString()} | ${ar.status}`)
  for (const p of ar.payments) {
    const pd = p.paymentDate.toISOString().slice(0, 10)
    console.log(`     ↳ 입금 ${pd} ₩${p.amount.toLocaleString()} | ${p.notes ?? ''}`)
  }
}
console.log(`\n총 원금 ₩${totalOrig.toLocaleString()} / 잔액 ₩${totalRem.toLocaleString()}`)

await prisma.$disconnect()
