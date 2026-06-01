/**
 * 12주 사이클 OKR — 공용 타입 + 헬퍼
 *
 * 계층: Employee → Goal → KR → WeeklyTarget → DailyTodo
 */

// ============================================================
// Enums (DB 와 동일)
// ============================================================
export type BusinessTrack = 'b2b' | 'b2c' | 'both'
export type KrUnit = 'KRW' | 'count' | 'item' | 'percent' | 'ratio' | 'hours' | 'other'
export type TodoStatus = 'todo' | 'doing' | 'done' | 'blocked'
export type GoalStatus = 'active' | 'paused' | 'done' | 'cancelled'

export const BUSINESS_TRACK_LABEL: Record<BusinessTrack, string> = {
  b2b: 'B2B',
  b2c: 'B2C',
  both: '공통',
}

export const KR_UNIT_LABEL: Record<KrUnit, string> = {
  KRW: '원',
  count: '건',
  item: '개',
  percent: '%',
  ratio: '배',
  hours: '시간',
  other: '단위',
}

/** 단위 토글에 표시될 옵션 (사용자가 KR 등록 시 고르는 것) */
export const KR_UNIT_OPTIONS: Array<{ value: KrUnit; label: string; hint: string }> = [
  { value: 'count', label: '건', hint: '횟수·건수' },
  { value: 'item', label: '개', hint: '개수·점수' },
  { value: 'KRW', label: '원', hint: '금액 (만/억 자동)' },
  { value: 'percent', label: '%', hint: '비율·달성률' },
  { value: 'hours', label: '시간', hint: '소요·학습 시간' },
  { value: 'ratio', label: '배', hint: '배수' },
]

export const TODO_STATUS_LABEL: Record<TodoStatus, string> = {
  todo: '대기',
  doing: '진행',
  done: '완료',
  blocked: '막힘',
}

export const TODO_STATUS_COLOR: Record<TodoStatus, string> = {
  todo: '#9ca3af',
  doing: '#0ea5e9',
  done: '#76b900',
  blocked: '#ef4444',
}

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  active: '진행 중',
  paused: '보류',
  done: '완료',
  cancelled: '취소',
}

// ============================================================
// Entity types (DB row 형태)
// ============================================================
export interface Employee {
  id: string
  name: string
  role_label: string | null
  department: string | null
  business_track: BusinessTrack
  color: string
  avatar_emoji: string | null
  is_leader: boolean
  active: boolean
  display_order: number
  profile_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EmployeeGoal {
  id: string
  cycle_id: number
  employee_id: string
  title: string
  /** @deprecated 사용 안 함 — DB 컬럼은 보존 */
  description?: string | null
  business_track: BusinessTrack
  status: GoalStatus
  display_order: number
  is_big_goal: boolean
  created_at: string
  updated_at: string
}

export interface KeyResult {
  id: string
  goal_id: string
  title: string
  /** @deprecated 사용 안 함 */
  description?: string | null
  /** 선행 측정값의 단위 */
  unit: KrUnit
  /** @deprecated 페어 모델로 의미 약화 (lead 또는 lag 한쪽만일 때 true 가 의미) */
  is_leading: boolean
  /** 선행 측정값 (활동/통제 가능) */
  start_value: number
  target_value: number
  current_value: number
  is_company_pinned: boolean
  pinned_order: number | null
  display_order: number
  /** 선행 메트릭 코드 */
  metric_code: string | null
  /** 선행 자동 집계 */
  auto_sync: boolean
  /** 이 KR 이 달성되면 어떤 후행지표 성과를 기대하는지 자유 텍스트 */
  expected_lag_impact: string | null

  /** KR (선행 활동) 시작일. null 이면 사이클 시작일 사용 */
  started_date: string | null

  // ───── 후행 측정값 페어 (V3 페어 모델) ─────
  lag_metric_code: string | null
  lag_unit: KrUnit | null
  lag_start_value: number | null
  lag_target_value: number | null
  lag_current_value: number | null
  lag_auto_sync: boolean

