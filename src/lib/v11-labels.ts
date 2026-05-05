/**
 * v1.1 enum → 한글 라벨 + 색상
 * (Supabase types/types.ts 가 생성되면 그곳으로 이동 가능)
 */

export const OCCUPATION_LABEL: Record<string, string> = {
  interior_project: '인테리어 프로젝트',
  brand_furniture: '브랜드 가구',
  project_furniture: '프로젝트 가구',
  commercial_reupholster: '업소용 천갈이',
  curtain_styling: '커튼 스타일링',
  display: '디스플레이',
}
export const OCCUPATION_VALUES = Object.keys(OCCUPATION_LABEL) as Array<keyof typeof OCCUPATION_LABEL>

export const DIVISION_LABEL: Record<string, string> = {
  sofa: '소파원단',
  curtain: '커튼원단',
  wall: '벽원단',
  accessory: '소품원단',
}
export const DIVISION_VALUES = Object.keys(DIVISION_LABEL) as Array<keyof typeof DIVISION_LABEL>

export const CLIENT_TIER_LABEL: Record<string, string> = {
  vip: 'VIP',
  general: '일반',
  small: '소형',
  growth_potential: '성장 가능',
  inefficient: '비효율',
}
export const CLIENT_TIER_VALUES = Object.keys(CLIENT_TIER_LABEL) as Array<keyof typeof CLIENT_TIER_LABEL>

export const CLIENT_TIER_COLOR: Record<string, string> = {
  vip: 'bg-amber-100 text-amber-800',
  general: 'bg-slate-100 text-slate-700',
  small: 'bg-blue-50 text-blue-700',
  growth_potential: 'bg-emerald-100 text-emerald-700',
  inefficient: 'bg-rose-100 text-rose-700',
}

export const PRICE_TIER_LABEL: Record<string, string> = {
  value: '저가',
  mid: '중가',
  premium: '프리미엄',
  luxury: '럭셔리',
}
export const PRICE_TIER_VALUES = Object.keys(PRICE_TIER_LABEL) as Array<keyof typeof PRICE_TIER_LABEL>

export const TRANSACTION_STAGE_LABEL: Record<string, string> = {
  quote: '견적',
  confirmed: '확정',
  shipping: '배송중',
  delivered: '납품완료',
  paid: '입금완료',
  cancelled: '취소',
}

// ── 비용 분류 (PRD #3 ③) ──
export const EXPENSE_VARIABILITY_LABEL: Record<string, string> = {
  variable: '변동',
  fixed: '고정',
}
export const EXPENSE_VARIABILITY_VALUES = Object.keys(EXPENSE_VARIABILITY_LABEL) as Array<
  keyof typeof EXPENSE_VARIABILITY_LABEL
>

export const EXPENSE_DISCRETION_LABEL: Record<string, string> = {
  discretionary: '재량',
  non_discretionary: '비재량',
}
export const EXPENSE_DISCRETION_VALUES = Object.keys(EXPENSE_DISCRETION_LABEL) as Array<
  keyof typeof EXPENSE_DISCRETION_LABEL
>

/** 4사분면 라벨 (변동/고정 × 재량/비재량) */
export function quadrantLabel(
  variability: string,
  discretion: string,
): { short: string; full: string; description: string } {
  const v = EXPENSE_VARIABILITY_LABEL[variability] ?? variability
  const d = EXPENSE_DISCRETION_LABEL[discretion] ?? discretion
  const key = `${variability}_${discretion}`
  const desc: Record<string, string> = {
    variable_discretionary: '투자성 — 광고·이벤트·교육 등 재량적 변동비',
    variable_non_discretionary: '연동성 — 원단매입·운송·수수료 등 매출 비례 비용',
    fixed_discretionary: '재량 고정 — 회식·렌트·구독 등 줄일 수 있는 고정비',
    fixed_non_discretionary: '구조 고정 — 임대료·인건비·세금 등 줄이기 어려운 비용',
  }
  return {
    short: `${v}·${d}`,
    full: `${v} × ${d}`,
    description: desc[key] ?? '',
  }
}

/** 24셀 라벨 생성 — "{직업군} × {제품군}" */
export function segmentLabel(
  occupation: string | null | undefined,
  division: string | null | undefined,
): string {
  const occ = occupation ? OCCUPATION_LABEL[occupation] : null
  const div = division ? DIVISION_LABEL[division] : null
  if (!occ || !div) return '미매핑'
  return `${occ} × ${div}`
}
