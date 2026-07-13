/**
 * 월중 예상(포캐스트) 헬퍼 — 대표 지시 2026-07-13
 *
 * 매출·판매원가·국내배송은 일계표로 매일 실측 → 영업일 페이스(D/d)로 말일 투영.
 * 월말에야 입력되는 것(월말 원가 = 운임·관세·가공계산서, 변동비, 고정비, 이자,
 * 법인 매출·매입·비용)은 지난 6개월 평균으로 추정.
 * 이미 도착한 실측이 평균 추정을 넘으면 실측을 쓴다 — estOr(actual, est).
 * '오늘까지' 값은 평균의 경과 비율(d/D)만 반영해 일할 계산.
 */

export interface FcCtx {
  d: number // 이번 달 경과 영업일 (오늘 포함)
  D: number // 이번 달 전체 영업일
  pace: number // D/d — 말일 투영 배수
  ratio: number // d/D — 오늘까지 비율
}

function isBizDay(dt: Date): boolean {
  const g = dt.getDay()
  return g !== 0 && g !== 6
}

/** 이번 달 영업일 경과/전체 (todayYmd = YYYY-MM-DD, KST) */
export function makeFcCtx(todayYmd: string): FcCtx {
  const [y, m, dd] = todayYmd.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  let d = 0
  let D = 0
  for (let i = 1; i <= last; i++) {
    if (!isBizDay(new Date(y, m - 1, i))) continue
    D++
    if (i <= dd) d++
  }
  if (d === 0) d = 1 // 월초가 휴일이면 최소 1일로 가드
  return { d, D, pace: D / d, ratio: d / D }
}

/** 지난 6개 '완결된' 달의 범위 (7월이면 1/1~6/30 — 롤링) */
export function prev6Range(todayYmd: string): { start: string; end: string } {
  const [y, m] = todayYmd.split('-').map(Number)
  const endD = new Date(y, m - 1, 0) // 지난달 말일
  const startD = new Date(y, m - 7, 1) // 6개월 전 1일
  const f = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  return { start: f(startD), end: f(endD) }
}

/** 실측이 평균 추정을 넘으면 실측 (이미 도착한 자료 존중) */
export function estOr(actual: number, est: number): number {
  return Math.max(Math.round(actual), Math.round(est))
}

export interface FcChain {
  revenue: number
  cogs: number
  variable: number
  fixed: number
  nonOp: number
  gross: number
  contribution: number
  operating: number
  net: number
  bep: number | null
  bepRate: number | null
}

/** 매출·비용 5요소에서 손익 사슬 파생 (기존 chain 계산과 동일 규칙) */
export function deriveChain(p: {
  revenue: number
  cogs: number
  variable: number
  fixed: number
  nonOp: number
}): FcChain {
  const gross = p.revenue - p.cogs
  const contribution = gross - p.variable
  const operating = contribution - p.fixed
  const net = operating - p.nonOp
  const bepRate = p.fixed > 0 ? (contribution / p.fixed) * 100 : null
  const bep = p.fixed > 0 && contribution > 0 ? Math.round((p.fixed * p.revenue) / contribution) : null
  return { ...p, gross, contribution, operating, net, bep, bepRate }
}
