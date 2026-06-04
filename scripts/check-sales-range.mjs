import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const first = await prisma.transaction.findFirst({
  where: { type: 'SALE' },
  orderBy: { date: 'asc' },
  select: { date: true },
})
const last = await prisma.transaction.findFirst({
  where: { type: 'SALE' },
  orderBy: { date: 'desc' },
  select: { date: true },
})
const totalCount = await prisma.transaction.count({ where: { type: 'SALE' } })
const sumAgg = await prisma.transaction.aggregate({
  where: { type: 'SALE' },
  _sum: { totalAmount: true },
})

console.log(`=== 매출(SALE) 거래 전체 ===`)
console.log(`기간: ${first?.date.toISOString().slice(0,10)}  ~  ${last?.date.toISOString().slice(0,10)}`)
console.log(`건수: ${totalCount.toLocaleString()}건`)
console.log(`합계: ₩${(sumAgg._sum.totalAmount ?? 0).toLocaleString()}\n`)

// 월별 분포
const rows = await prisma.$queryRaw`
  SELECT to_char(date, 'YYYY-MM') as ym,
         count(*)::int as cnt,
         sum(total_amount)::bigint as total
  FROM cfo.transactions
  WHERE type = 'SALE'
  GROUP BY ym
  ORDER BY ym
`
console.log('=== 월별 매출 ===')
for (const r of rows) {
  console.log(`  ${r.ym}   ${String(r.cnt).padStart(5)}건   ₩${Number(r.total).toLocaleString().padStart(15)}`)
}

await prisma.$disconnect()
