// AR 부가세 포함 보정 (Transaction은 이미 보정 완료 가정)
// 보정 조건: ar.original_amount + tx.tax_amount === tx.total_amount → 아직 부가세 안 들어간 AR
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const DRY = process.argv.includes('--dry')

// 보정 대상 AR 미리 조회
const targets = await prisma.$queryRaw`
  SELECT ar.id AS ar_id, ar.original_amount AS orig, t.tax_amount AS tax, t.total_amount AS total,
         COALESCE((SELECT SUM(amount)::int FROM ar_payments WHERE receivable_id = ar.id), 0) AS paid
  FROM accounts_receivable ar
  JOIN transactions t ON t.id = ar.transaction_id
  WHERE t.type = 'SALE'
    AND t.description LIKE '일계표%'
    AND t.tax_amount > 0
    AND ar.original_amount + t.tax_amount = t.total_amount
`

console.log(`보정 대상 AR: ${targets.length}건`)
if (targets.length === 0) {
  console.log('보정할 AR 없음.')
  await prisma.$disconnect()
  process.exit(0)
}

if (DRY) {
  console.log('DRY-RUN.')
  await prisma.$disconnect()
  process.exit(0)
}

// 한 번의 SQL로 갱신 — correlated subquery 로 ar.id 참조
const updated = await prisma.$executeRaw`
  UPDATE accounts_receivable ar
  SET original_amount = ar.original_amount + t.tax_amount,
      remaining_amount = GREATEST(0, (ar.original_amount + t.tax_amount) - COALESCE((SELECT SUM(amount)::int FROM ar_payments WHERE receivable_id = ar.id), 0)),
      status = CASE
        WHEN GREATEST(0, (ar.original_amount + t.tax_amount) - COALESCE((SELECT SUM(amount)::int FROM ar_payments WHERE receivable_id = ar.id), 0)) = 0 THEN 'PAID'
        WHEN COALESCE((SELECT SUM(amount)::int FROM ar_payments WHERE receivable_id = ar.id), 0) > 0 THEN 'PARTIAL'
        ELSE 'OUTSTANDING'
      END,
      updated_at = NOW()
  FROM transactions t
  WHERE ar.transaction_id = t.id
    AND t.type = 'SALE'
    AND t.description LIKE '일계표%'
    AND t.tax_amount > 0
    AND ar.original_amount + t.tax_amount = t.total_amount
`

console.log(`AR 갱신: ${updated}건`)
await prisma.$disconnect()
