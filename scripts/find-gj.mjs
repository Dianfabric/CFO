import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 거래처 검색 — '지제이' 또는 'GJ' 또는 '텍스타일'
const candidates = await prisma.client.findMany({
  where: {
    OR: [
      { name: { contains: '지제이' } },
      { name: { contains: '텍스타일' } },
      { name: { contains: 'GJ' } },
      { name: { contains: 'gj' } },
    ],
  },
  select: { id: true, name: true },
})
console.log('거래처 후보:')
for (const c of candidates) console.log(`  ${c.id} | ${c.name}`)

// 6/9 일자 모든 SALE 거래
console.log('\n=== 6/9 모든 SALE ===')
const tx = await prisma.transaction.findMany({
  where: {
    type: 'SALE',
    date: { gte: new Date('2026-06-09'), lte: new Date('2026-06-09T23:59:59') }
  },
  include: { client: { select: { name: true } }, accountsReceivable: true },
  orderBy: { client: { name: 'asc' } },
})
console.log(`총 ${tx.length}건`)
for (const t of tx) {
  console.log(`  ${t.client?.name ?? '-'} | ₩${t.totalAmount.toLocaleString()} | AR ${t.accountsReceivable.length > 0 ? '있음' : '❌'}`)
}

await prisma.$disconnect()
