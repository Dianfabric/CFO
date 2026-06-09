import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const total = await prisma.transactionItem.count()
const withMeta = await prisma.transactionItem.count({
  where: { OR: [
    { industry: { not: null } },
    { productCategory: { not: null } },
    { processFunction: { not: null } },
    { material: { not: null } },
  ] },
})

const txTotal = await prisma.transaction.count({ where: { type: 'SALE' } })
const txWithPerson = await prisma.transaction.count({ where: { type: 'SALE', salesPerson: { not: null } } })

console.log(`TransactionItem 총 ${total}건, 메타 채워진 것 ${withMeta}건`)
console.log(`SALE Transaction 총 ${txTotal}건, 담당자 지정된 것 ${txWithPerson}건`)

await prisma.$disconnect()
