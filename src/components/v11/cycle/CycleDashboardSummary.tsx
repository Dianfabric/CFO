'use client'

/**
 * 12주 사이클 합산 위젯 — 메인 대시보드용
 *
 * - 회사 핀 KR (대표가 매주 보고 싶은 핵심 수치들)
 * - 이번 주 전사 투두 실행률
 * - 직원별 진행률 카드 (빅 목표 + 이번 주 할 일 + WAM 12주 막대)
 * - B2B/B2C KR 카운트
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Pin,
  TrendingUp,
  TrendingDown,
  Users,
  CheckSquare,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Crown,
  Calendar,
  ChevronDown,
  ChevronRight,
  Check,
  Zap,
  ExternalLink,
} from 'lucide-react'
import {
  formatKrValue,
  progressColor,
  calcWamScore,
  type CompanyPinnedKR,
  type BusinessTrack,
  type WamWeeklyScore,
} from '@/lib/cycle-okr'
import { cn } from '@/lib/utils'
import CycleMiniHeader from './CycleMiniHeader'

interface BigKrDetail {
  kr_id: string
  kr_title: string
  lead_metric_code: string | null
  lead_unit: string
  lead_start: number
  lead_target: number
  lead_current: number
  lead_progress: number
  lag_metric_code: string | null
  lag_unit: string | null
  lag_start: number | null
  lag_target: number | null
  lag_current: number | null
  lag_progress: number | null
  this_week_target_id: string | null
  this_week_target_value: number
  this_week_actual_value: number
  this_week_note: string | null
  this_week_todos: Array<{
    id: string
    date: string
    title: string
    priority: number
    status: string
  }>
}

interface EmployeeSummary {
  id: string
  name: string
  color: string
  role_label: string | null
  business_track: string
  avg_progress: number
  kr_count: number
  goal_count: number
  week_done: number
  week_total: number
  big_goal_title: string | null
  big_goal_track: string | null
  this_week_todo_titles: string[]
  big_goal_id: string | null
  big_goal_krs: BigKrDetail[]
  /** 예정된 1:1 (오늘 이후 — 이번 주 밖 포함) + 상대 확인 여부 */
  one_on_ones?: Array<{
    id: number
    date: string
    time: string | null
    with: string
    confirmed: boolean
  }>
}

interface SummaryData {
  cycle: {
    id: number
    cycle_number: number
    start_date: string
    end_date: string
    vision_statement?: string | null
  } | null
  week_number: number
  week_monday: string
  week_sunday: string
  pinned_krs: CompanyPinnedKR[]
  week_exec_rate: number
  week_total_todos: number
  week_done_todos: number
  week_blocked_todos: number
  b2b_kr_count: number
  b2c_kr_count: number
  employees_summary: EmployeeSummary[]
}

// sessionStorage 캐시 키 — 같은 세션 내 페이지 전환 시 즉시 표시
const CACHE_KEY = 'dian:dashboard-summary'

