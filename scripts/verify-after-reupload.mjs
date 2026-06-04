import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 전체 통계
const agg = await prisma.arPayment.aggregate({
  where: { notes: { startsWith: '[일계표]' } },
  _count: true,
  _sum: { amount: true },
})
console.log(`[일계표] ArPayment: ${agg._count}건 / ₩${(agg._sum.amount ?? 0).toLocaleString()}`)

// 검증 케이스
async function checkClient(name) {
  const c = await prisma.client.findFirst({ where: { name: { contains: name } } })
  if (!c) return
  const ars = await prisma.accountsReceivable.findMany({
    where: { clientId: c.id },
    include: { payments: { select: { amount: true } }, transaction: { select: { date: true } } },
    orderBy: { transaction: { date: 'asc' } },
  })
  const totalOrig = ars.reduce((s, ar) => s + ar.originalAmount, 0)
  const totalPaid = ars.reduce((s, ar) => s + ar.payments.reduce((p, x) => p + x.amount, 0), 0)
  const balance = totalOrig - totalPaid
  console.log(`\n${c.name}: 매출합 ₩${totalOrig.toLocaleString()} / 입금합 ₩${totalPaid.toLocaleString()} / 잔액 ₩${balance.toLocaleString()}`)
  for (const ar of ars) {
    const paid = ar.payments.reduce((s, p) => s + p.amount, 0)
    console.log(`  ${ar.transaction.date.toISOString().slice(0,10)} | 원금 ₩${ar.originalAmount.toLocaleString()} | 잔액 ₩${ar.remainingAmount.toLocaleString()} | ${ar.status}`)
  }
}

await checkClient('얄란')
await checkClient('유진디자인')
await checkClient('홈파베르')
await checkClient('장원가구')

await prisma.$disconnect()
