// 음수 매출 SALE에 AR이 없는 것들 — AR을 추가 생성 (음수 originalAmount)
// 코드 수정 후 이미 들어있는 음수 매출에도 동일하게 적용
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const negSales = await prisma.transaction.findMany({
  where: { type: 'SALE', totalAmount: { lt: 0 } },
  include: { accountsReceivable: true, client: { select: { name: true } } },
})

const targets = negSales.filter(s => s.accountsReceivable.length === 0)
console.log(`음수 매출 ${negSales.length}건 중 AR 없는 것: ${targets.length}건\n`)

for (const tx of targets) {
  if (!tx.clientId) {
    console.log(`  SKIP (clientId 없음): ${tx.id}`)
    continue
  }
  await prisma.accountsReceivable.create({
    data: {
      clientId: tx.clientId,
      transactionId: tx.id,
      originalAmount: tx.totalAmount,
      remainingAmount: tx.totalAmount,
      status: 'PAID',  // 음수면 회수 대상 아님
    },
  })
  console.log(`  ✓ ${tx.date.toISOString().slice(0,10)} | ${tx.client?.name ?? '-'} | ₩${tx.totalAmount.toLocaleString()}`)
}

console.log(`\n백필 완료: ${targets.length}건`)
await prisma.$disconnect()