export default function CycleDashboardSummary() {
  // SSR/CSR 일치 — 항상 null/true 로 시작. mount 후 useEffect 에서 캐시 읽음.
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch('/api/cycle/dashboard-summary')
      if (!r.ok) throw new Error(`${r.status}`)
      const j = (await r.json()) as SummaryData
      setData(j)
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(j))
      } catch {
        /* quota / disabled — 무시 */
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 1) 캐시 hydrate — mount 직후 (hydration 끝난 뒤) 라 SSR mismatch 없음
    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        setData(JSON.parse(raw) as SummaryData)
        setLoading(false)
      }
    } catch {
      /* ignore */
    }
    // 2) 백그라운드 갱신 (캐시가 있어도 fresh 데이터로 교체)
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div
        className="bg-white p-6 text-center text-[12px]"
        style={{
          border: '1px solid var(--nv-hairline)',
          borderRadius: '2px',
          color: 'var(--nv-mute)',
        }}
      >
        12주 사이클 요약 로드 중...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div
        className="p-4 text-[12px]"
        style={{
          border: '1px solid var(--nv-error)',
          backgroundColor: '#fef2f2',
          borderRadius: '2px',
          color: 'var(--nv-error)',
        }}
      >
        ⚠ 요약 조회 실패{error ? `: ${error}` : ''}
      </div>
    )
  }
  if (!data.cycle) {
    return (
      <div
        className="p-4"
        style={{
          border: '1px solid var(--nv-primary)',
          backgroundColor: 'var(--nv-accent-pale)',
          borderRadius: '2px',
        }}
      >
        <p
          className="text-[13px] font-bold mb-1"
          style={{ color: 'var(--nv-ink)' }}
        >
          12주 사이클이 시작되지 않았습니다
        </p>
        <Link
          href="/finance/cycle"
          className="text-[12px] underline inline-flex items-center gap-1"
          style={{ color: 'var(--nv-success-deep)' }}
        >
          사이클 시작하기 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    )
  }

  const execColor =
    data.week_exec_rate >= 0.8 ? '#76b900' : data.week_exec_rate >= 0.6 ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-4">
      {/* 미니 헤더 — 큰 목표 + 사이클 정보 strip (인라인 편집) */}
      <CycleMiniHeader cycle={data.cycle} />

      {/* 직원별 진행률 카드 */}
      <div
        className="bg-white p-4"
        style={{
          border: '1px solid var(--nv-hairline)',
          borderRadius: '2px',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          {/* NVIDIA corner-square 모티프 */}
          <span
            className="inline-block w-2.5 h-2.5"
            style={{ backgroundColor: 'var(--nv-primary)' }}
          />
          <Users className="w-3.5 h-3.5" style={{ color: 'var(--nv-mute)' }} />
          <h3
            className="text-[13px] font-bold tracking-tight uppercase"
            style={{ color: 'var(--nv-ink)', letterSpacing: '0.04em' }}
          >
            직원별 진행률
          </h3>
          <span className="text-[11.5px]" style={{ color: 'var(--nv-stone)' }}>
            · KR 평균 + 이번 주 투두 완료율
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.employees_summary.map((e) => (
            <EmployeeProgressCard
              key={e.id}
              emp={e}
              cycleStart={data.cycle?.start_date ?? ''}
              cycleEnd={data.cycle?.end_date ?? ''}
              weekNumber={data.week_number}
              onRefresh={fetchData}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 핀 KR 카드
// ============================================================
function PinnedKrCard({ kr }: { kr: CompanyPinnedKR }) {
  const progress = Math.max(0, Math.min(100, Number(kr.progress_pct))) / 100
  const color = progressColor(progress)
  const trackColor =
    kr.business_track === 'b2b' ? '#1e40af' : kr.business_track === 'b2c' ? '#9d174d' : '#666'

  return (
    <div
      className="border border-[#e5e5e5] bg-white p-3 hover:border-[#000] transition-colors"
      style={{ borderRadius: '2px' }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div
          className="w-1 h-9 shrink-0"
          style={{ backgroundColor: kr.employee_color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            {kr.is_leading ? (
              <TrendingUp className="w-3 h-3 text-[#0ea5e9] shrink-0" strokeWidth={2} />
            ) : (
              <TrendingDown className="w-3 h-3 text-[#a855f7] shrink-0" strokeWidth={2} />
            )}
            <span className="text-[12px] font-bold tracking-tight text-[#000] truncate">
              {kr.kr_title}
            </span>
          </div>
          <p className="text-[11.5px] text-[#666] mt-0.5">
            <span className="font-bold" style={{ color: kr.employee_color }}>
              {kr.employee_name}
            </span>
            {' · '}
            <span style={{ color: trackColor }}>{kr.business_track.toUpperCase()}</span>
            {' · '}
            <span className="text-[#999]">{kr.goal_title}</span>
          </p>
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[18px] font-bold tabular-nums" style={{ color }}>
          {formatKrValue(Number(kr.current_value), kr.unit)}
        </span>
        <span className="text-[11.5px] text-[#999]">
          / {formatKrValue(Number(kr.target_value), kr.unit)}
        </span>
      </div>

      <div className="h-1.5 bg-[#f3f4f6]" style={{ borderRadius: '1px' }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${progress * 100}%`,
            backgroundColor: color,
            borderRadius: '1px',
          }}
        />
      </div>
      <p className="text-[11.5px] text-[#666] mt-1 tabular-nums">
        {Math.round(progress * 100)}%
        {progress >= 0.8 && <span className="ml-1 text-[#76b900] font-bold">✓ 80%+</span>}
      </p>
    </div>
  )
}

// ============================================================
// 직원별 진행률 카드 (빅 목표 + 이번 주 할 일 + WAM 12주 막대)
// ============================================================
function EmployeeProgressCard({
  emp,
  cycleStart,
  cycleEnd,
  weekNumber,
  onRefresh,
}: {
  emp: EmployeeSummary
  cycleStart: string
  cycleEnd: string
  weekNumber: number
  onRefresh: () => Promise<void>
}) {
  const [wamScores, setWamScores] = useState<WamWeeklyScore[]>([])
  const [togglingTodoId, setTogglingTodoId] = useState<string | null>(null)
  const router = useRouter()

  const fetchWam = useCallback(async () => {
    try {
      const r = await fetch(`/api/cycle/wam-scores?employee_id=${emp.id}`)
      if (!r.ok) return
      const j = await r.json()
      setWamScores(j.scores ?? [])
    } catch {
      // ignore
    }
  }, [emp.id])

  useEffect(() => {
    fetchWam()
  }, [fetchWam])

  const c = progressColor(emp.avg_progress)
  const weekRate = emp.week_total > 0 ? emp.week_done / emp.week_total : 0
  // NVIDIA single-hue: track 배지는 모두 surface-soft + ink, side dot 만 차별화
  const trackBg = 'var(--nv-surface-soft)'
  const trackText = 'var(--nv-ink)'
  const trackDot =
    emp.business_track === 'b2b'
      ? 'var(--nv-primary)'
      : emp.business_track === 'b2c'
        ? 'var(--nv-primary-dark)'
        : 'var(--nv-stone)'

  // WAM 평균 (지나간 + 현재 주만)
  const wamAvg = (() => {
    const past = wamScores.filter((s) => s.week_number <= Math.max(1, weekNumber))
    const finals = past.map((s) => calcWamScore(s).final).filter((f) => f > 0)
    if (finals.length === 0) return 0
    return finals.reduce((a, b) => a + b, 0) / finals.length
  })()

  const sortedScores = [...wamScores].sort((a, b) => a.week_number - b.week_number)

  // 투두 체크 토글 (인라인 체크박스)
  const toggleTodo = async (todoId: string, currentStatus: string) => {
    setTogglingTodoId(todoId)
    try {
      await fetch(`/api/cycle/todos/${todoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: currentStatus === 'done' ? 'todo' : 'done',
        }),
      })
      await onRefresh()
    } catch {
      // ignore
    } finally {
      setTogglingTodoId(null)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/finance/cycle/employees#emp-${emp.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(`/finance/cycle/employees#emp-${emp.id}`)
        }
      }}
      className="bg-white transition-all cursor-pointer"
      style={{
        border: '1px solid var(--nv-hairline)',
        borderRadius: '2px',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--nv-ink)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--nv-hairline)')}
    >
      {/* 헤더 */}
      <div className="p-3 flex items-center gap-2">
        <div
          className="w-7 h-7 shrink-0 flex items-center justify-center text-[12px] font-bold text-white"
          style={{ backgroundColor: emp.color, borderRadius: '2px' }}
        >
          {emp.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[13px] font-bold"
              style={{ color: 'var(--nv-ink)' }}
            >
              {emp.name}
            </span>
            {emp.role_label && (
              <span className="text-[11.5px]" style={{ color: 'var(--nv-stone)' }}>
                {emp.role_label}
              </span>
            )}
            <span
              className="px-1 py-0 text-[10.5px] font-bold inline-flex items-center gap-1"
              style={{
                backgroundColor: trackBg,
                color: trackText,
                borderRadius: '2px',
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5"
                style={{ backgroundColor: trackDot }}
              />
              {emp.business_track.toUpperCase()}
            </span>
          </div>
        </div>
        <span
          className="text-[16px] font-bold tabular-nums shrink-0"
          style={{ color: c }}
        >
          {Math.round(emp.avg_progress * 100)}%
        </span>
      </div>

      {/* 본문 */}
      <div className="px-3 pb-3">

      {/* 진행률 바 */}
      <div
        className="h-1.5 mb-2"
        style={{ backgroundColor: 'var(--nv-surface-soft)', borderRadius: '2px' }}
      >
        <div
          className="h-full transition-all"
          style={{
            width: `${emp.avg_progress * 100}%`,
            backgroundColor: c,
            borderRadius: '2px',
          }}
        />
      </div>

      {/* 빅 목표 — NVIDIA primary green crown */}
      <div className="mb-2 min-h-[28px]">
        {emp.big_goal_title ? (
          <div className="flex items-start gap-1.5">
            <Crown
              className="w-3 h-3 mt-0.5 shrink-0"
              style={{ color: 'var(--nv-primary)' }}
              fill="currentColor"
            />
            <p
              className="text-[12px] font-bold leading-tight line-clamp-2 flex-1"
              style={{ color: 'var(--nv-ink)' }}
            >
              {emp.big_goal_title}
            </p>
          </div>
        ) : (
          <p
            className="text-[11.5px] italic"
            style={{ color: 'var(--nv-stone)' }}
          >
            빅 목표 미설정 — 클릭해서 추가
          </p>
        )}
      </div>

      {/* 이번 주 할 일 */}
      <div className="mb-2 min-h-[26px]">
        <div className="flex items-center gap-1 mb-0.5">
          <Calendar className="w-2.5 h-2.5" style={{ color: 'var(--nv-mute)' }} />
          <span
            className="text-[10.5px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'var(--nv-mute)' }}
          >
            이번 주 W{weekNumber}
          </span>
          <span
            className="text-[10.5px] tabular-nums"
            style={{ color: 'var(--nv-stone)' }}
          >
            · {emp.week_done}/{emp.week_total}
          </span>
          {emp.week_total > 0 && (
            <span
              className="text-[10.5px] font-bold tabular-nums"
              style={{
                color:
                  weekRate >= 0.8
                    ? '#76b900'
                    : weekRate >= 0.6
                      ? '#df6500'
                      : '#e52020',
              }}
            >
              {Math.round(weekRate * 100)}%
            </span>
          )}
        </div>
        {emp.this_week_todo_titles.length > 0 ? (
          <p
            className="text-[11.5px] leading-tight line-clamp-2"
            style={{ color: 'var(--nv-mute)' }}
          >
            {emp.this_week_todo_titles.join(' · ')}
          </p>
        ) : emp.week_total > 0 ? (
          <p
            className="text-[11.5px] font-bold"
            style={{ color: 'var(--nv-primary)' }}
          >
            ✓ 이번 주 할 일 모두 완료
          </p>
        ) : (
          <p
            className="text-[11.5px] italic"
            style={{ color: 'var(--nv-stone)' }}
          >
            이번 주 투두 없음
          </p>
        )}
      </div>

      {/* 🤝 예정된 1:1 — 이번 주 밖 일정 포함, 상대 확인 여부 표시 */}
      {(emp.one_on_ones?.length ?? 0) > 0 && (
        <div className="mb-2 space-y-0.5">
          {emp.one_on_ones!.slice(0, 3).map((o) => (
            <p key={o.id} className="text-[11.5px] leading-tight" style={{ color: 'var(--nv-mute)' }}>
              🤝 {o.date.slice(5)}{o.time ? ` ${o.time.slice(0, 5)}` : ''} with {o.with}
              <span
                className="font-bold"
                style={{ color: o.confirmed ? '#76b900' : '#df6500' }}
              >
                {' '}· {o.confirmed ? '✓ 상대 확인' : '확인 대기'}
              </span>
            </p>
          ))}
        </div>
      )}

      {/* WAM 12주 미니 막대 */}
      {sortedScores.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span
              className="text-[10.5px] font-bold uppercase tracking-[0.12em]"
              style={{ color: 'var(--nv-mute)' }}
            >
              WAM 12주
            </span>
            {wamAvg > 0 && (
              <span
                className="text-[11.5px] font-bold tabular-nums"
                style={{
                  color:
                    wamAvg >= 80
                      ? '#76b900'
                      : wamAvg >= 60
                        ? '#df6500'
                        : '#e52020',
                }}
              >
                평균 {Math.round(wamAvg)}점
              </span>
            )}
          </div>
          <div className="flex items-end gap-[2px] h-6">
            {sortedScores.map((s) => {
              const final = calcWamScore(s).final
              const isNow = s.week_number === weekNumber
              const isFuture = s.week_number > weekNumber
              const heightPct = Math.max(2, Math.min(100, final))
              let barColor = 'var(--nv-hairline)'
              if (final >= 80) barColor = '#76b900'
              else if (final >= 60) barColor = '#df6500'
              else if (final > 0) barColor = '#e52020'
              return (
                <div
                  key={s.week_number}
                  className={cn('flex-1', isNow && 'ring-1 ring-black')}
                  style={{
                    height: isFuture ? '3px' : `${heightPct}%`,
                    backgroundColor: isFuture ? 'var(--nv-surface-soft)' : barColor,
                    minWidth: '6px',
                    borderRadius: '2px',
                  }}
                  title={
                    isFuture
                      ? `W${s.week_number}`
                      : `W${s.week_number}: ${Math.round(final)}점${s.self_score ? ` (자기 ${s.self_score}★)` : ''}`
                  }
                />
              )
            })}
          </div>
        </div>
      )}

      {/* KR 페어 진행률 + 주 목표 + 5일 투두 체크박스 — 항상 표시
         이 영역의 클릭은 카드 navigation(onClick) 으로 버블되면 안 됨 */}
      {emp.big_goal_krs.length > 0 ? (
        <div
          className="mt-3 pt-3 space-y-3"
          style={{ borderTop: '1px solid var(--nv-hairline)' }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          {emp.big_goal_krs.map((kr) => (
            <BigKrDetailSection
              key={kr.kr_id}
              kr={kr}
              weekNumber={weekNumber}
              togglingTodoId={togglingTodoId}
              onToggleTodo={toggleTodo}
            />
          ))}
        </div>
      ) : (
        <div
          className="mt-3 pt-3"
          style={{ borderTop: '1px solid var(--nv-hairline)' }}
        >
          <span
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: 'var(--nv-mute)' }}
          >
            빅 목표 / KR 을 추가해주세요 <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}
      </div>
    </div>
  )
}

// ============================================================
// 빅 KR 상세 (펼침 안 표시)
// ============================================================
function BigKrDetailSection({
  kr,
  weekNumber,
  togglingTodoId,
  onToggleTodo,
}: {
  kr: BigKrDetail
  weekNumber: number
  togglingTodoId: string | null
  onToggleTodo: (id: string, status: string) => Promise<void>
}) {
  const leadColor = progressColor(kr.lead_progress)
  const lagColor = kr.lag_progress != null ? progressColor(kr.lag_progress) : null

  const weekTargetRate =
    kr.this_week_target_value > 0
      ? kr.this_week_actual_value / kr.this_week_target_value
      : 0
  const weekTodoDone = kr.this_week_todos.filter((t) => t.status === 'done').length
  const weekTodoRate =
    kr.this_week_todos.length > 0 ? weekTodoDone / kr.this_week_todos.length : 0

  // 날짜별 그룹
  const todosByDate = new Map<string, typeof kr.this_week_todos>()
  for (const t of kr.this_week_todos) {
    if (!todosByDate.has(t.date)) todosByDate.set(t.date, [])
    todosByDate.get(t.date)!.push(t)
  }
  const sortedDates = Array.from(todosByDate.keys()).sort()

  const PRI: Record<number, { label: string; color: string; bg: string }> = {
    1: { label: '!!', color: '#e52020', bg: '#fef2f2' }, // NVIDIA error
    2: { label: '·', color: '#df6500', bg: '#fff7ed' }, // NVIDIA warning
    3: { label: '·', color: '#898989', bg: '#f7f7f7' }, // NVIDIA stone + surface-soft
  }

  // NVIDIA single-hue: 선행=primary green, 후행=ink (검정)
  const LEAD_HUE = '#76b900' // var(--nv-primary)
  const LAG_HUE = '#1a1a1a' // var(--nv-body) — 검정 ink

  return (
    <div
      className="p-2"
      style={{
        border: '1px solid var(--nv-hairline)',
        backgroundColor: 'var(--nv-surface-soft)',
        borderRadius: '2px',
      }}
    >
      {/* KR 제목 */}
      <p
        className="text-[12px] font-bold mb-2 line-clamp-1"
        style={{ color: 'var(--nv-ink)' }}
      >
        <span
          className="inline-block w-1.5 h-1.5 mr-1 align-middle"
          style={{ backgroundColor: 'var(--nv-primary)' }}
        />
        {kr.kr_title}
      </p>

      {/* 선행 진행률 — green primary */}
      <div className="space-y-1 mb-2">
        <div className="flex items-center gap-1.5 text-[11.5px]">
          <TrendingUp className="w-2.5 h-2.5" style={{ color: LEAD_HUE }} />
          <span className="flex-1 truncate" style={{ color: 'var(--nv-mute)' }}>
            선행 (활동)
          </span>
          <span className="tabular-nums font-bold" style={{ color: leadColor }}>
            {Math.round(kr.lead_progress * 100)}%
          </span>
          <span className="text-[10.5px]" style={{ color: 'var(--nv-stone)' }}>
            {Math.round(kr.lead_current)}/{Math.round(kr.lead_target)}
          </span>
        </div>
        <div
          className="h-1"
          style={{ backgroundColor: '#ffffff', borderRadius: '2px' }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${kr.lead_progress * 100}%`,
              backgroundColor: LEAD_HUE,
              borderRadius: '2px',
            }}
          />
        </div>

        {/* 후행 (있을 때만) — black ink */}
        {kr.lag_progress != null && lagColor && (
          <>
            <div className="flex items-center gap-1.5 text-[11.5px]">
              <TrendingDown className="w-2.5 h-2.5" style={{ color: LAG_HUE }} />
              <span className="flex-1 truncate" style={{ color: 'var(--nv-mute)' }}>
                후행 (결과)
              </span>
              <span className="tabular-nums font-bold" style={{ color: lagColor }}>
                {Math.round(kr.lag_progress * 100)}%
              </span>
              <span className="text-[10.5px]" style={{ color: 'var(--nv-stone)' }}>
                {Math.round(Number(kr.lag_current ?? 0))}/
                {Math.round(Number(kr.lag_target ?? 0))}
              </span>
            </div>
            <div
              className="h-1"
              style={{ backgroundColor: '#ffffff', borderRadius: '2px' }}
            >
              <div
                className="h-full transition-all"
                style={{
                  width: `${kr.lag_progress * 100}%`,
                  backgroundColor: LAG_HUE,
                  borderRadius: '2px',
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* 이번 주 (W{n}) 주 목표 */}
      <div
        className="pt-2 mt-2 space-y-1.5"
        style={{ borderTop: '1px solid var(--nv-hairline)' }}
      >
        <div className="flex items-center gap-1.5">
          <Calendar className="w-2.5 h-2.5" style={{ color: 'var(--nv-mute)' }} />
          <span
            className="text-[10.5px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'var(--nv-mute)' }}
          >
            이번 주 W{weekNumber}
          </span>
          <span
            className="text-[10.5px] tabular-nums"
            style={{ color: 'var(--nv-stone)' }}
          >
            · 실적 {Math.round(kr.this_week_actual_value)}/
            {Math.round(kr.this_week_target_value)}
            <span
              className="ml-1 font-bold"
              style={{
                color:
                  weekTargetRate >= 0.8
                    ? '#76b900'
                    : weekTargetRate >= 0.6
                      ? '#df6500'
                      : '#e52020',
              }}
            >
              {Math.round(weekTargetRate * 100)}%
            </span>
          </span>
        </div>
        {kr.this_week_note ? (
          <p
            className="text-[12px] px-1.5 py-0.5"
            style={{
              color: 'var(--nv-ink)',
              backgroundColor: 'var(--nv-accent-pale)',
              borderLeft: '2px solid var(--nv-primary)',
              borderRadius: '2px',
            }}
          >
            🎯 {kr.this_week_note}
          </p>
        ) : (
          <p
            className="text-[11.5px] italic"
            style={{ color: 'var(--nv-stone)' }}
          >
            주 목표 미입력
          </p>
        )}

        {/* 5일 투두 + 체크박스 — NVIDIA 톤 */}
        {kr.this_week_todos.length > 0 ? (
          <div className="space-y-0.5">
            <div
              className="flex items-center gap-1 text-[10.5px]"
              style={{ color: 'var(--nv-mute)' }}
            >
              <span>
                ✓ {weekTodoDone}/{kr.this_week_todos.length}
              </span>
              <span
                className="font-bold"
                style={{
                  color:
                    weekTodoRate >= 0.8
                      ? '#76b900'
                      : weekTodoRate >= 0.6
                        ? '#df6500'
                        : '#e52020',
                }}
              >
                {Math.round(weekTodoRate * 100)}%
              </span>
            </div>
            {sortedDates.map((date) => {
              const dayTodos = todosByDate.get(date) ?? []
              const d = new Date(date)
              const dayLabel = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
              return (
                <div
                  key={date}
                  className="pl-1.5"
                  style={{ borderLeft: '2px solid var(--nv-hairline)' }}
                >
                  <div
                    className="text-[10.5px] mb-0.5"
                    style={{ color: 'var(--nv-mute)' }}
                  >
                    {dayLabel} {date.slice(5)}
                  </div>
                  {dayTodos.map((t) => {
                    const pri = (t.priority as 1 | 2 | 3) ?? 2
                    const meta = PRI[pri]
                    const isDone = t.status === 'done'
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-1 text-[11.5px] py-0.5"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleTodo(t.id, t.status)
                          }}
                          disabled={togglingTodoId === t.id}
                          className="w-3 h-3 shrink-0 flex items-center justify-center transition-colors"
                          style={{
                            backgroundColor: isDone ? 'var(--nv-primary)' : '#ffffff',
                            border: isDone
                              ? '1px solid var(--nv-primary)'
                              : '1px solid var(--nv-hairline)',
                            borderRadius: '2px',
                          }}
                          onMouseEnter={(e) => {
                            if (!isDone)
                              e.currentTarget.style.borderColor = 'var(--nv-ink)'
                          }}
                          onMouseLeave={(e) => {
                            if (!isDone)
                              e.currentTarget.style.borderColor = 'var(--nv-hairline)'
                          }}
                        >
                          {isDone && (
                            <Check
                              className="w-2 h-2"
                              style={{ color: '#000' }}
                              strokeWidth={3}
                            />
                          )}
                        </button>
                        <span
                          className="px-0.5 text-[8px] font-bold shrink-0"
                          style={{ color: meta.color }}
                          title={`우선순위 ${pri}`}
                        >
                          {meta.label}
                        </span>
                        <span
                          className="flex-1 truncate"
                          style={{
                            color: isDone ? 'var(--nv-stone)' : 'var(--nv-body)',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {t.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : (
          <p
            className="text-[11.5px] italic"
            style={{ color: 'var(--nv-stone)' }}
          >
            이번 주 투두 없음
          </p>
        )}
      </div>
    </div>
  )
}