  created_at: string
  updated_at: string
}

/** WAM 주차 점수 (v_wam_weekly_scores 뷰 row) */
export interface WamWeeklyScore {
  employee_id: string
  employee_name: string
  employee_color: string
  week_number: number
  cycle_id: number
  week_total: number
  week_done: number
  avg_kr_progress: number
  self_score: number | null
}

/** WAM 점수 산식 — base + 자기평가 보정 */
export function calcWamScore(row: Pick<WamWeeklyScore, 'week_done' | 'week_total' | 'avg_kr_progress' | 'self_score'>): {
  base: number
  final: number
  todoRate: number
  krRate: number
} {
  const todoRate = row.week_total > 0 ? row.week_done / row.week_total : 0
  const krRate = Math.max(0, Math.min(1, Number(row.avg_kr_progress ?? 0)))
  const base = (todoRate * 0.5 + krRate * 0.5) * 100
  const selfMul =
    row.self_score == null
      ? 1.0
      : 0.8 + (row.self_score - 1) * 0.1 // 1→0.8, 2→0.9, 3→1.0, 4→1.1, 5→1.2
  const final = Math.min(120, base * selfMul)
  return { base, final, todoRate, krRate }
}

export interface WeeklyTarget {
  id: string
  key_result_id: string
  week_number: number // 1-12
  target_value: number
  actual_value: number
  note: string | null
  updated_at: string
}

export interface DailyTodo {
  id: string
  employee_id: string
  weekly_target_id: string | null
  date: string // YYYY-MM-DD
  title: string
  description: string | null
  status: TodoStatus
  is_shared: boolean
  collaborator_ids: string[]
  priority: 1 | 2 | 3
  order_in_day: number
  blocker_note: string | null
  created_at: string
  completed_at: string | null
  /** 1:1 미팅 자동 생성 todo 인 경우 미팅 id (CASCADE 연결) */
  source_one_on_one_id?: number | null
}

/** 메인 대시보드 — v_company_pinned_krs 뷰 row */
export interface CompanyPinnedKR {
  kr_id: string
  kr_title: string
  unit: KrUnit
  is_leading: boolean
  start_value: number
  target_value: number
  current_value: number
  pinned_order: number | null
  progress_pct: number
  goal_id: string
  goal_title: string
  business_track: BusinessTrack
  employee_id: string
  employee_name: string
  role_label: string | null
  employee_color: string
  cycle_id: number
  cycle_number: number
  cycle_start: string
  cycle_end: string
}

// ============================================================
// 진행률 계산
// ============================================================

/** KR 선행 측정값의 0~1 진행률 */
export function calcKrProgress(kr: Pick<KeyResult, 'start_value' | 'target_value' | 'current_value'>): number {
  const span = kr.target_value - kr.start_value
  if (span === 0) return kr.current_value >= kr.target_value ? 1 : 0
  const p = (kr.current_value - kr.start_value) / span
  return Math.max(0, Math.min(1, p))
}

/** KR 후행 측정값의 0~1 진행률. 후행 값이 안 채워졌으면 null */
export function calcKrLagProgress(kr: Pick<KeyResult, 'lag_start_value' | 'lag_target_value' | 'lag_current_value'>): number | null {
  const t = kr.lag_target_value
  if (t == null) return null
  const s = Number(kr.lag_start_value ?? 0)
  const c = Number(kr.lag_current_value ?? s)
  const span = Number(t) - s
  if (span === 0) return c >= Number(t) ? 1 : 0
  return Math.max(0, Math.min(1, (c - s) / span))
}

/** KR 종합 진행률 = (선행 + 후행) / 2. 후행 없으면 선행만. */
export function calcKrAvgProgress(kr: KeyResult): number {
  const lead = calcKrProgress(kr)
  const lag = calcKrLagProgress(kr)
  if (lag == null) return lead
  return (lead + lag) / 2
}

/** KR 페어 모델에서 한쪽이라도 설정되었는지 */
export function hasLeadingPart(kr: Pick<KeyResult, 'metric_code'>): boolean {
  return !!kr.metric_code
}
export function hasLagPart(kr: Pick<KeyResult, 'lag_metric_code'>): boolean {
  return !!kr.lag_metric_code
}

/** 0~1 진행률 → 색상 (80% 기준선) */
export function progressColor(pct: number): string {
  if (pct >= 0.8) return '#76b900' // NVIDIA primary green — 성공
  if (pct >= 0.6) return '#df6500' // NVIDIA warning — 주의
  return '#e52020'                  // NVIDIA error — 경고
}

/** 주간 실행률 (이번 주 done / total) */
export function weekExecRate(todos: Pick<DailyTodo, 'status'>[]): number {
  if (todos.length === 0) return 0
  const done = todos.filter((t) => t.status === 'done').length
  return done / todos.length
}

// ============================================================
// 포매팅
// ============================================================

/** 숫자 + 단위 표시 */
export function formatKrValue(value: number, unit: KrUnit): string {
  if (unit === 'KRW') {
    if (value >= 100_000_000) return `₩${(value / 100_000_000).toFixed(1)}억`
    if (value >= 10_000) return `₩${(value / 10_000).toFixed(0)}만`
    return `₩${Math.round(value).toLocaleString('ko-KR')}`
  }
  if (unit === 'percent') return `${value.toFixed(1)}%`
  if (unit === 'ratio') return `${value.toFixed(2)}배`
  if (unit === 'hours') return `${value.toFixed(1)}h`
  if (unit === 'count') return `${Math.round(value).toLocaleString('ko-KR')}건`
  if (unit === 'item') return `${Math.round(value).toLocaleString('ko-KR')}개`
  return `${value.toLocaleString('ko-KR')}`
}

/** Date → 'YYYY-MM-DD' (로컬 타임존 기준, KST 환경에서 정확) */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 오늘 (로컬) */
export function todayLocal(): string {
  return toLocalDateStr(new Date())
}

/**
 * YYYY-MM-DD 문자열 → 그 날짜가 포함된 주의 월요일 (로컬 타임존).
 * 예: 5/19 (화) 입력 → 5/18 (월) 반환.
 */
export function startOfWeekMonday(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() // 0=일, 1=월, ..., 6=토
  const offset = dow === 0 ? -6 : 1 - dow
  dt.setDate(dt.getDate() + offset)
  return dt
}

/** week_number → 사이클 시작일 기준 그 주의 월~일 범위 (로컬 타임존) */
export function weekDateRange(
  cycleStart: string,
  weekNumber: number,
): { mondayISO: string; sundayISO: string } {
  // 'YYYY-MM-DD' 파싱 — UTC 자정으로 해석되는 것을 막기 위해 컴포넌트로 분해
  const [yStr, mStr, dStr] = cycleStart.split('-')
  const start = new Date(Number(yStr), Number(mStr) - 1, Number(dStr))
  const monday = new Date(start)
  monday.setDate(start.getDate() + (weekNumber - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    mondayISO: toLocalDateStr(monday),
    sundayISO: toLocalDateStr(sunday),
  }
}

/** 오늘 날짜가 사이클의 몇주차인지 */
export function currentWeekNumber(cycleStart: string, cycleEnd: string): number {
  const start = new Date(cycleStart).getTime()
  const end = new Date(cycleEnd).getTime()
  const now = Date.now()
  if (now < start) return 0
  if (now > end) return 12
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  return Math.min(12, Math.floor(diffDays / 7) + 1)
}
