// 잔액 일치 보정 롤백
// 사용: node scripts/rollback-balance-match.mjs <백업파일경로>

import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const file = process.argv[2]
if (!file) { console.error('백업 파일 경로 필요'); process.exit(1) }

const backup = JSON.parse(readFileSync(file, 'utf8'))
console.log(`백업 적용 시각: ${backup.appliedAt}`)
console.log(`생성된 Transaction: ${backup.createdTransactionIds.length}건`)
console.log(`생성된 Receivable:  ${backup.createdReceivableIds.length}건`)
console.log(`생성된 Payment:    ${backup.createdPaymentIds.length}건`)
console.log(`AR 스냅샷:        ${backup.arBalanceSnapshot.length}건`)

// 1. 보정으로 생성한 ArPayment 삭제
const delPay = await prisma.arPayment.deleteMany({
  where: { id: { in: backup.createdPaymentIds } },
})
console.log(`\nArPayment 삭제: ${delPay.count}건`)

// 2. 보정으로 생성한 AccountsReceivable 삭제 (payments cascade)
const delAr = await prisma.accountsReceivable.deleteMany({
  where: { id: { in: backup.createdReceivableIds } },
})
console.log(`AccountsReceivable 삭제: ${delAr.count}건`)

// 3. 보정으로 생성한 Transaction 삭제 (items cascade)
const delTx = await prisma.transaction.deleteMany({
  where: { id: { in: backup.createdTransactionIds } },
})
console.log(`Transaction 삭제: ${delTx.count}건`)

// 4. AR 잔액/상태 스냅샷으로 복원
let restored = 0
for (const snap of backup.arBalanceSnapshot) {
  try {
    await prisma.accountsReceivable.update({
      where: { id: snap.id },
      data: { remainingAmount: snap.remainingAmount, status: snap.status },
    })
    restored++
  } catch (e) {
    // 이미 삭제된 AR이면 skip
  }
}
console.log(`AR 잔액 복원: ${restored}건`)

await prisma.$disconnect()
console.log('\n롤백 완료.')
