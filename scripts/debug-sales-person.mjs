import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 1) 마감 엑셀이 처리됐는지 — industry/material 등이 채워진 item 있는지 확인
const taggedItems = await prisma.transactionItem.count({
  where: {
    OR: [
      { industry: { not: null } },
      { productCategory: { not: null } },
      { processFunction: { not: null } },
      { material: { not: null } },
    ],
  },
})
console.log(`메타(직군/제품/가공/재료) 채워진 item: ${taggedItems}건`)

// 2) salesPerson 채워진 거래
const personFilled = await prisma.transaction.count({
  where: { type: 'SALE', salesPerson: { not: null } },
})
console.log(`담당자 채워진 SALE: ${personFilled}건`)

// 3) 6/2 SALE 거래 샘플 — 마감 엑셀과 매칭 가능한 거 있는지
const day0602 = await prisma.transaction.findMany({
  where: {
    type: 'SALE',
    date: { gte: new Date('2026-06-02T00:00:00'), lte: new Date('2026-06-02T23:59:59') },
  },
  include: { items: true, client: { select: { name: true } } },
  take: 3,
})
console.log(`\n2026-06-02 SALE 거래 ${day0602.length}건 (샘플 3건):`)
for (const tx of day0602) {
  console.log(`\n  [${tx.id.slice(-6)}] ${tx.client?.name}  ₩${tx.totalAmount.toLocaleString()}  salesPerson=${tx.salesPerson}`)
  for (const it of tx.items) {
    console.log(`    - ${it.productName} ${it.quantity}개  industry=${it.industry} category=${it.productCategory} mat=${it.material}`)
  }
}

await prisma.$disconnect()
