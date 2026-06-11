// 거래처가 DB에 없는 14건 입금 백필 — 거래처 자동 생성 + 선수금 placeholder AR
// 새 client-matcher 로직과 동일하게 처리
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function normalize(name) {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s\-_·.&/]/g, '')
    .trim()
    .toUpperCase()
}

async function findOrCreate(rawName) {
  const name = rawName.trim()
  if (!name) return null

  // exact
  const exact = await prisma.client.findFirst({ where: { name } })
  if (exact) return { client: exact, matchType: 'exact' }

  // alias
  const alias = await prisma.clientAlias.findUnique({ where: { alias: name } })
  if (alias) {
    const c = await prisma.client.findUnique({ where: { id: alias.clientId } })
    if (c) return { client: c, matchType: 'alias' }
  }

  // fuzzy (normalized)
  const norm = normalize(name)
  if (norm.length >= 2) {
    const all = await prisma.client.findMany({ select: { id: true, name: true } })
    for (const c of all) {
      if (normalize(c.name) === norm) return { client: c, matchType: 'fuzzy' }
    }
  }

  // create
  const created = await prisma.client.create({
    data: { name, type: 'CUSTOMER' },
  })
  return { client: created, matchType: 'created' }
}

async function ensureAr(clientId) {
  const existing = await prisma.accountsReceivable.findFirst({
    where: { clientId },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return existing

  const placeholderTx = await prisma.transaction.create({
    data: {
      date: new Date(),
      type: 'SALE',
      clientId,
      description: '선수금 placeholder',
      totalAmount: 0,
      taxAmount: 0,
      paymentMethod: 'CREDIT',
      paymentStatus: 'PAID',
      channel: 'B2B',
    },
  })
  return await prisma.accountsReceivable.create({
    data: {
      clientId,
      transactionId: placeholderTx.id,
      originalAmount: 0,
      remainingAmount: 0,
      status: 'PAID',
    },
  })
}

const TARGETS = [
  { date: '2026-03-03', client: '아키테그(ARKITAG)', amount: 3553000 },
  { date: '2026-03-03', client: '에스엠인터네셔날 주식회사', amount: 299200 },
  { date: '2026-03-03', client: '헤이릭스', amount: 2398000 },
  { date: '2026-03-04', client: '소노', amount: 814000 },
  { date: '2026-03-05', client: '리도', amount: 1174800 },
  { date: '2026-03-06', client: '한성아이디', amount: 86900 },
  { date: '2026-03-20', client: '까사 자연', amount: 712250 },
  { date: '2026-03-20', client: '주식회사 다인에스앤디', amount: 2200000 },
  { date: '2026-03-31', client: '스페이스 27(Space27)', amount: 880000 },
  { date: '2026-03-31', client: '(주)팁 TIPP', amount: 398200 },
  { date: '2026-03-31', client: '(주) 심플라인', amount: 222200 },
  { date: '2026-04-07', client: '디자인 뷰', amount: 272800 },
  { date: '2026-04-10', client: '(주)피제이디자인', amount: 1540000 },
  { date: '2026-05-29', client: '(주) 파르나스 호텔', amount: 429000 },
]

let added = 0
const touchedClients = new Set()
const stats = { exact: 0, alias: 0, fuzzy: 0, created: 0 }

for (const t of TARGETS) {
  const result = await findOrCreate(t.client)
  if (!result) {
    console.log(`  ❌ 거래처 매칭/생성 실패: ${t.client}`)
    continue
  }
  stats[result.matchType]++
  const tag = result.matchType === 'created' ? '🆕 신규' : result.matchType === 'fuzzy' ? '🔎 fuzzy' : '✓'

  const ar = await ensureAr(result.client.id)

  // 중복 체크
  const dayStart = new Date(t.date + 'T00:00:00')
  const dayEnd = new Date(t.date + 'T23:59:59')
  const existed = await prisma.arPayment.findFirst({
    where: {
      paymentDate: { gte: dayStart, lte: dayEnd },
      amount: t.amount,
      receivable: { clientId: result.client.id },
      notes: { startsWith: '[일계표]' },
    },
  })
  if (existed) {
    console.log(`  ⏭ ${t.date} | ${t.client} → ${result.client.name} | ₩${t.amount.toLocaleString()} (이미 있음)`)
    continue
  }

  await prisma.arPayment.create({
    data: {
      receivableId: ar.id,
      amount: t.amount,
      paymentDate: new Date(t.date + 'T12:00:00'),
      paymentMethod: '입금',
      notes: `[일계표] ${t.date} | ${t.client}`,
    },
  })
  touchedClients.add(result.client.id)
  added++
  console.log(`  ${tag} ${t.date} | ${t.client} → ${result.client.name} | ₩${t.amount.toLocaleString()}`)
}

// 잔액 재계산
console.log(`\n=== ${touchedClients.size}개 거래처 잔액 재계산 ===`)
for (const cid of touchedClients) {
  const ars = await prisma.accountsReceivable.findMany({
    where: { clientId: cid },
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

console.log(`\n=== 결과 ===`)
console.log(`추가: ${added}건`)
console.log(`매칭 유형: exact ${stats.exact} / alias ${stats.alias} / fuzzy ${stats.fuzzy} / 신규생성 ${stats.created}`)

await prisma.$disconnect()
