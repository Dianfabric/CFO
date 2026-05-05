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

// ── 영업 활동 (PRD #2a) ──
export const SALES_ACTIVITY_LABEL: Record<string, string> = {
  call: '전화',
  meeting: '미팅',
  email: '이메일/카톡',
  sample_send: '샘플 발송',
  sample_return: '샘플 반환',
  catalog_send: '카탈로그',
  proposal_send: '제안서',
  consultation: '큐레이션 컨설팅',
  follow_up: '후속 연락',
  visit: '방문',
  event: '전시·박람회',
  other: '기타',
}
export const SALES_ACTIVITY_VALUES = Object.keys(SALES_ACTIVITY_LABEL) as Array<
  keyof typeof SALES_ACTIVITY_LABEL
>

export const SALES_STAGE_LABEL: Record<string, string> = {
  prospecting: '1. 탐색',
  rapport: '2. 관계 형성',
  needs: '3. 니즈 파악',
  presentation: '4. 제안',
  objection: '5. 이의 처리',
  closing: '6. 성사',
  follow_up: '7. 사후 관리',
}
export const SALES_STAGE_VALUES = Object.keys(SALES_STAGE_LABEL) as Array<
  keyof typeof SALES_STAGE_LABEL
>

export const SALES_STAGE_COLOR: Record<string, string> = {
  prospecting: 'bg-slate-100 text-slate-700',
  rapport: 'bg-blue-100 text-blue-700',
  needs: 'bg-cyan-100 text-cyan-700',
  presentation: 'bg-amber-100 text-amber-800',
  objection: 'bg-orange-100 text-orange-800',
  closing: 'bg-emerald-100 text-emerald-700',
  follow_up: 'bg-purple-100 text-purple-700',
}

export const OBJECTION_LABEL: Record<string, string> = {
  price: '가격 부담',
  quality: '품질 의문',
  lead_time: '납기 우려',
  competitor: '경쟁사 사용',
  budget: '예산 이슈',
  authority: '결정권자 부재',
  urgency: '시급성 부족',
  fit: '디자인/소재 미스매치',
  other: '기타',
}

export const LIFECYCLE_LABEL: Record<string, string> = {
  new: '신규',
  growing: '성장 중',
  mature: '안정 거래',
  at_risk: '이탈 위험',
  churned: '이탈',
}
export const LIFECYCLE_COLOR: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  growing: 'bg-emerald-100 text-emerald-700',
  mature: 'bg-slate-100 text-slate-700',
  at_risk: 'bg-amber-100 text-amber-800',
  churned: 'bg-rose-100 text-rose-700',
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
