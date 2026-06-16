// 잔액 조정/보정/이월 거래의 정확한 날짜 확인
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 이월 매출 보정 SALE
const corrections = await prisma.transaction.groupBy({
  by: ['date'],
  where: {
    type: 'SALE',
    OR: [
      { description: { startsWith: '이월 매출 보정' } },
      { description: { startsWith: '이월 매출 -' } },
    ],
  },
  _count: true,
  _sum: { totalAmount: true },
  orderBy: { date: 'asc' },
})
console.log('=== 이월 매출 보정 SALE (일자별) ===')
for (const c of corrections) {
  console.log(`  ${c.date.toISOString().slice(0,10)} | ${c._count}건 | ₩${(c._sum.totalAmount ?? 0).toLocaleString()}`)
}

// 수동 보정 입금
const manualPays = await prisma.arPayment.groupBy({
  by: ['paymentDate'],
  where: {
    OR: [
      { notes: { startsWith: '[수동 보정]' } },
      { notes: { startsWith: '[이월]' } },
    ],
  },
  _count: true,
  _sum: { amount: true },
  orderBy: { paymentDate: 'asc' },
})
console.log('\n=== 수동 보정/이월 입금 (일자별) ===')
for (const p of manualPays) {
  console.log(`  ${p.paymentDate.toISOString().slice(0,10)} | ${p._count}건 | ₩${(p._sum.amount ?? 0).toLocaleString()}`)
}

await prisma.$disconnect()
