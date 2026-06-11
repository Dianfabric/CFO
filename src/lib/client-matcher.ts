import { prisma } from './prisma'

// 거래처명 정규화 — 표기 변형을 흡수
// 예: "주식회사 다인에스앤디" / "(주)다인에스앤디" / "㈜다인에스앤디" → 모두 "다인에스앤디"
export function normalizeClientName(name: string): string {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')          // 괄호 안 텍스트 제거 (영문 등)
    .replace(/[\s\-_·.&/]/g, '')         // 공백/특수문자 제거
    .trim()
    .toUpperCase()
}

export type MatchType = 'exact' | 'alias' | 'fuzzy' | 'created' | 'none'
export interface ClientMatchResult {
  client: { id: string; name: string } | null
  matchType: MatchType
}

// 거래처 찾기 (exact → alias → fuzzy 정규화 매칭 → 옵션에 따라 자동 생성)
export async function findOrCreateClient(
  rawName: string,
  options: { autoCreate?: boolean; useFuzzy?: boolean; clientType?: 'CUSTOMER' | 'SUPPLIER' } = {},
): Promise<ClientMatchResult> {
  const name = String(rawName ?? '').trim()
  if (!name) return { client: null, matchType: 'none' }

  // 1) Exact match
  const exact = await prisma.client.findFirst({ where: { name }, select: { id: true, name: true } })
  if (exact) return { client: exact, matchType: 'exact' }

  // 2) Alias 사전
  const aliasHit = await prisma.clientAlias.findUnique({
    where: { alias: name },
    include: { client: { select: { id: true, name: true } } },
  })
  if (aliasHit?.client) return { client: aliasHit.client, matchType: 'alias' }

  // 3) Fuzzy 매칭 (정규화 후 비교)
  if (options.useFuzzy !== false) {
    const normalized = normalizeClientName(name)
    if (normalized.length >= 2) {
      const all = await prisma.client.findMany({ select: { id: true, name: true } })
      for (const c of all) {
        if (normalizeClientName(c.name) === normalized) {
          return { client: c, matchType: 'fuzzy' }
        }
      }
    }
  }

  // 4) 자동 생성
  if (options.autoCreate) {
    const created = await prisma.client.create({
      data: { name, type: options.clientType ?? 'CUSTOMER' },
      select: { id: true, name: true },
    })
    return { client: created, matchType: 'created' }
  }

  return { client: null, matchType: 'none' }
}

// 거래처에 AR이 없으면 0원 placeholder 매출 + AR 자동 생성
// 입금이 매출보다 먼저 들어와도 등록 가능 (음수 잔액 = 선수금)
export async function ensureClientAr(clientId: string): Promise<{ id: string }> {
  const existing = await prisma.accountsReceivable.findFirst({
    where: { clientId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (existing) return existing

  // placeholder — 통계/대시보드에서 제외되도록 description 패턴 고정
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
  const newAr = await prisma.accountsReceivable.create({
    data: {
      clientId,
      transactionId: placeholderTx.id,
      originalAmount: 0,
      remainingAmount: 0,
      status: 'PAID',
    },
    select: { id: true },
  })
  return newAr
}
