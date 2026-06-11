// 방금 backfill-missing-deposits.mjs 가 추가한 15건 롤백
// 조건: 최근 30분 이내 + notes [일계표] + 정확한 (date, client, amount) 매칭
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TARGETS = [
  { date: '2026-03-03', client: '디안몰', amount: 4000 },
  { date: '2026-03-05', client: '나인투세븐', amount: 169400 },
  { date: '2026-03-06', client: '태성가구', amount: 681900 },
  { date: '2026-03-25', client: '성당방석', amount: 123200 },
  { date: '2026-03-30', client: '바치', amount: 99000 },
  { date: '2026-03-30', client: '바치', amount: 22550 },
  { date: '2026-04-08', client: '믿음쇼파', amount: 9100 },
  { date: '2026-04-10', client: '(주)켄타', amount: 10000000 },
  { date: '2026-04-10', client: '(주)켄타', amount: 5805625 },
  { date: '2026-04-16', client: '드림패브릭', amount: 660000 },
  { date: '2026-05-02', client: '(주)인휴', amount: 279400 },
  { date: '2026-05-19', client: '꾸밈방', amount: 45000 },
  { date: '2026-05-29', client: '(주)비트스타일링', amount: 633600 },
  { date: '2026-06-01', client: '주식회사 이네딧', amount: 469700 },
  { date: '2026-06-04', client: '(주)인휴', amount: 1850000 },
]

const cutoff = new Date(Date.now() - 30 * 60 * 1000)  // 30분 전
let deleted = 0
const touchedClients = new Set()

for (const t of TARGETS) {
  const dayStart = new Date(t.date + 'T00:00:00')
  const dayEnd = new Date(t.date + 'T23:59:59')

  const candidates = await prisma.arPayment.findMany({
    where: {
      paymentDate: { gte: dayStart, lte: dayEnd },
      amount: t.amount,
      createdAt: { gte: cutoff },
      notes: { startsWith: `[일계표] ${t.date} | ${t.client}` },
      receivable: { client: { name: t.client } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (candidates.length === 0) {
    console.log(`  ⚠ 못 찾음: ${t.date} | ${t.client} | ₩${t.amount.toLocaleString()}`)
    continue
  }
  // 가장 최근 1건만 삭제 (백필이 만든 것)
  const target = candidates[0]
  await prisma.arPayment.delete({ where: { id: target.id } })
  touchedClients.add(target.receivableId)
  deleted++
  console.log(`  ✗ ${t.date} | ${t.client} | ₩${t.amount.toLocaleString()} 삭제`)
}

// 잔액 재계산
const arIds = [...touchedClients]
const ars = await prisma.accountsReceivable.findMany({ where: { id: { in: arIds } } })
const clientIds = [...new Set(ars.map(ar => ar.clientId))]
for (const cid of clientIds) {
  const all = await prisma.accountsReceivable.findMany({
    where: { clientId: cid },
    include: { payments: { select: { amount: true } } },
  })
  for (const ar of all) {
    const paid = ar.payments.reduce((s, p) => s + p.amount, 0)
    const rem = Math.max(0, ar.originalAmount - paid)
    const status = rem === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OUTSTANDING'
    if (rem !== ar.remainingAmount || status !== ar.status) {
      await prisma.accountsReceivable.update({
        where: { id: ar.id },
        data: { remainingAmount: rem, status },
      })
    }
  }
}

console.log(`\n총 ${deleted}건 롤백 완료`)
await prisma.$disconnect()
