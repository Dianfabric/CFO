import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const gj = await prisma.client.findFirst({ where: { name: '지. 제이텍스타일' } })
if (!gj) { console.log('거래처 못 찾음'); process.exit(1) }
console.log(`거래처: ${gj.name} (${gj.id})\n`)

const tx = await prisma.transaction.findMany({
  where: {
    clientId: gj.id,
    type: 'SALE',
    date: { gte: new Date('2026-06-01'), lte: new Date('2026-06-30T23:59:59') },
  },
  include: { accountsReceivable: true, items: true },
  orderBy: { date: 'asc' },
})
console.log(`6월 매출 ${tx.length}건`)
for (const t of tx) {
  const itemsStr = t.items.map(i => `${i.productName} ${i.quantity}@${i.unitPrice}=${i.amount}`).join(' / ')
  console.log(`  ${t.date.toISOString().slice(0,10)} | ₩${t.totalAmount.toLocaleString()} | AR ${t.accountsReceivable.length > 0 ? '있음' : '❌'} | ${itemsStr}`)
}

// 입금 확인
console.log('\n=== 6월 입금 ===')
const ars = await prisma.accountsReceivable.findMany({
  where: { clientId: gj.id },
  include: { payments: { where: { paymentDate: { gte: new Date('2026-06-01'), lte: new Date('2026-06-30T23:59:59') } } } },
})
for (const ar of ars) {
  for (const p of ar.payments) {
    console.log(`  ${p.paymentDate.toISOString().slice(0,10)} | ₩${p.amount.toLocaleString()} | ${p.notes ?? ''}`)
  }
}

await prisma.$disconnect()
