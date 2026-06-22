// 미매칭 세금계산서 → 거래처 기준 매칭 (금액 무시, 가장 가까운 날짜 매출에 매칭)
// 사용법: node match-tax-by-client.mjs [dry-run|apply]
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const MODE = process.argv[2] || 'dry-run'
console.log(`Mode: ${MODE}`)

function normalize(name) {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s\-_·.&/]/g, '')
    .trim()
    .toUpperCase()
}

// 미매칭 세금계산서
const unmatched = await prisma.taxInvoice.findMany({
  where: { matchedTransactionId: null },
  include: { client: { select: { id: true, name: true } } },
  orderBy: { issueDate: 'asc' },
})

console.log(`\n미매칭 세금계산서: ${unmatched.length}건`)

// 거래처 없는 것은 fuzzy 매칭 시도
const clients = await prisma.client.findMany({ select: { id: true, name: true, businessNumber: true } })
const clientByBn = new Map()
const clientByName = new Map()
for (const c of clients) {
  if (c.businessNumber) clientByBn.set(c.businessNumber.replace(/-/g, ''), c)
  clientByName.set(normalize(c.name), c)
}

const stillNoClient = []
const clientResolved = []
for (const tx of unmatched) {
  let client = tx.client
  if (!client) {
    // 사업자번호 매칭
    if (tx.businessNumber) {
      const bn = tx.businessNumber.replace(/-/g, '')
      const c = clientByBn.get(bn)
      if (c) client = c
    }
    // 이름 매칭
    if (!client) {
      const norm = normalize(tx.clientNameRaw)
      const c = clientByName.get(norm)
      if (c) client = c
    }
    // fuzzy
    if (!client) {
      const norm = normalize(tx.clientNameRaw)
      if (norm.length >= 3) {
        for (const c of clients) {
          const cn = normalize(c.name)
          if (cn.includes(norm) || norm.includes(cn)) { client = c; break }
        }
      }
    }
  }
  if (client) clientResolved.push({ tx, client })
  else stillNoClient.push(tx)
}

console.log(`거래처 매칭됨: ${clientResolved.length}건`)
console.log(`거래처 매칭 실패: ${stillNoClient.length}건`)

// 거래처별 매출 미리 로드 (성능)
const clientIds = [...new Set(clientResolved.map(x => x.client.id))]
const allSales = await prisma.transaction.findMany({
  where: {
    clientId: { in: clientIds },
    type: 'SALE',
    description: { startsWith: '일계표 매출' },
  },
  select: { id: true, clientId: true, date: true, totalAmount: true, taxInvoices: { select: { id: true } } },
  orderBy: { date: 'asc' },
})

const salesByClient = new Map()
for (const s of allSales) {
  if (!salesByClient.has(s.clientId)) salesByClient.set(s.clientId, [])
  salesByClient.get(s.clientId).push(s)
}

// 각 미매칭 세금계산서를 가장 가까운 날짜의 매출에 매칭
// 이미 매칭된 매출도 또 매칭될 수 있음 (1매출:N세금계산서 가능)
const plan = []  // { tax, saleId, saleDate, daysDiff, isNewMatchForSale }

for (const { tx, client } of clientResolved) {
  const sales = salesByClient.get(client.id) ?? []
  if (sales.length === 0) {
    plan.push({ tx, client, saleId: null, reason: '해당 거래처 일계표 매출 없음' })
    continue
  }
  // 가장 가까운 날짜
  let best = null
  let bestDiff = Infinity
  for (const s of sales) {
    const diff = Math.abs(s.date.getTime() - tx.issueDate.getTime())
    if (diff < bestDiff) { bestDiff = diff; best = s }
  }
  plan.push({
    tx,
    client,
    saleId: best.id,
    saleDate: best.date,
    saleAmount: best.totalAmount,
    daysDiff: Math.round(bestDiff / 86400000),
    alreadyHasOther: best.taxInvoices.length > 0,
  })
}

// 통계
const willMatch = plan.filter(p => p.saleId)
const noSale = plan.filter(p => !p.saleId)
console.log(`\n=== 매칭 계획 ===`)
console.log(`✓ 매칭 가능: ${willMatch.length}건`)
console.log(`✗ 매칭 안 됨 (거래처에 매출 없음): ${noSale.length}건`)
console.log(`✗ 거래처 매칭 실패: ${stillNoClient.length}건`)

// 일자 차이 분포
const diffBuckets = { '±3일': 0, '±7일': 0, '±30일': 0, '±90일': 0, '90일+': 0 }
for (const p of willMatch) {
  if (p.daysDiff <= 3) diffBuckets['±3일']++
  else if (p.daysDiff <= 7) diffBuckets['±7일']++
  else if (p.daysDiff <= 30) diffBuckets['±30일']++
  else if (p.daysDiff <= 90) diffBuckets['±90일']++
  else diffBuckets['90일+']++
}
console.log('\n매출과의 일자 차이 분포:')
for (const [k, v] of Object.entries(diffBuckets)) console.log(`  ${k}: ${v}건`)

console.log('\n=== 매칭 계획 샘플 (TOP 30) ===')
for (const p of willMatch.slice(0, 30)) {
  console.log(
    `  ${p.tx.issueDate.toISOString().slice(0,10)} ${p.client.name.padEnd(25).slice(0,25)} 세금₩${p.tx.totalAmount.toLocaleString().padStart(12)} → 매출 ${p.saleDate.toISOString().slice(0,10)} ₩${p.saleAmount.toLocaleString().padStart(12)} (${p.daysDiff}일차)`
  )
}

if (stillNoClient.length > 0) {
  console.log(`\n=== 거래처 매칭 실패 ${stillNoClient.length}건 (이름) ===`)
  for (const t of stillNoClient.slice(0, 20)) {
    console.log(`  ${t.clientNameRaw} | 사업자: ${t.businessNumber ?? '-'} | ₩${t.totalAmount.toLocaleString()}`)
  }
}

// apply
if (MODE === 'apply') {
  console.log('\n=== 적용 중... ===')
  let applied = 0
  for (const p of willMatch) {
    await prisma.taxInvoice.update({
      where: { id: p.tx.id },
      data: { matchedTransactionId: p.saleId, status: 'MATCHED' },
    })
    applied++
  }
  console.log(`✓ ${applied}건 매칭 완료`)
}

await prisma.$disconnect()
