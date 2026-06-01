/**
 * 잠재 거래처 (Lead) — 옵션·라벨·타입·헬퍼
 *
 * 디안 비즈니스 맥락:
 * - 직군: 인테리어/디자이너/가구·침대/스타일링/디스플레이/일반 등
 * - 제품: 소파/커튼/벽/침대/식탁/의자/소품 등 (24셀 매트릭스보다 사용자 친화적)
 */

// ============================================================
// Status
// ============================================================
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' | 'archived'

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: '신규',
  contacted: '연락 완료',
  qualified: '가능성 있음',
  converted: '거래처 전환',
  lost: '무산',
  archived: '아카이브',
}

export const LEAD_STATUS_COLOR: Record<LeadStatus, { bg: string; text: string }> = {
  new:        { bg: '#dbeafe', text: '#1e40af' },
  contacted:  { bg: '#fef3c7', text: '#92400e' },
  qualified:  { bg: '#dcfce7', text: '#166534' },
  converted:  { bg: '#76b900',  text: '#ffffff' },
  lost:       { bg: '#f3f4f6', text: '#6b7280' },
  archived:   { bg: '#e5e5e5', text: '#6b7280' },
}

// ============================================================
// 직군 (Occupation) — 다중 선택 가능
// ============================================================
export const OCCUPATION_OPTIONS = [
  { code: 'interior_designer',  label: '인테리어 디자이너',  emoji: '🏠' },
  { code: 'interior_project',   label: '인테리어 시공',     emoji: '🛠️' },
  { code: 'architect',           label: '건축가',           emoji: '📐' },
  { code: 'brand_furniture',    label: '브랜드 가구',       emoji: '🛋️' },
  { code: 'project_furniture',  label: '프로젝트 가구',     emoji: '🪑' },
  { code: 'commercial_reupholster', label: '업소용 천갈이', emoji: '🏨' },
  { code: 'curtain_styling',    label: '커튼 스타일링',     emoji: '🪟' },
  { code: 'display',             label: '디스플레이',       emoji: '🎨' },
  { code: 'stylist',             label: '스타일리스트',     emoji: '✨' },
  { code: 'home_user',           label: '일반 소비자 (B2C)', emoji: '🏡' },
  { code: 'student',             label: '학생/연구',        emoji: '📚' },
  { code: 'other',               label: '기타',             emoji: '·' },
] as const

export type OccupationCode = typeof OCCUPATION_OPTIONS[number]['code']

export function occupationLabel(code: string): string {
  return OCCUPATION_OPTIONS.find((o) => o.code === code)?.label ?? code
}

// ============================================================
// 관심 제품 (Product Interest) — 다중 선택
// ============================================================
export const PRODUCT_OPTIONS = [
  { code: 'sofa',          label: '소파',          emoji: '🛋️' },
  { code: 'chair',         label: '의자',          emoji: '🪑' },
  { code: 'bed',           label: '침대',          emoji: '🛏️' },
  { code: 'dining_table',  label: '식탁',          emoji: '🍽️' },
  { code: 'curtain',       label: '커튼',          emoji: '🪟' },
  { code: 'wall',          label: '벽/벽지·벽장식', emoji: '🧱' },
  { code: 'cushion',       label: '쿠션·패브릭 소품', emoji: '🟢' },
  { code: 'furniture',     label: '가구 일반',     emoji: '🪞' },
  { code: 'fabric_only',   label: '원단만',        emoji: '🧶' },
  { code: 'other',         label: '기타',          emoji: '·' },
] as const

export type ProductCode = typeof PRODUCT_OPTIONS[number]['code']

export function productLabel(code: string): string {
  return PRODUCT_OPTIONS.find((p) => p.code === code)?.label ?? code
}

// ============================================================
// 문의 경로
// ============================================================
export const INQUIRY_SOURCE_OPTIONS = [
  { code: 'phone',         label: '전화' },
  { code: 'sms',           label: '문자메시지' },
  { code: 'email',         label: '이메일' },
  { code: 'kakao',         label: '카카오톡' },
  { code: 'instagram',     label: '인스타그램 DM' },
  { code: 'website',       label: '웹사이트 문의' },
  { code: 'visit',         label: '방문' },
  { code: 'recommendation', label: '소개·추천' },
  { code: 'exhibition',    label: '전시·박람회' },
  { code: 'other',         label: '기타' },
] as const

export function inquirySourceLabel(code: string | null | undefined): string {
  if (!code) return ''
  return INQUIRY_SOURCE_OPTIONS.find((s) => s.code === code)?.label ?? code
}

// ============================================================
// Entity
// ============================================================
export interface ContactLead {
  id: string
  name: string
  position: string | null
  phone: string | null
  email: string | null
  company_name: string | null
  address: string | null
  occupations: string[]
  product_interests: string[]
  inquiry_source: string | null
  inquiry_summary: string | null
  notes: string | null
  status: LeadStatus
  next_action: string | null
  next_action_date: string | null
  converted_client_id: number | null
  converted_at: string | null
  sheet_synced_at: string | null
  sheet_row_index: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// 헬퍼
// ============================================================

/** 전화번호 표시 포맷 (010-1234-5678) */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return phone
}

/** CSV escape — comma·quote·newline 처리 */
export function csvEscape(value: string | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** lead → CSV/Sheets row 값 배열 */
export function leadToRowValues(lead: ContactLead): string[] {
  return [
    lead.created_at?.slice(0, 16).replace('T', ' ') ?? '',
    lead.name,
    lead.position ?? '',
    lead.company_name ?? '',
    lead.phone ?? '',
    lead.email ?? '',
    lead.address ?? '',
    lead.occupations.map(occupationLabel).join(' / '),
    lead.product_interests.map(productLabel).join(' / '),
    inquirySourceLabel(lead.inquiry_source),
    lead.inquiry_summary ?? '',
    lead.notes ?? '',
    LEAD_STATUS_LABEL[lead.status],
    lead.next_action ?? '',
    lead.next_action_date ?? '',
  ]
}

/** lead → CSV row (escape 포함) */
export function leadToCsvRow(lead: ContactLead): string {
  return leadToRowValues(lead).map(csvEscape).join(',')
}

export const SHEET_HEADER_COLUMNS = [
  '등록일',
  '이름',
  '직책',
  '회사명',
  '전화번호',
  '이메일',
  '주소',
  '직군',
  '관심 제품',
  '문의 경로',
  '문의 요지',
  '메모',
  '상태',
  '다음 액션',
  '다음 액션 날짜',
]

export const CSV_HEADER = SHEET_HEADER_COLUMNS.join(',')
