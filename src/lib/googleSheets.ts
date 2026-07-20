import { prisma } from '@/lib/prisma'

// Google Sheets 2025 TMS 시트 구조:
// A열: 코드, B열: 브랜드, C열: 제품명, D열: 원단단가, E열: 소재, F열: 폭
// G열: 무게, H열: 원가(USD), I~M열: 가격정보, N열: 브랜드, O열: 보조검색(영문명 등)
export interface FabricPrice {
  name: string        // C열: 제품명
  price: number       // D열: 원단단가
  material: string    // E열: 소재
  width: string       // F열: 폭
  altName: string     // A열: 코드 (보조 검색용)
  brand: string       // N열: 브랜드
  dealerPrice: number // H열: 원가(USD)
  altName2: string    // O열: 보조검색 (영문명 등)
}

let cachedPrices: FabricPrice[] | null = null
let cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000

export function clearFabricCache() {
  cachedPrices = null
  cacheTime = 0
}

let cachedRate: number | null = null
let rateCacheTime = 0
const RATE_TTL = 60 * 60 * 1000 // 1시간 캐시
const FALLBACK_RATE = 1500 // API 실패·초기 대비 안전 기본값

// 실시간 USD→KRW 환율. open.er-api.com (무키·무료). 1시간 캐시.
// 실패해도 원가 계산이 절대 깨지지 않게: 마지막 캐시값 → 없으면 FALLBACK_RATE.
export async function getUSDtoKRW(): Promise<number> {
  const now = Date.now()
  if (cachedRate && now - rateCacheTime < RATE_TTL) return cachedRate
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    const krw = data?.rates?.KRW
    // 정상 범위(500~3000원) 검증 — 이상값이면 폴백
    if (typeof krw === 'number' && krw > 500 && krw < 3000) {
      cachedRate = Math.round(krw)
      rateCacheTime = now
      return cachedRate
    }
    throw new Error(`invalid KRW rate: ${krw}`)
  } catch (e) {
    console.error('[getUSDtoKRW] 환율 조회 실패, 폴백 사용:', (e as Error).message)
    return cachedRate ?? FALLBACK_RATE
  }
}

interface FabricMasterRow {
  product_name: string | null
  sell_price: number | string | null
  material: string | null
  width_mm: number | string | null
  brand: string | null
  cost_usd: number | string | null
  search_alias: string | null
  raw: Record<string, unknown> | null
}

export async function getFabricPrices(sheetName = '2025 TMS'): Promise<FabricPrice[]> {
  const now = Date.now()
  if (cachedPrices && now - cacheTime < CACHE_TTL) return cachedPrices

  // 2025 TMS → Supabase 전환.
  // 기존 getFabricPrices() 출력과 동일하게 raw 원본값 우선 사용한다.
  // source_tab='88683325'는 기존 2025 TMS 탭 snapshot.
  const rows = await prisma.$queryRawUnsafe<FabricMasterRow[]>(
    `SELECT product_name, sell_price, material, width_mm, brand, cost_usd, search_alias, raw
     FROM public.fabric_knowledge_master
     WHERE source_tab = '88683325' AND is_active IS NOT FALSE
     ORDER BY source_row ASC, product_name ASC`,
  )

  cachedPrices = rows
    .filter(r => getRawText(r, '제품명(중)', r.product_name))
    .map(r => ({
      name: getRawText(r, '제품명(중)', r.product_name),
      price: parseSheetNum(getRawValue(r, '원단단가/Y', r.sell_price)),
      material: getRawText(r, '소재', r.material),
      width: getRawText(r, '폭', r.width_mm),
      altName: getRawText(r, '코드', ''),
      brand: getRawText(r, '브랜드', r.brand),
      dealerPrice: parseSheetNum(getRawValue(r, '원가', r.cost_usd)),
      altName2: getRawText(r, '이름 보조 검색', r.search_alias),
    }))

  cacheTime = now
  return cachedPrices
}

