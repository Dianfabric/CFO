// 일계표에는 있는데 DB에 없는 입금 29건 백필
// reconcile-report.json 의 deposits.onlyExpected 사용
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const report = JSON.parse(readFileSync('D:/CFO/scripts/backup/reconcile-report.json', 'utf-8'))
const missing = report.diff.deposits.onlyExpected

console.log(`백필 대상 입금: ${missing.length}건 (key 단위)\n`)

let added = 0
let skipped = 0
const skipReasons = []

async function recalcClient(clientId) {
  const ars = await prisma.accountsReceivable.findMany({
    where: { clientId },
    include: { payments: { select: { amount: true } } },
  })
  for (const ar of ars) {
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

const touchedClients = new Set()

for (const item of missing) {
  const [dateStr, clientName, amountStr] = item.key.split('|')
  const amount = parseInt(amountStr)
  const count = item.count  // 같은 (날짜+거래처+금액)이 N건일 수 있음

  // 거래처 찾기 (exact match)
  const client = await prisma.client.findFirst({ where: { name: clientName } })
  if (!client) {
    skipped += count
    skipReasons.push(`거래처 못 찾음: ${clientName}`)
    console.log(`  ❌ ${dateStr} | ${clientName} | ₩${amount.toLocaleString()} ×${count} — 거래처 못 찾음`)
    continue
  }

  // 가장 오래된 AR
  const targetAr = await prisma.accountsReceivable.findFirst({
    where: { clientId: client.id },
    orderBy: { createdAt: 'asc' },
  })
  if (!targetAr) {
    skipped += count
    skipReasons.push(`AR 없음: ${clientName}`)
    console.log(`  ❌ ${dateStr} | ${clientName} | ₩${amount.toLocaleString()} ×${count} — AR 없음 (매출 0)`)
    continue
  }

  // 같은 (날짜+거래처+금액) ArPayment 이미 있는지 확인
  const dayStart = new Date(dateStr + 'T00:00:00')
  const dayEnd = new Date(dateStr + 'T23:59:59')
  const existed = await prisma.arPayment.findMany({
    where: {
      paymentDate: { gte: dayStart, lte: dayEnd },
      amount,
      receivable: { clientId: client.id },
    },
  })
  const toAdd = count - existed.length
  if (toAdd <= 0) {
    console.log(`  ⏭ ${dateStr} | ${clientName} | ₩${amount.toLocaleString()} — 이미 있음 (skip)`)
    continue
  }

  const payDate = new Date(dateStr + 'T12:00:00')
  for (let i = 0; i < toAdd; i++) {
    await prisma.arPayment.create({
      data: {
        receivableId: targetAr.id,
        amount,
        paymentDate: payDate,
        paymentMethod: '입금',
        notes: `[일계표] ${dateStr} | ${clientName}`,
      },
    })
    added++
    console.log(`  ✓ ${dateStr} | ${clientName} | ₩${amount.toLocaleString()}`)
  }
  touchedClients.add(client.id)
}

// 거래처별 잔액 재계산
console.log(`\n=== ${touchedClients.size}개 거래처 잔액 재계산 ===`)
for (const cid of touchedClients) {
  await recalcClient(cid)
}

console.log(`\n=== 결과 ===`)
console.log(`추가: ${added}건`)
console.log(`skip: ${skipped}건`)
if (skipReasons.length > 0) {
  console.log(`\nskip 사유:`)
  for (const r of skipReasons) console.log(`  - ${r}`)
}

await prisma.$disconnect()
