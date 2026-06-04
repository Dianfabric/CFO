import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 최근 6시간 이내 생성된 해외운송비 / 수입원자재 / 수입세금 거래
const since = new Date(Date.now() - 6 * 60 * 60 * 1000)

const txs = await prisma.transaction.findMany({
  where: {
    createdAt: { gte: since },
    OR: [
      { description: { startsWith: '해외운송비' } },
      { description: { contains: '글로지텍' } },
      { description: { contains: '수입' } },
    ],
  },
  include: { items: true },
  orderBy: { createdAt: 'desc' },
})

console.log(`=== 최근 6시간 이내 등록된 해외/수입 거래 (${txs.length}건) ===\n`)
let total = 0
for (const tx of txs) {
  total += tx.totalAmount
  console.log(`[${tx.id}]`)
  console.log(`  ${tx.createdAt.toISOString()} (생성)`)
  console.log(`  date=${tx.date.toISOString().slice(0,10)} | ${tx.description}`)
  console.log(`  ₩${tx.totalAmount.toLocaleString()} | notes=${tx.notes ?? ''}`)
  console.log()
}
console.log(`총 ₩${total.toLocaleString()}\n`)

// MonthlyCost도 확인
const mc = await prisma.monthlyCost.findMany({
  where: { source: 'PDF_UPLOAD', updatedAt: { gte: since } },
  include: { costCategory: true },
})
console.log(`=== 최근 6시간 이내 변경된 MonthlyCost (${mc.length}건) ===`)
for (const m of mc) {
  console.log(`  ${m.yearMonth} | ${m.costCategory.name} | ₩${m.amount.toLocaleString()} | notes=${m.notes ?? ''}`)
}

await prisma.$disconnect()
