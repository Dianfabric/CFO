// 부가세 포함가 보정 — Raw SQL 배치 처리 (single roundtrip)
// 보정 조건: type=SALE, description LIKE '일계표%', tax_amount > 0, total_amount === sum(items.amount)
// 이미 보정된 행 (total = itemSum + tax)은 자동 제외
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const DRY = process.argv.includes('--dry')

// 1) 보정 대상 ID + tax 수집
const targets = await prisma.$queryRaw`
  SELECT t.id AS tx_id, t.tax_amount AS tax, t.total_amount AS total
  FROM transactions t
  JOIN (SELECT transaction_id, SUM(amount)::int AS s FROM transaction_items GROUP BY transaction_id) i
    ON t.id = i.transaction_id
  WHERE t.type = 'SALE'
    AND t.description LIKE '일계표%'
    AND t.tax_amount > 0
    AND t.total_amount = i.s
`

console.log(`보정 대상: ${targets.length}건`)
const addedTotal = targets.reduce((s, r) => s + r.tax, 0)
console.log(`추가 매출 합계: ₩${addedTotal.toLocaleString()}`)

if (DRY) {
  console.log('\nDRY-RUN. 실제 적용: node scripts/fix-vat-batch.mjs')
  await prisma.$disconnect()
  process.exit(0)
}

if (targets.length === 0) {
  console.log('\n보정할 데이터 없음.')
  await prisma.$disconnect()
  process.exit(0)
}

// 2) Transaction.total_amount 갱신 — single SQL
const txUpdated = await prisma.$executeRaw`
  WITH item_sums AS (
    SELECT transaction_id, SUM(amount)::int AS s
    FROM transaction_items GROUP BY transaction_id
  )
  UPDATE transactions t
  SET total_amount = t.total_amount + t.tax_amount
  FROM item_sums i
  WHERE i.transaction_id = t.id
    AND t.type = 'SALE'
    AND t.description LIKE '일계표%'
    AND t.tax_amount > 0
    AND t.total_amount = i.s
`
console.log(`\nTransaction 갱신: ${txUpdated}건`)

// 3) AccountsReceivable 갱신 — original/remaining/status
// 대상 tx_id 리스트 ↓
const txIds = targets.map(t => t.tx_id)

// Postgres에서 IN(...) 처리: $queryRawUnsafe + 명시 array
const arUpdated = await prisma.$executeRawUnsafe(`
  WITH tax_map AS (
    SELECT id AS tx_id, tax_amount FROM transactions WHERE id = ANY($1::text[])
  ),
  paid_map AS (
    SELECT receivable_id, COALESCE(SUM(amount), 0)::int AS paid
    FROM ar_payments GROUP BY receivable_id
  )
  UPDATE accounts_receivable ar
  SET original_amount = ar.original_amount + tm.tax_amount,
      remaining_amount = GREATEST(0, (ar.original_amount + tm.tax_amount) - COALESCE(pm.paid, 0)),
      status = CASE
        WHEN GREATEST(0, (ar.original_amount + tm.tax_amount) - COALESCE(pm.paid, 0)) = 0 THEN 'PAID'
        WHEN COALESCE(pm.paid, 0) > 0 THEN 'PARTIAL'
        ELSE 'OUTSTANDING'
      END,
      updated_at = NOW()
  FROM tax_map tm
  LEFT JOIN paid_map pm ON pm.receivable_id = ar.id
  WHERE ar.transaction_id = tm.tx_id
`, txIds)
console.log(`AR 갱신: ${arUpdated}건`)

await prisma.$disconnect()
console.log('\n완료.')
