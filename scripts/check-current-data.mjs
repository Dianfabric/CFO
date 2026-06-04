import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const sales = await prisma.transaction.count({ where: { type: 'SALE' } })
const ar = await prisma.accountsReceivable.count()
const arOutstanding = await prisma.accountsReceivable.count({ where: { status: { in: ['OUTSTANDING', 'PARTIAL', 'OVERDUE'] } } })

const range = await prisma.transaction.findMany({
  where: { type: 'SALE' },
  orderBy: [{ date: 'asc' }],
  take: 1,
  select: { date: true },
})
const last = await prisma.transaction.findFirst({
  where: { type: 'SALE' },
  orderBy: [{ date: 'desc' }],
  select: { date: true },
})

console.log(`SALE 거래 ${sales}건`)
console.log(`AR 전체 ${ar}건 (OUTSTANDING/PARTIAL/OVERDUE: ${arOutstanding}건)`)
if (range[0] && last) {
  console.log(`기간: ${range[0].date.toISOString().slice(0,10)} ~ ${last.date.toISOString().slice(0,10)}`)
}

// 월별
const byMonth = await prisma.$queryRaw`
  SELECT to_char(date, 'YYYY-MM') as ym, count(*)::int as cnt, sum(total_amount)::bigint as total
  FROM cfo.transactions WHERE type='SALE' GROUP BY ym ORDER BY ym
`
console.log('\n월별:')
for (const r of byMonth) console.log(`  ${r.ym}  ${r.cnt}건  ₩${Number(r.total).toLocaleString()}`)

// 담당자 분포
const persons = await prisma.$queryRaw`
  SELECT COALESCE(sales_person, '(미지정)') as p, count(*)::int as cnt
  FROM cfo.transactions WHERE type='SALE'
  GROUP BY p ORDER BY cnt DESC
`
console.log('\n담당자 분포:')
for (const r of persons) console.log(`  ${r.p}: ${r.cnt}건`)

await prisma.$disconnect()
