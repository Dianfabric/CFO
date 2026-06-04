import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const client = await prisma.client.findFirst({ where: { name: { contains: '홈파베르' } } })
if (!client) { console.log('찾을 수 없음'); await prisma.$disconnect(); process.exit() }
console.log(`Client: ${client.name} (${client.id})`)

const sales = await prisma.transaction.findMany({
  where: { type: 'SALE', clientId: client.id },
  include: { items: true },
  orderBy: { date: 'asc' },
})
console.log(`\n=== SALE ${sales.length}건 ===`)
for (const tx of sales) {
  console.log(`  ${tx.date.toISOString().slice(0,10)} | total ₩${tx.totalAmount.toLocaleString()} | tax ₩${tx.taxAmount.toLocaleString()} | 생성:${tx.createdAt.toISOString().slice(0,19)}`)
}

const allPay = await prisma.arPayment.findMany({
  where: { receivable: { clientId: client.id } },
  include: { receivable: { include: { transaction: { select: { date: true } } } } },
  orderBy: { createdAt: 'asc' },
})
console.log(`\n=== ArPayment ${allPay.length}건 (생성순) ===`)
for (const p of allPay) {
  console.log(`  생성:${p.createdAt.toISOString().slice(0,19)} | 결제일:${p.paymentDate.toISOString().slice(0,10)} | ₩${p.amount.toLocaleString()} | AR_매출일:${p.receivable.transaction.date.toISOString().slice(0,10)} | ${p.notes}`)
}

const t0311 = allPay.filter(p => p.notes?.includes('2026-03-11'))
console.log(`\n3/11 일계표 입금 총합: ₩${t0311.reduce((s,p)=>s+p.amount,0).toLocaleString()}`)

const ars = await prisma.accountsReceivable.findMany({
  where: { clientId: client.id },
  orderBy: { createdAt: 'asc' },
  include: { transaction: { select: { date: true } } },
})
console.log(`\n=== AR 현재 상태 ===`)
for (const ar of ars) {
  console.log(`  매출일:${ar.transaction.date.toISOString().slice(0,10)} | 원금 ₩${ar.originalAmount.toLocaleString()} | 잔액 ₩${ar.remainingAmount.toLocaleString()} | ${ar.status}`)
}

await prisma.$disconnect()
