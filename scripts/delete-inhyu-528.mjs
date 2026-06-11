// (주)인휴 5/28 ₩3,200,000 잘못된 입금 삭제
// 통장에도 없고 일계표 원본에도 없는 stale 데이터
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const target = await prisma.arPayment.findFirst({
  where: {
    paymentDate: { gte: new Date('2026-05-28'), lte: new Date('2026-05-28T23:59:59') },
    amount: 3200000,
    notes: { contains: '인휴' },
  },
  include: { receivable: { include: { client: true } } },
})

if (!target) {
  console.log('대상 입금을 찾을 수 없습니다 (이미 삭제됨?)')
  process.exit(0)
}

console.log('삭제 대상:')
console.log(`  ID: ${target.id}`)
console.log(`  거래처: ${target.receivable.client.name}`)
console.log(`  금액: ₩${target.amount.toLocaleString()}`)
console.log(`  날짜: ${target.paymentDate.toISOString().slice(0,10)}`)
console.log(`  메모: ${target.notes}`)
console.log(`  생성: ${target.createdAt.toISOString()}`)

await prisma.arPayment.delete({ where: { id: target.id } })
console.log('\n✓ 삭제 완료')

await prisma.$disconnect()
