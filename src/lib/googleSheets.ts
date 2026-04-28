// Google Sheets 2025 TMS 시트 구조:
// A열: 코드, B열: 브랜드, C열: 제품명, D열: 원단단가, E열: 소재, F열: 폭
// G열: 무게, H열: 원가(USD), I~M열: 가격정보, N열: 브랜드
export interface FabricPrice {
  name: string        // C열: 제품명
  price: number       // D열: 원단단가
  material: string    // E열: 소재
  width: string       // F열: 폭
  altName: string     // A열: 코드 (보조 검색용)
  brand: string       // N열: 브랜드
  dealerPrice: number // H열: 원가(USD)
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

export async function getUSDtoKRW(): Promise<number> {
  const now = Date.now()
  if (cachedRate && now - rateCacheTime < RATE_TTL) return cachedRate

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=KRW')
    const data = await res.json()
    const rate = data?.rates?.KRW
    if (rate && typeof rate === 'number') {
      cachedRate = rate
      rateCacheTime = now
      return rate
    }
  } catch {
    // 조회 실패 시 기본값 사용
  }

  return cachedRate ?? 1380 // fallback
}

export async function getFabricPrices(sheetName = '2025 TMS'): Promise<FabricPrice[]> {
  const now = Date.now()
  if (cachedPrices && now - cacheTime < CACHE_TTL) return cachedPrices

  const apiKey = process.env.GOOGLE_API_KEY
  const sheetId = process.env.SHEET_ID
  if (!apiKey || !sheetId) throw new Error('Google Sheets 환경변수가 설정되지 않았습니다')

  const range = encodeURIComponent(`${sheetName}!A:N`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`

  const res = await fetch(url)
  const data = await res.json()
  if (data.error) throw new Error(`Google Sheets 오류: ${data.error.message}`)

  const rows: string[][] = (data.values ?? []).slice(1) // 헤더 제외

  cachedPrices = rows
    .filter(r => r[2]?.trim()) // C열(제품명) 기준 필터
    .map(r => ({
      name: r[2]?.trim() ?? '',       // C열: 제품명
      price: parseSheetNum(r[3]),     // D열: 원단단가
      material: r[4]?.trim() ?? '',   // E열: 소재
      width: r[5]?.trim() ?? '',      // F열: 폭
      altName: r[0]?.trim() ?? '',    // A열: 코드 (보조 검색용)
      brand: r[13]?.trim() ?? '',     // N열: 브랜드
      dealerPrice: parseSheetNum(r[7]), // H열: 원가(USD)
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

function matchByKeyword(keyword: string, prices: FabricPrice[]): FabricPrice | null {
  const up = keyword.toUpperCase()

  // ① 완전일치
  const exact = prices.find(p =>
    p.name.toUpperCase() === up || p.altName.toUpperCase() === up
  )
  if (exact?.dealerPrice) return exact

  // ② 부분일치: 시트명/코드가 키워드를 포함하는 경우만 (dealerPrice 있는 것 우선)
  // 역방향(키워드가 시트명 포함)은 제외 — "마블-2"가 "마블"을 포함해 오매칭되는 문제 방지
  const partials = prices.filter(p =>
    p.name.toUpperCase().includes(up) ||
    (p.altName && p.altName.toUpperCase().includes(up))
  )
  const partial = partials.find(p => p.dealerPrice > 0) ?? partials[0]
  if (partial?.dealerPrice) return partial

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

function parseSheetNum(val: string | undefined): number {
  if (!val) return 0
  const n = parseFloat(val.replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}
