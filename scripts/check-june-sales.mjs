import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const start = new Date('2026-06-01T00:00:00')
const end = new Date('2026-06-30T23:59:59')

const all = await prisma.transaction.findMany({
  where: { type: 'SALE', date: { gte: start, lte: end } },
  select: { id: true, date: true, totalAmount: true, description: true },
  orderBy: { date: 'asc' },
})

const correction = all.filter(t => /이월 매출 보정|이월 매출 -/.test(t.description ?? ''))
const normal = all.filter(t => !/이월 매출 보정|이월 매출 -/.test(t.description ?? ''))

const sumCorr = correction.reduce((s, t) => s + t.totalAmount, 0)
const sumNorm = normal.reduce((s, t) => s + t.totalAmount, 0)
const sumAll = all.reduce((s, t) => s + t.totalAmount, 0)

console.log(`6월 총 매출 ${all.length}건 / ₩${sumAll.toLocaleString()}`)
console.log(`  이월 보정 ${correction.length}건 / ₩${sumCorr.toLocaleString()}`)
console.log(`  정상 매출 ${normal.length}건 / ₩${sumNorm.toLocaleString()}\n`)

const byDate = new Map()
for (const t of all) {
  const d = t.date.toISOString().slice(0, 10)
  if (!byDate.has(d)) byDate.set(d, { all: 0, corr: 0, norm: 0 })
  const e = byDate.get(d)
  e.all += t.totalAmount
  if (/이월 매출 보정|이월 매출 -/.test(t.description ?? '')) e.corr += t.totalAmount
  else e.norm += t.totalAmount
}
console.log('일자별:')
for (const [d, e] of Array.from(byDate.entries()).sort()) {
  console.log(`  ${d} | 합 ₩${e.all.toLocaleString().padStart(15)} | 보정 ₩${e.corr.toLocaleString().padStart(15)} | 정상 ₩${e.norm.toLocaleString().padStart(15)}`)
}

await prisma.$disconnect()
