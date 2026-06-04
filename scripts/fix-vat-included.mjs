// 일계표로 등록된 SALE 거래의 totalAmount/AR을 부가세 포함가로 보정
// 기준:
//   - description startsWith '일계표' (또는 V11 import 동일 패턴)
//   - taxAmount > 0
//   - totalAmount === items.amount 합 (= 아직 부가세 포함되지 않은 상태)
// 액션:
//   - Transaction.totalAmount += taxAmount
//   - AccountsReceivable.originalAmount += taxAmount
//   - AccountsReceivable.remainingAmount = newOriginal - paidSum (재계산)
//   - AccountsReceivable.status 재계산

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const DRY = process.argv.includes('--dry')

const sales = await prisma.transaction.findMany({
  where: {
    type: 'SALE',
    description: { startsWith: '일계표' },
    taxAmount: { gt: 0 },
  },
  include: { items: true },
})

console.log(`대상 후보: ${sales.length}건  ${DRY ? '(DRY-RUN)' : '(실제 보정)'}\n`)

let fixed = 0, skipped = 0, arFixed = 0
let addedTotal = 0

for (const tx of sales) {
  const itemSum = tx.items.reduce((s, it) => s + it.amount, 0)
  // 이미 부가세 포함된 경우: total ≈ itemSum + tax → skip
  // 부가세 별도인 경우: total === itemSum
  if (tx.totalAmount !== itemSum) {
    skipped++
    continue
  }

  const newTotal = tx.totalAmount + tx.taxAmount
  addedTotal += tx.taxAmount

  if (!DRY) {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { totalAmount: newTotal },
    })

    // AR 보정
    const ars = await prisma.accountsReceivable.findMany({
      where: { transactionId: tx.id },
      include: { payments: true },
    })
    for (const ar of ars) {
      const paid = ar.payments.reduce((s, p) => s + p.amount, 0)
      const newOriginal = ar.originalAmount + tx.taxAmount
      const newRemaining = Math.max(0, newOriginal - paid)
      let newStatus = 'OUTSTANDING'
      if (newRemaining === 0) newStatus = 'PAID'
      else if (paid > 0) newStatus = 'PARTIAL'

      await prisma.accountsReceivable.update({
        where: { id: ar.id },
        data: {
          originalAmount: newOriginal,
          remainingAmount: newRemaining,
          status: newStatus,
        },
      })
      arFixed++
    }
  }
  fixed++
}

console.log(`Transaction 보정: ${fixed}건  (skip ${skipped}건 — 이미 부가세 포함)`)
console.log(`AR 보정: ${arFixed}건`)
console.log(`추가 매출 합계: ₩${addedTotal.toLocaleString()}`)
console.log(DRY ? '\n실제 적용하려면: node scripts/fix-vat-included.mjs' : '\n완료.')

await prisma.$disconnect()
