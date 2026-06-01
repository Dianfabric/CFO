/**
 * KR 메트릭 옵션 카탈로그
 *
 * 각 KR 등록 시 사용자는 이 카탈로그에서 메트릭을 토글로 선택.
 * 선택 시 자동으로 단위·선행/후행·자동집계 여부가 설정됨.
 *
 * auto_sync = true 인 메트릭은 후행지표 — transactions 등 다른 테이블에서
 * 자동 집계되어 current_value 가 채워짐 (사용자가 수동으로 입력 안 함).
 */

import type { KrUnit } from './cycle-okr'

export interface KrMetric {
  /** DB 에 저장되는 코드 */
  code: string
  /** 사용자 표시 라벨 */
  label: string
  /** 짧은 설명 */
  hint: string
  /** 아이콘 (이모지) */
  emoji: string
  /** 단위 */
  unit: KrUnit
  /** 선행지표 (활동량) 여부. false 면 후행(결과) */
  is_leading: boolean
  /**
   * 자동 집계 대상 여부.
   * true → transactions / 다른 테이블에서 actual_value 자동 계산.
   * 현재 지원: 'revenue', 'margin' (transactions 합산)
   */
  auto_sync: boolean
  /** 후행 그룹 ('result') vs 선행 그룹 ('activity') 표시 */
  group: 'result' | 'activity'
}

export const KR_METRIC_CATALOG: KrMetric[] = [
  // ───── 후행지표 (결과) ─────
  {
    code: 'revenue',
    label: '매출',
    hint: '거래 데이터에서 자동 집계 (확정·배송·납품·결제 단계)',
    emoji: '💰',
    unit: 'KRW',
    is_leading: false,
    auto_sync: true,
    group: 'result',
  },
  {
    code: 'margin',
    label: '공헌이익',
    hint: '거래 마진 합계 — 자동 집계',
    emoji: '📈',
    unit: 'KRW',
    is_leading: false,
    auto_sync: true,
    group: 'result',
  },
  {
    code: 'new_client',
    label: '신규 거래처',
    hint: '이번 사이클 신규 등록 거래처 수',
    emoji: '🏢',
    unit: 'count',
    is_leading: false,
    auto_sync: false,
    group: 'result',
  },
  {
    code: 'contract',
    label: '신규 계약',
    hint: '체결된 계약 건수',
    emoji: '📝',
    unit: 'count',
    is_leading: false,
    auto_sync: false,
    group: 'result',
  },
  {
    code: 'follower',
    label: '인스타 팔로워',
    hint: '인스타그램 팔로워 수 (수동 입력)',
    emoji: '📷',
    unit: 'count',
    is_leading: false,
    auto_sync: false,
    group: 'result',
  },
  {
    code: 'b2c_sale',
    label: 'B2C 주문',
    hint: 'B2C 신사업 주문 건수',
    emoji: '🛍️',
    unit: 'count',
    is_leading: false,
    auto_sync: false,
    group: 'result',
  },

  // ───── 선행지표 (활동) ─────
  {
    code: 'designer_contact',
    label: '디자이너 컨택',
    hint: '전화/메일/DM 등 영업 컨택 횟수',
    emoji: '📞',
    unit: 'count',
    is_leading: true,
    auto_sync: false,
    group: 'activity',
  },
  {
    code: 'meeting',
    label: '미팅',
    hint: '대면·온라인 미팅 횟수',
    emoji: '🤝',
    unit: 'count',
    is_leading: true,
    auto_sync: false,
    group: 'activity',
  },
  {
    code: 'sample',
    label: '샘플 발송',
    hint: '디자이너·거래처에 보낸 샘플 건수',
    emoji: '📦',
    unit: 'count',
    is_leading: true,
    auto_sync: false,
    group: 'activity',
  },
  {
    code: 'content',
    label: '콘텐츠 발행',
    hint: '인스타·블로그·유튜브 등 게시물 수',
    emoji: '🎬',
    unit: 'count',
    is_leading: true,
    auto_sync: false,
    group: 'activity',
  },
  {
    code: 'reel',
    label: '릴스/숏폼',
    hint: '인스타 릴스·유튜브 숏츠 등',
    emoji: '🎞️',
    unit: 'count',
    is_leading: true,
    auto_sync: false,
    group: 'activity',
  },
  {
    code: 'ad_spend',
    label: '광고 집행',
    hint: '광고비 집행액',
    emoji: '📣',
    unit: 'KRW',
    is_leading: true,
    auto_sync: false,
    group: 'activity',
  },
  {
    code: 'quote',
    label: '견적서 발송',
    hint: '발송한 견적서 건수',
    emoji: '📋',
    unit: 'count',
    is_leading: true,
    auto_sync: false,
    group: 'activity',
  },
  {
    code: 'product_launch',
    label: '신제품/신원단',
    hint: '런칭한 신제품·원단 수',
    emoji: '✨',
    unit: 'count',
    is_leading: true,
    auto_sync: false,
    group: 'activity',
  },
  {
    code: 'training_hours',
    label: '학습 시간',
    hint: '자기개발·교육 시간',
    emoji: '📚',
    unit: 'hours',
    is_leading: true,
    auto_sync: false,
    group: 'activity',
  },

  // ───── 기타 (커스텀) ─────
  {
    code: 'custom',
    label: '기타 (직접 입력)',
    hint: '카탈로그에 없는 경우 — 단위 직접 선택',
    emoji: '·',
    unit: 'count',
    is_leading: true,
    auto_sync: false,
    group: 'activity',
  },
]

/** code → metric */
export const KR_METRIC_BY_CODE: Record<string, KrMetric> = Object.fromEntries(
  KR_METRIC_CATALOG.map((m) => [m.code, m]),
)

export function getKrMetric(code: string | null | undefined): KrMetric | null {
  if (!code) return null
  return KR_METRIC_BY_CODE[code] ?? null
}

/** 그룹별로 묶어서 UI 토글 표시용 */
export const KR_METRIC_GROUPS = {
  result: KR_METRIC_CATALOG.filter((m) => m.group === 'result'),
  activity: KR_METRIC_CATALOG.filter((m) => m.group === 'activity'),
}
