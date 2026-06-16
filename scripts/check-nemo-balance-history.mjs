// 네모팽이 6/3 보정 백업 + 모든 SALE/PAY 의 description/notes 확인
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 1. 6/3 보정 백업에서 네모팽이 확인
const backup = JSON.parse(readFileSync('D:/CFO/scripts/backup/balance-match-2026-06-04.json', 'utf-8'))
const carryover = JSON.parse(readFileSync('D:/CFO/scripts/backup/carryover-sales-2026-02-28.json', 'utf-8'))

console.log('=== 6/3 보정 백업의 네모팽이 ===')
if (Array.isArray(backup)) {
  for (const b of backup) {
    if (JSON.stringify(b).includes('네모팽이')) {
      console.log(JSON.stringify(b, null, 2))
    }
  }
} else {
  // object 구조 확인
  console.log('Backup type:', typeof backup, Object.keys(backup).slice(0, 5))
  if (backup.adjustments) {
    const nemo = backup.adjustments.filter(a => (a.clientName ?? '').includes('네모팽이'))
    for (const a of nemo) console.log(a)
  }
}

console.log('\n=== 이월 매출 보정 백업 (2/28) — 네모팽이 ===')
if (Array.isArray(carryover)) {
  for (const c of carryover) {
    if (JSON.stringify(c).includes('네모팽이')) {
      console.log(JSON.stringify(c, null, 2))
    }
  }
}

// 2. 네모팽이 DB 매출의 description별 분류
console.log('\n\n=== 네모팽이 DB 모든 SALE description ===')
const nemo = await prisma.client.findFirst({ where: { name: '주식회사 네모팽이' } })
const allSales = await prisma.transaction.findMany({
  where: { clientId: nemo.id, type: 'SALE' },
  include: { accountsReceivable: true },
  orderBy: { date: 'asc' },
})
for (const t of allSales) {
  const ar = t.accountsReceivable[0]
  console.log(`  ${t.date.toISOString().slice(0,10)} | ${t.totalAmount.toLocaleString().padStart(12)} | "${t.description}"`)
}

console.log('\n=== 네모팽이 DB 모든 ArPayment notes ===')
const allPays = await prisma.arPayment.findMany({
  where: { receivable: { clientId: nemo.id } },
  orderBy: { paymentDate: 'asc' },
})
for (const p of allPays) {
  console.log(`  ${p.paymentDate.toISOString().slice(0,10)} | ${p.amount.toLocaleString().padStart(12)} | "${p.notes ?? ''}"`)
}

await prisma.$disconnect()
