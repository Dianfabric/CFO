// [일계표] 마커 ArPayment 전부 삭제 + AR 잔액 OUTSTANDING 으로 리셋
// 사용자가 일계표를 다시 업로드하면 새 코드로 정확히 처리됨
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const before = await prisma.arPayment.aggregate({
  where: { notes: { startsWith: '[일계표]' } },
  _count: true,
  _sum: { amount: true },
})
console.log(`삭제 대상: ${before._count}건 / ₩${(before._sum.amount ?? 0).toLocaleString()}`)

const del = await prisma.arPayment.deleteMany({ where: { notes: { startsWith: '[일계표]' } } })
console.log(`ArPayment 삭제: ${del.count}건`)

// 거래처별 AR 잔액 재계산
const ars = await prisma.accountsReceivable.findMany({
  include: { payments: { select: { amount: true } } },
})
let updated = 0
for (const ar of ars) {
  const paid = ar.payments.reduce((s, p) => s + p.amount, 0)
  const rem = Math.max(0, ar.originalAmount - paid)
  const status = rem === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OUTSTANDING'
  if (rem !== ar.remainingAmount || status !== ar.status) {
    await prisma.accountsReceivable.update({
      where: { id: ar.id },
      data: { remainingAmount: rem, status },
    })
    updated++
  }
}
console.log(`AR 잔액 재계산: ${updated}건 갱신`)

await prisma.$disconnect()
console.log('\n완료. 일계표 3-6월 재업로드 부탁드립니다.')
