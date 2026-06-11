// 일계표 입금(ArPayment) 중 통장(BankTransaction) 매칭 없는 의심 데이터 점검
// 거래처명+금액+날짜(±3일) 기준 매칭
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const norm = (s) => String(s ?? '').replace(/주식회사|\(주\)|㈜|유한회사/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, '').trim().toUpperCase()

const payments = await prisma.arPayment.findMany({
  where: { notes: { startsWith: '[일계표]' } },
  include: { receivable: { include: { client: { include: { aliases: true } } } } },
  orderBy: { paymentDate: 'desc' },
})

const banks = await prisma.bankTransaction.findMany({
  where: { type: 'IN', status: { not: 'INTERNAL' } },  // 내부 이체 제외
})

console.log(`일계표 입금 총 ${payments.length}건 / 통장 입금 총 ${banks.length}건\n`)

// 거래처 별칭 맵
const aliasMap = new Map()
for (const p of payments) {
  for (const al of p.receivable.client.aliases ?? []) {
    aliasMap.set(norm(al.alias), p.receivable.clientId)
  }
  aliasMap.set(norm(p.receivable.client.name), p.receivable.clientId)
}

const suspects = []
const used = new Set()

for (const p of payments) {
  const clientId = p.receivable.clientId
  const cName = p.receivable.client.name
  const cNorm = norm(cName)
  const payDate = p.paymentDate

  // 통장에서 ±3일, 같은 금액 매칭 시도
  let matched = false
  for (let i = 0; i < banks.length; i++) {
    if (used.has(i)) continue
    const b = banks[i]
    if (b.amount !== p.amount) continue
    const diffDays = Math.abs((b.txDateTime.getTime() - payDate.getTime()) / 86400000)
    if (diffDays > 5) continue
    // 거래처 매칭: bank.clientId 또는 raw 거래처명
    const bNorm = norm(b.rawCounterparty || b.rawDescription)
    if (b.clientId === clientId || bNorm.includes(cNorm) || cNorm.includes(bNorm) || aliasMap.get(bNorm) === clientId) {
      used.add(i)
      matched = true
      break
    }
  }

  if (!matched) {
    suspects.push({
      id: p.id,
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
      clientName: cName,
      amount: p.amount,
      notes: p.notes,
      createdAt: p.createdAt.toISOString().slice(0, 10),
    })
  }
}

console.log(`=== 통장 매칭 안 된 일계표 입금: ${suspects.length}건 ===\n`)
console.log('(통장 입금이 아예 없는 거래처일 수도 있으니 의심 후보로만 표시)\n')

// 거래처별 그룹
const byClient = new Map()
for (const s of suspects) {
  if (!byClient.has(s.clientName)) byClient.set(s.clientName, [])
  byClient.get(s.clientName).push(s)
}

const sortedClients = [...byClient.entries()].sort((a, b) => b[1].length - a[1].length)
console.log('거래처별 (의심 건수 많은 순):')
for (const [name, list] of sortedClients.slice(0, 30)) {
  const total = list.reduce((s, x) => s + x.amount, 0)
  console.log(`  ${name} — ${list.length}건 / 합 ₩${total.toLocaleString()}`)
}

// 합계
const totalAmount = suspects.reduce((s, x) => s + x.amount, 0)
console.log(`\n총 의심 금액: ₩${totalAmount.toLocaleString()} (${suspects.length}건)`)

// JSON 저장
import fs from 'fs'
fs.writeFileSync(
  'D:/CFO/scripts/backup/audit-suspects.json',
  JSON.stringify(suspects, null, 2),
  'utf-8',
)
console.log('\n전체 리스트는 scripts/backup/audit-suspects.json 에 저장됨')

await prisma.$disconnect()
