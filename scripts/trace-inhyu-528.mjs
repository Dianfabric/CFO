import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 문제의 5/28 입금 상세
const target = await prisma.arPayment.findFirst({
  where: {
    paymentDate: { gte: new Date('2026-05-28'), lte: new Date('2026-05-28T23:59:59') },
    notes: { contains: '인휴' },
  },
  include: { receivable: { include: { client: true } } },
})
console.log('=== 5/28 (주)인휴 ArPayment ===')
if (target) {
  console.log(`  id: ${target.id}`)
  console.log(`  amount: ₩${target.amount.toLocaleString()}`)
  console.log(`  paymentDate: ${target.paymentDate.toISOString()}`)
  console.log(`  notes: "${target.notes}"`)
  console.log(`  createdAt: ${target.createdAt.toISOString()}`)
  console.log(`  paymentMethod: ${target.paymentMethod}`)
}

// 같은 날(5/28) 다른 거래처 입금도 같이 봐서 일계표 시트가 진짜 5/28이었는지 확인
console.log('\n=== 5/28 전체 일계표 입금 ArPayment ===')
const all528 = await prisma.arPayment.findMany({
  where: {
    paymentDate: { gte: new Date('2026-05-28'), lte: new Date('2026-05-28T23:59:59') },
    notes: { startsWith: '[일계표] 2026-05-28' },
  },
  include: { receivable: { include: { client: true } } },
  orderBy: { createdAt: 'asc' },
})
console.log(`총 ${all528.length}건`)
for (const p of all528) {
  console.log(`  ${p.receivable.client.name} | ₩${p.amount.toLocaleString()} | created ${p.createdAt.toISOString().slice(0,19)} | ${p.notes}`)
}

// 같은 createdAt 시점에 만들어진 입금들 — 같은 업로드 배치
if (target) {
  const window = new Date(target.createdAt.getTime() - 60000)
  const windowEnd = new Date(target.createdAt.getTime() + 60000)
  console.log('\n=== 같은 업로드 배치 (createdAt ±1분) ===')
  const batch = await prisma.arPayment.findMany({
    where: { createdAt: { gte: window, lte: windowEnd } },
    include: { receivable: { include: { client: true } } },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`총 ${batch.length}건`)
  for (const p of batch.slice(0, 20)) {
    console.log(`  ${p.receivable.client.name} | ₩${p.amount.toLocaleString()} | ${p.paymentDate.toISOString().slice(0,10)} | ${p.notes}`)
  }
  if (batch.length > 20) console.log(`  ... +${batch.length - 20}건 더`)
}

await prisma.$disconnect()
