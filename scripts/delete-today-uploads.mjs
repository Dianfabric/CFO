import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 오늘 업로드된 거래만 삭제
const todayKST = new Date()
todayKST.setHours(0, 0, 0, 0)
// KST 오늘 0시 = UTC 어제 15시
const sinceUTC = new Date(todayKST.getTime() - 9 * 60 * 60 * 1000)

console.log(`삭제 기준: createdAt >= ${sinceUTC.toISOString()} (KST 오늘 00:00 ~)`)

const txs = await prisma.transaction.findMany({
  where: { createdAt: { gte: sinceUTC } },
  select: { id: true, type: true, description: true, totalAmount: true, date: true, createdAt: true },
  orderBy: { createdAt: 'asc' },
})

console.log(`\n=== 삭제 대상 거래 ${txs.length}건 ===`)
const byType = {}
for (const tx of txs) {
  const key = tx.description ?? '(no desc)'
  if (!byType[key]) byType[key] = { count: 0, total: 0 }
  byType[key].count++
  byType[key].total += tx.totalAmount
}
for (const [k, v] of Object.entries(byType)) {
  console.log(`  ${k.padEnd(40)} ${v.count}건 ₩${v.total.toLocaleString()}`)
}

const ids = txs.map(t => t.id)

// 관련 AR
const arCount = await prisma.accountsReceivable.count({ where: { transactionId: { in: ids } } })
console.log(`\n=== 관련 AccountsReceivable ${arCount}건 ===`)

// 관련 items (cascade로 삭제될 것)
const itemCount = await prisma.transactionItem.count({ where: { transactionId: { in: ids } } })
console.log(`관련 TransactionItem ${itemCount}건 (cascade 삭제)`)

// 삭제 실행
console.log('\n>>> 삭제 시작...')
await prisma.accountsReceivable.deleteMany({ where: { transactionId: { in: ids } } })
console.log(`  AR ${arCount}건 삭제 완료`)
await prisma.transactionItem.deleteMany({ where: { transactionId: { in: ids } } })
console.log(`  Item ${itemCount}건 삭제 완료`)
await prisma.transaction.deleteMany({ where: { id: { in: ids } } })
console.log(`  Transaction ${ids.length}건 삭제 완료`)

// 4월/3월 해외 카테고리 MonthlyCost 재계산
const overseasCategory = await prisma.costCategory.findFirst({ where: { name: { contains: '해외' } } })
if (overseasCategory) {
  for (const ym of ['2026-03', '2026-04']) {
    const [y, m] = ym.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 1)
    const sum = await prisma.transaction.aggregate({
      _sum: { totalAmount: true },
      where: {
        type: 'PURCHASE',
        date: { gte: start, lt: end },
        OR: [
          { description: { startsWith: '해외운송비' } },
          { description: { contains: '국제운송비' } },
          { description: { contains: '관세' } },
        ],
      },
    })
    const newAmount = sum._sum.totalAmount ?? 0
    const existing = await prisma.monthlyCost.findUnique({
      where: { costCategoryId_yearMonth: { costCategoryId: overseasCategory.id, yearMonth: ym } },
    })
    if (existing) {
      const oldAmount = existing.amount
      await prisma.monthlyCost.update({
        where: { id: existing.id },
        data: { amount: newAmount, notes: `자동 재계산 (남은 거래 합)`, source: 'PDF_UPLOAD' },
      })
      console.log(`  MonthlyCost ${ym} 해외: ₩${oldAmount.toLocaleString()} → ₩${newAmount.toLocaleString()}`)
    }
  }
}

await prisma.$disconnect()
console.log('\n완료')
