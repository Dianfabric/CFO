import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 음수 매출 SALE — AR 없는 것
const negSales = await prisma.transaction.findMany({
  where: { type: 'SALE', totalAmount: { lt: 0 } },
  include: { client: { select: { name: true } }, accountsReceivable: true, items: true },
  orderBy: { date: 'desc' },
  take: 30,
})
console.log(`음수 매출 SALE: ${negSales.length}건\n`)
for (const s of negSales) {
  const hasAr = s.accountsReceivable.length > 0
  console.log(`  ${s.date.toISOString().slice(0,10)} | ${s.client?.name ?? '-'} | ₩${s.totalAmount.toLocaleString()} | AR ${hasAr ? '있음' : '❌없음'} | "${s.description ?? ''}"`)
}

// 엘지커텐 전체
console.log('\n=== 엘지커텐 전체 SALE ===')
const lg = await prisma.client.findFirst({ where: { name: { contains: '엘지커텐' } } })
if (lg) {
  const tx = await prisma.transaction.findMany({
    where: { clientId: lg.id, type: 'SALE' },
    include: { accountsReceivable: true },
    orderBy: { date: 'desc' },
  })
  console.log(`엘지커텐 SALE ${tx.length}건`)
  for (const t of tx) {
    console.log(`  ${t.date.toISOString().slice(0,10)} | ₩${t.totalAmount.toLocaleString()} | AR ${t.accountsReceivable.length > 0 ? '있음' : '❌'}`)
  }
}

// 지제이텍스타일 6/9
console.log('\n=== 지제이텍스타일 6/9 ===')
const gj = await prisma.client.findFirst({ where: { name: { contains: '지제이' } } })
if (gj) {
  console.log(`거래처: ${gj.name}`)
  const tx = await prisma.transaction.findMany({
    where: {
      clientId: gj.id,
      type: 'SALE',
      date: { gte: new Date('2026-06-09'), lte: new Date('2026-06-09T23:59:59') }
    },
    include: { accountsReceivable: true, items: true },
  })
  console.log(`6/9 매출 ${tx.length}건`)
  for (const t of tx) {
    console.log(`  ₩${t.totalAmount.toLocaleString()} | AR ${t.accountsReceivable.length > 0 ? '있음' : '❌'} | ${t.description ?? ''}`)
  }
}

await prisma.$disconnect()