/**
 * 경영박사 품명에서 검색 키워드 추출
 * 순수 숫자 괄호([02], [903])는 색상코드로 간주해 제외
 * 예) "넬리 [NELLY] [NE005]" → ["넬리", "NELLY", "NE005"]
 *     "마블-2 [MARBLE-2] [903]" → ["마블-2", "MARBLE-2"]
 */
function extractSearchKeywords(fabricName: string): string[] {
  // 1. 괄호 앞 텍스트 (가장 먼저 시도)
  const baseName = fabricName.replace(/\[.*/, '').trim()

  // 2. 괄호 내 텍스트 (순수 숫자 색상코드는 제외)
  const bracketKeywords: string[] = []
  const bracketRe = /\[([^\]]+)\]/g
  let m: RegExpExecArray | null
  while ((m = bracketRe.exec(fabricName)) !== null) {
    const content = m[1].trim()
    if (/^\d+$/.test(content)) continue  // "02", "104" 같은 순수 숫자는 색상코드
    bracketKeywords.push(content)
  }

  return [...new Set([baseName, ...bracketKeywords])].filter(Boolean)
}

// 하이픈·공백 제거 정규화 ("마블-2" → "마블2", "Load 1900" → "Load1900")
function norm(s: string): string {
  return s.replace(/[-\s]/g, '').toUpperCase()
}

function matchByKeyword(keyword: string, prices: FabricPrice[]): FabricPrice | null {
  const up = keyword.toUpperCase()
  const n = norm(keyword)

  // ① 완전일치 — 시트에 있으면 dealerPrice 없어도 반환
  const exact = prices.find(p =>
    p.name.toUpperCase() === up ||
    p.altName.toUpperCase() === up ||
    (p.altName2 && p.altName2.toUpperCase() === up)
  )
  if (exact) return exact

  // ② 정규화 완전일치: 하이픈·공백 차이 허용 ("마블-2" ↔ "마블2")
  const normExact = prices.find(p =>
    norm(p.name) === n ||
    (p.altName && norm(p.altName) === n) ||
    (p.altName2 && norm(p.altName2) === n)
  )
  if (normExact) return normExact

  // ③ 부분일치 (양방향, dealerPrice 있는 것 우선 / 없어도 반환)
  const partials = prices.filter(p =>
    p.name.toUpperCase().includes(up) || up.includes(p.name.toUpperCase()) ||
    (p.altName && (p.altName.toUpperCase().includes(up) || up.includes(p.altName.toUpperCase()))) ||
    (p.altName2 && (p.altName2.toUpperCase().includes(up) || up.includes(p.altName2.toUpperCase())))
  )
  const partial = partials.find(p => p.dealerPrice > 0) ?? partials[0]
  if (partial) return partial

  return null
}

export function findFabric(fabricName: string, prices: FabricPrice[]): FabricPrice | null {
  if (!fabricName || prices.length === 0) return null

  // BN 범위 매칭 유지
  const bnMatch = fabricName.match(/\[BN(\d+)\]/i)
  if (bnMatch) {
    const bnNum = parseInt(bnMatch[1], 10)
    const rangeEntry = prices.find(p => {
      const m = p.name.match(/(\d+)~(\d+)/)
      if (!m) return false
      return bnNum >= parseInt(m[1], 10) && bnNum <= parseInt(m[2], 10) && p.dealerPrice > 0
    })
    if (rangeEntry) return rangeEntry
  }

  for (const keyword of extractSearchKeywords(fabricName)) {
    const result = matchByKeyword(keyword, prices)
    if (result) return result
  }

  return null
}

export function findFabricCost(fabricName: string, prices: FabricPrice[]): number {
  const result = findFabric(fabricName, prices)
  return result?.dealerPrice ?? 0
}

function getRawValue(row: FabricMasterRow, key: string, fallback: unknown): unknown {
  const rawValue = row.raw?.[key]
  return rawValue ?? fallback
}

function getRawText(row: FabricMasterRow, key: string, fallback: unknown): string {
  const value = getRawValue(row, key, fallback)
  return value == null ? '' : String(value).trim()
}

function parseSheetNum(val: unknown): number {
  if (val == null) return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}
