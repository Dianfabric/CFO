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
