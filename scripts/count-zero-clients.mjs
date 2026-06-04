import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 모든 매출 거래 거래처
const sales = await prisma.transaction.groupBy({
  by: ['clientId'],
  where: { type: 'SALE', clientId: { not: null } },
  _sum: { totalAmount: true },
  _count: true,
})
console.log(`매출 거래 발생 거래처: ${sales.length}곳`)

// 거래처별 AR 잔액 합
const allArs = await prisma.accountsReceivable.findMany({
  where: { clientId: { in: sales.map(s => s.clientId) } },
  select: { clientId: true, remainingAmount: true, status: true },
})

const byClient = new Map()
for (const ar of allArs) {
  if (!byClient.has(ar.clientId)) byClient.set(ar.clientId, { open: 0, paid: 0 })
  const e = byClient.get(ar.clientId)
  if (ar.status === 'PAID') e.paid += ar.remainingAmount  // 0이지만 확인용
  else e.open += ar.remainingAmount
}

let openCount = 0, zeroCount = 0, noArCount = 0
const zeroList = []
for (const s of sales) {
  const ent = byClient.get(s.clientId)
  if (!ent) { noArCount++; continue }
  if (ent.open > 0) openCount++
  else { zeroCount++; zeroList.push(s.clientId) }
}

console.log(`\n현재 미수금 있음 (페이지 노출): ${openCount}곳`)
console.log(`잔액 0 (페이지 미노출): ${zeroCount}곳`)
console.log(`AR 자체 없음: ${noArCount}곳`)

// 잔액 0 거래처 이름
const clients = await prisma.client.findMany({
  where: { id: { in: zeroList } },
  select: { id: true, name: true },
})
console.log(`\n=== 잔액 0 거래처 ${clients.length}곳 (상위 30) ===`)
for (const c of clients.slice(0, 30)) console.log(`  ${c.name}`)

await prisma.$disconnect()
