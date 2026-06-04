import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const total = await prisma.arPayment.count()
const fromIlgyepyo = await prisma.arPayment.count({
  where: { notes: { startsWith: '[일계표]' } },
})
const sumIl = await prisma.arPayment.aggregate({
  where: { notes: { startsWith: '[일계표]' } },
  _sum: { amount: true },
})

console.log(`전체 ArPayment: ${total}건`)
console.log(`일계표 입금: ${fromIlgyepyo}건 ₩${(sumIl._sum.amount ?? 0).toLocaleString()}`)

await prisma.$disconnect()
