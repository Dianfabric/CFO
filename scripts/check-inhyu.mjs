import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const inhyu = await prisma.client.findFirst({
  where: { name: { contains: '인휴' } },
})
if (!inhyu) { console.log('거래처 못 찾음'); process.exit(1) }
console.log(`거래처: ${inhyu.name} (${inhyu.id})\n`)

// 전체 매출
const tx = await prisma.transaction.findMany({
  where: { clientId: inhyu.id, type: 'SALE' },
  include: { accountsReceivable: { include: { payments: true } }, items: true },
  orderBy: { date: 'asc' },
})
console.log(`=== 전체 SALE ${tx.length}건 ===`)
for (const t of tx) {
  const ar = t.accountsReceivable[0]
  const payTotal = ar?.payments.reduce((s, p) => s + p.amount, 0) ?? 0
  console.log(`  ${t.date.toISOString().slice(0,10)} | ₩${t.totalAmount.toLocaleString()} | AR ${ar ? '있음' : '❌'} | 입금합 ₩${payTotal.toLocaleString()}`)
  if (ar) {
    for (const p of ar.payments) {
      console.log(`     └ ${p.paymentDate.toISOString().slice(0,10)} ₩${p.amount.toLocaleString()} | ${p.notes ?? ''}`)
    }
  }
}

// 5/28 일계표 입금 검색
console.log('\n=== 5/28 입금 ArPayment 모두 ===')
const day28 = await prisma.arPayment.findMany({
  where: {
    paymentDate: { gte: new Date('2026-05-28'), lte: new Date('2026-05-28T23:59:59') },
  },
  include: { receivable: { include: { client: true, transaction: true } } },
})
for (const p of day28) {
  if (p.receivable.clientId === inhyu.id) {
    console.log(`  ${p.receivable.client.name} | ₩${p.amount.toLocaleString()} | AR 매출일: ${p.receivable.transaction.date.toISOString().slice(0,10)} ₩${p.receivable.transaction.totalAmount.toLocaleString()} | ${p.notes ?? ''}`)
  }
}

// 5/28 (주)인휴 일계표에 외출이 있었는지 (description 기준)
console.log('\n=== 인휴 매출 중 5월 ===')
const may = await prisma.transaction.findMany({
  where: {
    clientId: inhyu.id,
    type: 'SALE',
    date: { gte: new Date('2026-05-01'), lte: new Date('2026-05-31T23:59:59') },
  },
  include: { items: true },
})
for (const t of may) {
  console.log(`  ${t.date.toISOString().slice(0,10)} | ₩${t.totalAmount.toLocaleString()} | items ${t.items.length}건`)
}

await prisma.$disconnect()
