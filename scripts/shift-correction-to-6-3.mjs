// 6/4 자 보정 데이터를 6/3 로 일괄 이동
// - Transaction (description: '이월 매출 보정' 또는 '이월 매출')
// - ArPayment (notes: '[수동 보정]' 또는 '[이월]')
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TARGET_DATE = new Date('2026-06-03T12:00:00')
const OLD_START = new Date('2026-06-04T00:00:00')
const OLD_END = new Date('2026-06-04T23:59:59')

const tx = await prisma.transaction.updateMany({
  where: {
    OR: [
      { description: { startsWith: '이월 매출 보정' } },
      { description: { startsWith: '이월 매출 -' } },
    ],
    date: { gte: OLD_START, lte: OLD_END },
  },
  data: { date: TARGET_DATE },
})
console.log(`Transaction 날짜 이동: ${tx.count}건`)

const pay = await prisma.arPayment.updateMany({
  where: {
    OR: [
      { notes: { startsWith: '[수동 보정]' } },
      { notes: { startsWith: '[이월]' } },
    ],
    paymentDate: { gte: OLD_START, lte: OLD_END },
  },
  data: { paymentDate: TARGET_DATE },
})
console.log(`ArPayment 날짜 이동: ${pay.count}건`)

await prisma.$disconnect()
