import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const client = await prisma.client.findFirst({ where: { name: { contains: '유진디자인' } } })
console.log(`Client: ${client.name} (${client.id})`)

// 모든 ArPayment 시간순 + createdAt
const allPay = await prisma.arPayment.findMany({
  where: { receivable: { clientId: client.id } },
  include: { receivable: { select: { transactionId: true, transaction: { select: { date: true } } } } },
  orderBy: { createdAt: 'asc' },
})

console.log(`\n총 ${allPay.length}건 ArPayment (생성순):`)
for (const p of allPay) {
  console.log(`  생성:${p.createdAt.toISOString().slice(0,19)} | 결제일:${p.paymentDate.toISOString().slice(0,10)} | ₩${p.amount.toLocaleString()} | AR_매출일:${p.receivable.transaction.date.toISOString().slice(0,10)} | ${p.notes}`)
}

// 3/31 일계표 적용된 입금만
const t0331 = allPay.filter(p => p.notes?.includes('2026-03-31'))
console.log(`\n3/31 일계표 적용 입금 총합: ₩${t0331.reduce((s,p)=>s+p.amount, 0).toLocaleString()}`)

// SALE 거래 createdAt 순서
const sales = await prisma.transaction.findMany({
  where: { type: 'SALE', clientId: client.id },
  orderBy: { createdAt: 'asc' },
})
console.log(`\nSALE 거래 (생성순):`)
for (const t of sales) {
  console.log(`  생성:${t.createdAt.toISOString().slice(0,19)} | 매출일:${t.date.toISOString().slice(0,10)} | ₩${t.totalAmount.toLocaleString()} (tax ${t.taxAmount.toLocaleString()})`)
}

await prisma.$disconnect()
