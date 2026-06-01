'use client'

/**
 * 직원별 OKR 트리 — Goal/KR 인라인 CRUD + 핀 토글
 * 펼치면 WeeklyTargetGrid + DailyTodoBoard
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Pin,
  PinOff,
  Trash2,
  ChevronDown,
  ChevronRight,
  Target,
  TrendingUp,
  TrendingDown,
  Loader2,
  X,
  Save,
  Pencil,
  Crown,
  Star,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BUSINESS_TRACK_LABEL,
  calcKrProgress,
  calcKrLagProgress,
  calcKrAvgProgress,
  formatKrValue,
  progressColor,
  startOfWeekMonday,
  KR_UNIT_OPTIONS,
  type BusinessTrack,
  type Employee,
  type EmployeeGoal,
  type KeyResult,
  type KrUnit,
} from '@/lib/cycle-okr'
import { KR_METRIC_CATALOG, KR_METRIC_GROUPS, getKrMetric } from '@/lib/kr-metrics'
import { cn } from '@/lib/utils'
import WamScoreBars from './WamScoreBars'
import WeeklyCardsBoard from './WeeklyCardsBoard'

const TRACK_BG: Record<BusinessTrack, string> = {
  b2b: '#dbeafe',
  b2c: '#fce7f3',
  both: '#f3f4f6',
}
const TRACK_TEXT: Record<BusinessTrack, string> = {
  b2b: '#1e40af',
  b2c: '#9d174d',
  both: '#1f2937',
}

interface Props {
  employee: Employee
  allEmployees: Employee[]
  cycleId: number
  cycleStart: string
  cycleEnd: string
  onError: (msg: string) => void
}

export default function OkrTree({
  employee,
  allEmployees,
  cycleId,
  cycleStart,
  cycleEnd,
  onError,
}: Props) {
  const [goals, setGoals] = useState<EmployeeGoal[]>([])
  const [krsByGoal, setKrsByGoal] = useState<Record<string, KeyResult[]>>({})
  const [loading, setLoading] = useState(true)
  const [showGoalForm, setShowGoalForm] = useState(false)

  // ──────── 로드 ────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      // 후행지표 자동 집계 먼저 (실패해도 진행)
      fetch('/api/cycle/lag-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employee.id }),
      }).catch(() => {})

      const gRes = await fetch(
        `/api/cycle/goals?cycle_id=${cycleId}&employee_id=${employee.id}`,
      )
      if (!gRes.ok) throw new Error(`goals ${gRes.status}`)
      const gJson = await gRes.json()
      const gs: EmployeeGoal[] = gJson.goals ?? []
      setGoals(gs)

      // KR fetch (goal 별)
      const krMap: Record<string, KeyResult[]> = {}
      await Promise.all(
        gs.map(async (g) => {
          const r = await fetch(`/api/cycle/key-results?goal_id=${g.id}`)
          if (r.ok) {
            const j = await r.json()
            krMap[g.id] = j.key_results ?? []
          }
        }),
      )
      setKrsByGoal(krMap)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'OKR 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [cycleId, employee.id, onError])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ──────── 통계 ────────
  const allKrs = useMemo(
    () => Object.values(krsByGoal).flat(),
    [krsByGoal],
  )
  const overallProgress = useMemo(() => {
    if (allKrs.length === 0) return 0
    const sum = allKrs.reduce((s, kr) => s + calcKrAvgProgress(kr), 0)
    return sum / allKrs.length
  }, [allKrs])
  const pinnedCount = useMemo(
    () => allKrs.filter((k) => k.is_company_pinned).length,
    [allKrs],
  )

  // ──────── Goal 삭제 ────────
  const handleGoalDelete = async (g: EmployeeGoal) => {
    if (!confirm(`"${g.title}" 목표와 모든 KR/주간/투두를 삭제할까요? (되돌릴 수 없음)`)) return
    try {
      const r = await fetch(`/api/cycle/goals/${g.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`${r.status}`)
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '목표 삭제 실패')
    }
  }

  if (loading) {
    return <div className="text-[12px] text-[#666]">OKR 트리 로드 중...</div>
  }

  return (
    <div className="space-y-3">
      {/* 직원 요약 */}
      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <span className="font-bold text-[#000]">
          {employee.name} 의 12주 OKR
        </span>
        <span className="text-[#cccccc]">·</span>
        <span>목표 {goals.length}</span>
        <span className="text-[#cccccc]">·</span>
        <span>KR {allKrs.length}</span>
        <span className="text-[#cccccc]">·</span>
        <span className="inline-flex items-center gap-1">
          <Pin className="w-3 h-3" style={{ color: 'var(--nv-primary)' }} fill="currentColor" />
          회사 핀 {pinnedCount}
        </span>
        <div className="flex-1" />
        <span className="text-[10px] text-[#666]">전체 진행률</span>
        <span
          className="text-[14px] font-bold tabular-nums"
          style={{ color: progressColor(overallProgress) }}
        >
          {Math.round(overallProgress * 100)}%
        </span>
      </div>

      {/* WAM 12주 점수 막대 */}
      <div
        className="border border-[#e5e5e5] bg-white p-3"
        style={{ borderRadius: '2px' }}
      >
        <WamScoreBars
          employeeId={employee.id}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
          onError={onError}
        />
      </div>

      {/* 목표 추가 */}
      {showGoalForm ? (
        <GoalForm
          mode="create"
          cycleId={cycleId}
          employeeId={employee.id}
          onCancel={() => setShowGoalForm(false)}
          onSaved={async () => {
            setShowGoalForm(false)
            await fetchAll()
          }}
          onError={onError}
        />
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowGoalForm(true)}
          className="gap-2"
          size="sm"
        >
          <Plus className="w-3.5 h-3.5" />
          12주 목표 추가
          {goals.length >= 3 && (
            <span className="text-[10px] text-[#f59e0b]">(권장 3개 초과)</span>
          )}
        </Button>
      )}

      {/* Goal 카드들 — 빅 목표 1개 + 지원 목표 N개 */}
      {goals.length === 0 ? (
        <div
          className="border border-dashed border-[#cccccc] bg-white py-8 text-center text-[12px] text-[#757575]"
          style={{ borderRadius: '2px' }}
        >
          아직 등록된 12주 목표가 없습니다. <strong>빅 목표 1개</strong>로 시작해보세요.
        </div>
      ) : (
        (() => {
          const bigGoal = goals.find((g) => g.is_big_goal)
          const supportGoals = goals.filter((g) => !g.is_big_goal)
          return (
            <div className="space-y-4">
              {bigGoal && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#f59e0b]">
                    <Crown className="w-3 h-3" fill="currentColor" />
                    빅 목표 — 12주의 단 하나
                  </div>
                  <GoalCard
                    goal={bigGoal}
                    krs={krsByGoal[bigGoal.id] ?? []}
                    employee={employee}
                    allEmployees={allEmployees}
                    cycleStart={cycleStart}
                    cycleEnd={cycleEnd}
                    cycleId={cycleId}
                    onDelete={() => handleGoalDelete(bigGoal)}
                    onRefresh={fetchAll}
                    onError={onError}
                    isBig
                  />
                </div>
              )}
              {supportGoals.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#666]">
                    <Star className="w-3 h-3" />
                    지원 목표
                  </div>
                  <div className="space-y-3">
                    {supportGoals.map((g) => (
                      <GoalCard
                        key={g.id}
                        goal={g}
                        krs={krsByGoal[g.id] ?? []}
                        employee={employee}
                        allEmployees={allEmployees}
                        cycleStart={cycleStart}
                        cycleEnd={cycleEnd}
                        cycleId={cycleId}
                        onDelete={() => handleGoalDelete(g)}
                        onRefresh={fetchAll}
                        onError={onError}
                        isBig={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()
      )}
    </div>
  )
}

// ============================================================
// Goal Card (목표 + 그 안에 KR 리스트)
// ============================================================
function GoalCard({
  goal,
  krs,
  employee,
  allEmployees,
  cycleStart,
  cycleEnd,
  cycleId,
  onDelete,
  onRefresh,
  onError,
  isBig,
}: {
  goal: EmployeeGoal
  krs: KeyResult[]
  employee: Employee
  allEmployees: Employee[]
  cycleStart: string
  cycleEnd: string
  cycleId: number
  onDelete: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string) => void
  isBig: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [showKrForm, setShowKrForm] = useState(false)
  const [togglingBig, setTogglingBig] = useState(false)
  /** GoalCard 가 통제하는 KR 펼침 상태 */
  const [expandedKrIds, setExpandedKrIds] = useState<Set<string>>(new Set())

  const toggleKrExpanded = useCallback((krId: string) => {
    setExpandedKrIds((prev) => {
      const next = new Set(prev)
      if (next.has(krId)) next.delete(krId)
      else next.add(krId)
      return next
    })
  }, [])

  const forceExpandKr = useCallback((krId: string) => {
    setExpandedKrIds((prev) => {
      if (prev.has(krId)) return prev
      const next = new Set(prev)
      next.add(krId)
      return next
    })
  }, [])

  const avgProgress = useMemo(() => {
    if (krs.length === 0) return 0
    return krs.reduce((s, k) => s + calcKrAvgProgress(k), 0) / krs.length
  }, [krs])

  const handleToggleBig = async () => {
    setTogglingBig(true)
    try {
      const r = await fetch(`/api/cycle/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_big_goal: !isBig }),
      })
      if (!r.ok) throw new Error(`${r.status}`)
      await onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : '빅 목표 변경 실패')
    } finally {
      setTogglingBig(false)
    }
  }

  return (
    <div
      className={cn(
        'bg-white',
        isBig ? 'border-2 border-[#f59e0b]' : 'border border-[#cccccc]',
      )}
      style={{ borderRadius: '2px' }}
    >
      {/* 헤더 */}
      <div className="p-3 border-b border-[#e5e5e5]">
        {editing ? (
          <GoalForm
            mode="edit"
            initial={goal}
            cycleId={goal.cycle_id}
            employeeId={goal.employee_id}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false)
              await onRefresh()
            }}
            onError={onError}
          />
        ) : (
          <div className="flex items-start gap-3">
            <Target
              className="w-4 h-4 mt-0.5 shrink-0"
              style={{ color: employee.color }}
              strokeWidth={2}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-bold tracking-tight text-[#000]">
                  {goal.title}
                </span>
                <span
                  className="px-1.5 py-0.5 text-[9px] font-bold"
                  style={{
                    backgroundColor: TRACK_BG[goal.business_track],
                    color: TRACK_TEXT[goal.business_track],
                    borderRadius: '2px',
                  }}
                >
                  {BUSINESS_TRACK_LABEL[goal.business_track]}
                </span>
                {krs.length > 0 && (
                  <span
                    className="text-[10px] font-bold tabular-nums"
                    style={{ color: progressColor(avgProgress) }}
                  >
                    {Math.round(avgProgress * 100)}%
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleToggleBig}
                disabled={togglingBig}
                className={cn(
                  'h-6 w-6 inline-flex items-center justify-center transition-colors',
                  isBig
                    ? 'text-[#f59e0b]'
                    : 'text-[#cccccc] hover:text-[#f59e0b]',
                )}
                style={{ borderRadius: '2px' }}
                title={isBig ? '빅 목표 해제' : '빅 목표로 지정 (1개만 가능)'}
              >
                {togglingBig ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Crown
                    className="w-3 h-3"
                    fill={isBig ? 'currentColor' : 'none'}
                    strokeWidth={2}
                  />
                )}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="h-6 w-6 inline-flex items-center justify-center hover:bg-[#f7f7f7]"
                style={{ borderRadius: '2px' }}
                title="수정"
              >
                <Pencil className="w-3 h-3 text-[#666]" strokeWidth={2} />
              </button>
              <button
                onClick={onDelete}
                className="h-6 w-6 inline-flex items-center justify-center hover:bg-[#fef2f2] text-[#991b1b]"
                style={{ borderRadius: '2px' }}
                title="삭제"
              >
                <Trash2 className="w-3 h-3" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KR 리스트 */}
      <div className="p-3 space-y-2 bg-[#fafafa]">
        {krs.length === 0 ? (
          <p className="text-[11px] text-[#999] py-2 text-center">
            아직 KR 이 없습니다. <strong>3개 권장</strong>.
          </p>
        ) : (
          krs.map((kr) => (
            <KrRow
              key={kr.id}
              kr={kr}
              employee={employee}
              allEmployees={allEmployees}
              cycleStart={cycleStart}
              cycleEnd={cycleEnd}
              cycleId={cycleId}
              onRefresh={onRefresh}
              onError={onError}
              expanded={expandedKrIds.has(kr.id)}
              onToggle={() => toggleKrExpanded(kr.id)}
            />
          ))
        )}

        {/* KR 추가 */}
        {showKrForm ? (
          <KrForm
            mode="create"
            goalId={goal.id}
            onCancel={() => setShowKrForm(false)}
            onSaved={async (newKrId) => {
              if (newKrId) forceExpandKr(newKrId)
              setShowKrForm(false)
              await onRefresh()
            }}
            onError={onError}
          />
        ) : (
          <button
            onClick={() => setShowKrForm(true)}
            className="w-full py-1.5 text-[11px] font-bold border border-dashed border-[#cccccc] hover:border-[#000] hover:bg-white transition-colors text-[#666] flex items-center justify-center gap-1.5"
            style={{ borderRadius: '2px' }}
          >
            <Plus className="w-3 h-3" />
            KR 추가
            {krs.length >= 3 && (
              <span className="text-[#f59e0b] text-[9px]">(권장 3개 초과)</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// KR Row (1줄 + 펼치면 주간/투두)
// ============================================================
function KrRow({
  kr,
  employee,
  allEmployees,
  cycleStart,
  cycleEnd,
  cycleId,
  onRefresh,
  onError,
  expanded,
  onToggle,
}: {
  kr: KeyResult
  employee: Employee
  allEmployees: Employee[]
  cycleStart: string
  cycleEnd: string
  cycleId: number
  onRefresh: () => Promise<void>
  onError: (msg: string) => void
  expanded: boolean
  onToggle: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [pinning, setPinning] = useState(false)

  const leadProgress = calcKrProgress(kr)
  const lagProgress = calcKrLagProgress(kr)
  const avgProgress = calcKrAvgProgress(kr)
  const color = progressColor(avgProgress)
  const leadMetricMeta = kr.metric_code ? getKrMetric(kr.metric_code) : null
  const lagMetricMeta = kr.lag_metric_code ? getKrMetric(kr.lag_metric_code) : null

  const handlePin = async () => {
    setPinning(true)
    try {
      const r = await fetch(`/api/cycle/key-results/${kr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_company_pinned: !kr.is_company_pinned }),
      })
      if (!r.ok) throw new Error(`${r.status}`)
      await onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : '핀 토글 실패')
    } finally {
      setPinning(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`"${kr.title}" KR 을 삭제할까요? (주간 타겟·연결된 투두 함께 삭제)`)) return
    try {
      const r = await fetch(`/api/cycle/key-results/${kr.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`${r.status}`)
      await onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'KR 삭제 실패')
    }
  }

  if (editing) {
    return (
      <KrForm
        mode="edit"
        goalId={kr.goal_id}
        initial={kr}
        onCancel={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false)
          await onRefresh()
        }}
        onError={onError}
      />
    )
  }

  return (
    <div
      className={cn(
        'border bg-white transition-colors',
        kr.is_company_pinned ? 'border-[var(--nv-primary)]' : 'border-[#e5e5e5]',
      )}
      style={{ borderRadius: '2px' }}
    >
      {/* 헤더 */}
      <div className="flex items-start gap-2 p-2">
        <button
          onClick={onToggle}
          className="flex items-start gap-2 flex-1 min-w-0 text-left"
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 mt-1 shrink-0 text-[#666]" strokeWidth={2} />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 mt-1 shrink-0 text-[#666]" strokeWidth={2} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold tracking-tight text-[#000] truncate">
              {kr.title}
            </p>
            {/* 선행 + 후행 두 줄 진행률 */}
            <div className="space-y-0.5 mt-1">
              {/* 선행 */}
              {leadMetricMeta && (
                <KrMetricRow
                  icon={<TrendingUp className="w-3 h-3 text-[#0ea5e9]" strokeWidth={2} />}
                  emoji={leadMetricMeta.emoji}
                  label={leadMetricMeta.label}
                  current={kr.current_value}
                  target={kr.target_value}
                  unit={kr.unit}
                  progress={leadProgress}
                  autoSync={kr.auto_sync}
                />
              )}
              {/* 후행 */}
              {lagMetricMeta && kr.lag_target_value != null && (
                <KrMetricRow
                  icon={<TrendingDown className="w-3 h-3 text-[#a855f7]" strokeWidth={2} />}
                  emoji={lagMetricMeta.emoji}
                  label={lagMetricMeta.label}
                  current={Number(kr.lag_current_value ?? 0)}
                  target={Number(kr.lag_target_value)}
                  unit={(kr.lag_unit ?? 'count') as KrUnit}
                  progress={lagProgress ?? 0}
                  autoSync={kr.lag_auto_sync}
                />
              )}
            </div>
          </div>
        </button>

        {/* 평균 진행률 + 액션 */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-[14px] font-bold tabular-nums" style={{ color }}>
              {Math.round(avgProgress * 100)}%
            </div>
            <div className="text-[8px] text-[#999] uppercase tracking-wider">
              {lagProgress != null ? '평균' : '선행'}
            </div>
          </div>

          <button
            onClick={handlePin}
            disabled={pinning}
            className={cn(
              'h-6 w-6 inline-flex items-center justify-center transition-colors',
              kr.is_company_pinned
                ? 'text-[var(--nv-primary)]'
                : 'text-[#cccccc] hover:text-[#666]',
            )}
            style={{ borderRadius: '2px' }}
            title={kr.is_company_pinned ? '회사 핀 해제' : '회사 핀 (메인 대시보드 노출)'}
          >
            {pinning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : kr.is_company_pinned ? (
              <Pin className="w-3 h-3" fill="currentColor" strokeWidth={2} />
            ) : (
              <PinOff className="w-3 h-3" strokeWidth={2} />
            )}
          </button>

          <button
            onClick={() => setEditing(true)}
            className="h-6 w-6 inline-flex items-center justify-center hover:bg-[#f7f7f7]"
            style={{ borderRadius: '2px' }}
            title="수정"
          >
            <Pencil className="w-3 h-3 text-[#666]" strokeWidth={2} />
          </button>
          <button
            onClick={handleDelete}
            className="h-6 w-6 inline-flex items-center justify-center hover:bg-[#fef2f2] text-[#991b1b]"
            style={{ borderRadius: '2px' }}
            title="삭제"
          >
            <Trash2 className="w-3 h-3" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* 진행 바 — 선행 (위 50%) + 후행 (아래 50%) 두 줄 */}
      <div className="flex flex-col">
        <div className="h-[3px] bg-[#f3f4f6]">
          <div
            className="h-full transition-all"
            style={{
              width: `${leadProgress * 100}%`,
              backgroundColor: '#0ea5e9',
            }}
          />
        </div>
        {lagProgress != null && (
          <div className="h-[3px] bg-[#f3f4f6]">
            <div
              className="h-full transition-all"
              style={{
                width: `${lagProgress * 100}%`,
                backgroundColor: '#a855f7',
              }}
            />
          </div>
        )}
      </div>

      {/* 펼친 영역: 후행 희망 성과 + 12주 주별 카드 */}
      {expanded && (
        <div className="border-t border-[#e5e5e5] p-3 space-y-3 bg-[#fafafa]">
          {/* 후행지표 희망 성과 (있을 때만) */}
          {kr.expected_lag_impact && (
            <div
              className="border-l-2 border-[#a855f7] bg-white px-3 py-2"
              style={{ borderRadius: '2px' }}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <TrendingDown className="w-3 h-3 text-[#a855f7]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#666]">
                  후행지표 희망 성과
                </span>
              </div>
              <p className="text-[12px] text-[#000] leading-snug">
                → {kr.expected_lag_impact}
              </p>
            </div>
          )}
          <WeeklyCardsBoard
            employee={employee}
            keyResultId={kr.id}
            unit={kr.unit}
            startedDate={kr.started_date}
            cycleStart={cycleStart}
            cycleEnd={cycleEnd}
            cycleId={cycleId}
            onError={onError}
            onActualChanged={onRefresh}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================
// KR 메트릭 미니 행 (선행 또는 후행 한 줄)
// ============================================================
function KrMetricRow({
  icon,
  emoji,
  label,
  current,
  target,
  unit,
  progress,
  autoSync,
}: {
  icon: React.ReactNode
  emoji: string
  label: string
  current: number
  target: number
  unit: KrUnit
  progress: number
  autoSync: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      {icon}
      <span>{emoji}</span>
      <span className="text-[#666] truncate">{label}</span>
      {autoSync && (
        <Zap className="w-2.5 h-2.5 text-[#76b900] shrink-0" fill="currentColor" />
      )}
      <span className="text-[#cccccc]">·</span>
      <span className="font-bold tabular-nums" style={{ color: progressColor(progress) }}>
        {formatKrValue(current, unit)} / {formatKrValue(target, unit)}
      </span>
      <span className="text-[9px] text-[#999] tabular-nums">
        {Math.round(progress * 100)}%
      </span>
    </div>
  )
}

// ============================================================
// Goal 추가/수정 폼
// ============================================================
function GoalForm({
  mode,
  initial,
  cycleId,
  employeeId,
  onCancel,
  onSaved,
  onError,
}: {
  mode: 'create' | 'edit'
  initial?: EmployeeGoal
  cycleId: number
  employeeId: string
  onCancel: () => void
  onSaved: () => Promise<void>
  onError: (msg: string) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [track, setTrack] = useState<BusinessTrack>(initial?.business_track ?? 'both')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) {
      onError('목표 제목은 필수입니다.')
      return
    }
    setSaving(true)
    try {
      const url =
        mode === 'create'
          ? '/api/cycle/goals'
          : `/api/cycle/goals/${initial!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const body: Record<string, unknown> = {
        title: title.trim(),
        business_track: track,
      }
      if (mode === 'create') {
        body.cycle_id = cycleId
        body.employee_id = employeeId
      }
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error ?? `${r.status}`)
      }
      await onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="border border-[#cccccc] bg-white p-3 space-y-2"
      style={{ borderRadius: '2px' }}
    >
      <Input
        placeholder="목표 제목 (예: B2C 인스타 쇼핑 진입 + 첫 매출)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-[13px] font-bold"
      />
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-[#666]">트랙:</span>
        <select
          value={track}
          onChange={(e) => setTrack(e.target.value as BusinessTrack)}
          className="h-7 px-2 text-[12px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
          style={{ borderRadius: '2px' }}
        >
          <option value="both">공통</option>
          <option value="b2b">B2B</option>
          <option value="b2c">B2C</option>
        </select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          <X className="w-3 h-3" />
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              <Save className="w-3 h-3 mr-1" />
              저장
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// KR 추가/수정 폼 — 선행 + 후행 페어 (V3)
// ============================================================
function KrForm({
  mode,
  goalId,
  initial,
  onCancel,
  onSaved,
  onError,
}: {
  mode: 'create' | 'edit'
  goalId: string
  initial?: KeyResult
  onCancel: () => void
  onSaved: (newKrId?: string) => Promise<void>
  onError: (msg: string) => void
}) {
  // 공통
  const [title, setTitle] = useState(initial?.title ?? '')
  const [expectedLag, setExpectedLag] = useState(initial?.expected_lag_impact ?? '')
  const [saving, setSaving] = useState(false)

  // 선행 측정값
  const [leadCode, setLeadCode] = useState<string>(initial?.metric_code ?? '')
  const [leadUnit, setLeadUnit] = useState<KrUnit>(initial?.unit ?? 'count')
  const [leadAutoSync, setLeadAutoSync] = useState(initial?.auto_sync ?? false)
  const [leadStart, setLeadStart] = useState(String(initial?.start_value ?? 0))
  const [leadTarget, setLeadTarget] = useState(String(initial?.target_value ?? ''))
  const [leadCurrent, setLeadCurrent] = useState(String(initial?.current_value ?? 0))

  // 시작일 + 12주 주별 타겟 (인라인)
  const [startedDate, setStartedDate] = useState<string>(
    initial?.started_date ?? new Date().toISOString().slice(0, 10),
  )
  const [weeklyTargets, setWeeklyTargets] = useState<Record<number, string>>({})
  // 주별 실적값 (사용자가 사이클 진행 중 직접 입력)
  const [weeklyActuals, setWeeklyActuals] = useState<Record<number, string>>({})
  // 주별 메타 — 주 목표 + 5일 투두 (KrForm 안 인라인)
  interface WeekTodo {
    date: string // YYYY-MM-DD (월~금)
    title: string
    priority: 1 | 2 | 3
    done?: boolean
  }
  const [weeklyNotes, setWeeklyNotes] = useState<Record<number, string>>({})
  const [weeklyTodos, setWeeklyTodos] = useState<Record<number, WeekTodo[]>>({})
  const [expandedWeekInForm, setExpandedWeekInForm] = useState<number | null>(null)

  // 편집 모드 — 기존 KR 의 weekly_targets 를 prefetch 해서 weeklyTargets/Actuals/Notes prefill
  // useRef 가드: mount 시 단 한 번만 prefill. 이후 사용자가 입력한 값은 절대 덮어쓰지 않음.
  const prefilledRef = useRef(false)
  useEffect(() => {
    if (!initial?.id) return
    if (prefilledRef.current) return
    let cancelled = false
    fetch(`/api/cycle/weekly-targets?key_result_id=${initial.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.weekly_targets) return
        const tgt: Record<number, string> = {}
        const act: Record<number, string> = {}
        const notes: Record<number, string> = {}
        const touched = new Set<number>()
        for (const w of j.weekly_targets) {
          tgt[w.week_number] = String(w.target_value ?? '')
          act[w.week_number] =
            w.actual_value != null && Number(w.actual_value) !== 0
              ? String(w.actual_value)
              : ''
          if (w.note) notes[w.week_number] = w.note
          touched.add(w.week_number)
        }
        setWeeklyTargets(tgt)
        setWeeklyActuals(act)
        setWeeklyNotes((prev) => ({ ...prev, ...notes }))
        setTouchedWeeks(touched) // 기존 값 자동 균등분할 덮어쓰지 않음
        prefilledRef.current = true
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [initial?.id])

  // 후행 측정값 (페어)
  const [lagCode, setLagCode] = useState<string>(initial?.lag_metric_code ?? '')
  const [lagUnit, setLagUnit] = useState<KrUnit>((initial?.lag_unit ?? 'count') as KrUnit)
  const [lagAutoSync, setLagAutoSync] = useState(initial?.lag_auto_sync ?? false)
  const [lagStart, setLagStart] = useState(String(initial?.lag_start_value ?? ''))
  const [lagTarget, setLagTarget] = useState(String(initial?.lag_target_value ?? ''))
  const [lagCurrent, setLagCurrent] = useState(String(initial?.lag_current_value ?? ''))

  const leadMetric = leadCode ? getKrMetric(leadCode) : null
  const lagMetric = lagCode ? getKrMetric(lagCode) : null

  // 시작값/목표값 입력 시 12주 자동 균등 분할 (사용자가 직접 수정 안 한 칸만)
  const [touchedWeeks, setTouchedWeeks] = useState<Set<number>>(new Set())
  useEffect(() => {
    const s = Number(leadStart || 0)
    const t = Number(leadTarget || 0)
    if (!leadTarget || Number.isNaN(t)) return
    const span = t - s
    setWeeklyTargets((prev) => {
      const next = { ...prev }
      for (let w = 1; w <= 12; w++) {
        if (touchedWeeks.has(w)) continue
        next[w] = String(Number((s + (span * w) / 12).toFixed(2)))
      }
      return next
    })
  }, [leadStart, leadTarget, touchedWeeks])

  // 시작일이 포함된 주의 월요일부터 12주 (월~금)
  const weekDates = useMemo(() => {
    const out: Array<{ week: number; mon: string; fri: string }> = []
    if (!startedDate) return out
    const start = startOfWeekMonday(startedDate)
    for (let w = 0; w < 12; w++) {
      const mon = new Date(start)
      mon.setDate(start.getDate() + w * 7)
      const fri = new Date(mon)
      fri.setDate(mon.getDate() + 4)
      out.push({
        week: w + 1,
        mon: `${mon.getMonth() + 1}/${mon.getDate()}`,
        fri: `${fri.getMonth() + 1}/${fri.getDate()}`,
      })
    }
    return out
  }, [startedDate])

  const selectLead = (code: string) => {
    const m = getKrMetric(code)
    if (!m) return
    setLeadCode(code)
    setLeadUnit(m.unit === 'KRW' ? 'KRW' : m.unit)
    setLeadAutoSync(m.auto_sync)
    if (!title.trim() || isMetricDefaultTitle(title)) {
      setTitle(code === 'custom' ? '' : m.label)
    }
  }

  const selectLag = (code: string) => {
    const m = getKrMetric(code)
    if (!m) return
    setLagCode(code)
    setLagUnit(m.unit === 'KRW' ? 'KRW' : m.unit)
    setLagAutoSync(m.auto_sync)
  }

  const handleSubmit = async () => {
    if (!leadCode) {
      onError('선행 메트릭을 선택하세요.')
      return
    }
    if (!title.trim() || !leadTarget) {
      onError('KR 제목·선행 목표값은 필수입니다.')
      return
    }
    const leadS = Number(leadStart || 0)
    const leadT = Number(leadTarget)
    const leadC = Number(leadCurrent || leadS)
    if (Number.isNaN(leadT)) {
      onError('선행 목표값은 숫자여야 합니다.')
      return
    }

    let lagPayload: Record<string, unknown> | null = null
    if (lagCode) {
      if (!lagTarget) {
        onError('후행 메트릭을 선택했으면 후행 목표값도 입력하세요.')
        return
      }
      const lagS = Number(lagStart || 0)
      const lagT = Number(lagTarget)
      const lagC = Number(lagCurrent || lagS)
      if (Number.isNaN(lagT)) {
        onError('후행 목표값은 숫자여야 합니다.')
        return
      }
      lagPayload = {
        lag_metric_code: lagCode,
        lag_unit: lagUnit,
        lag_auto_sync: lagAutoSync,
        lag_start_value: lagS,
        lag_target_value: lagT,
        lag_current_value: lagC,
      }
    } else {
      // 후행 비우기 (모두 null)
      lagPayload = {
        lag_metric_code: null,
        lag_unit: null,
        lag_auto_sync: false,
        lag_start_value: null,
        lag_target_value: null,
        lag_current_value: null,
      }
    }

    setSaving(true)
    try {
      const url =
        mode === 'create'
          ? '/api/cycle/key-results'
          : `/api/cycle/key-results/${initial!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const weeklyTargetsPayload = Array.from({ length: 12 }).map((_, i) => {
        const week = i + 1
        const actualStr = weeklyActuals[week]
        return {
          week_number: week,
          target_value: Number(weeklyTargets[week] ?? 0),
          actual_value:
            actualStr != null && actualStr !== ''
              ? Number(actualStr)
              : null,
          note: weeklyNotes[week] || null,
          todos: (weeklyTodos[week] ?? []).map((t) => ({
            date: t.date,
            title: t.title,
            priority: t.priority,
            status: t.done ? 'done' : 'todo',
          })),
        }
      })

      const body: Record<string, unknown> = {
        title: title.trim(),
        // 선행
        unit: leadUnit,
        is_leading: true,
        start_value: leadS,
        target_value: leadT,
        current_value: leadC,
        metric_code: leadCode,
        auto_sync: leadAutoSync,
        // 시작일 + 12주 타겟
        started_date: startedDate || null,
        weekly_targets: weeklyTargetsPayload,
        // 후행
        ...lagPayload,
        // 공통
        expected_lag_impact: expectedLag.trim() || null,
      }
      if (mode === 'create') body.goal_id = goalId
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error ?? `${r.status}`)
      }
      const j = await r.json().catch(() => null)
      const newKrId: string | undefined = mode === 'create' ? j?.key_result?.id : initial?.id
      await onSaved(newKrId)
    } catch (e) {
      onError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="border border-[var(--nv-primary)] bg-white p-3 space-y-3"
      style={{ borderRadius: '2px' }}
    >
      {/* 단계 가이드 */}
      <div
        className="bg-[#f9fafb] border border-[#e5e5e5] p-2 text-[10px] text-[#666]"
        style={{ borderRadius: '2px' }}
      >
        <p className="font-bold text-[#000] mb-0.5">📋 KR 작성 흐름</p>
        <p>
          <strong>1.</strong> 제목 → <strong>2.</strong> 선행 (시작/목표) →{' '}
          <strong>📅 시작일 + 12주 주별 타겟</strong> →{' '}
          <strong>3.</strong> 후행 (선택) → <strong>4.</strong> 후행 희망 성과 → 저장 → 각 주 카드에서 월~금 투두 입력
        </p>
      </div>

      {/* 1️⃣ 제목 */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#666] block mb-1">
          1️⃣ KR 제목
        </label>
        <Input
          placeholder="예: B2C 인스타 활동 → 첫 매출 발생"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-[12px] font-bold"
        />
      </div>

      {/* 2️⃣ 선행 측정값 */}
      <PairSection
        label="2️⃣ 선행 (활동) — 내가 통제 가능"
        labelIcon={<TrendingUp className="w-3 h-3 text-[#0ea5e9]" />}
        labelColor="#0ea5e9"
        bgColor="#eff6ff"
        borderColor="#bfdbfe"
        metricGroup={KR_METRIC_GROUPS.activity}
        selectedCode={leadCode}
        onSelectMetric={selectLead}
        selectedMetric={leadMetric}
        unit={leadUnit}
        onUnitChange={setLeadUnit}
        autoSync={leadAutoSync}
        startValue={leadStart}
        onStartChange={setLeadStart}
        targetValue={leadTarget}
        onTargetChange={setLeadTarget}
        currentValue={leadCurrent}
        onCurrentChange={setLeadCurrent}
        required
      />

      {/* 시작일 + 12주 주별 타겟 (인라인) */}
      {leadCode && leadTarget && (
        <div
          className="p-2.5 border space-y-2"
          style={{ backgroundColor: '#fffbeb', borderColor: '#fcd34d', borderRadius: '2px' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#92400e]">
              📅 KR 시작일 + 12주 주별 타겟
            </span>
            <div className="flex-1" />
            <Input
              type="date"
              value={startedDate}
              onChange={(e) => setStartedDate(e.target.value)}
              className="h-7 w-[140px] text-[11px]"
            />
            {weekDates.length === 12 && (
              <span className="text-[10px] text-[#92400e]">
                ~ {weekDates[11].fri} (금)
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#92400e]">
            시작값에서 목표값까지 12주간 분할. 자동 채워진 값을 그대로 두거나 칸을 클릭해 직접 수정.
            각 주 카드는 저장 후 KR 펼침에서 클릭 → 월~금 투두 입력.
          </p>
          <div className="space-y-1">
            {weekDates.map(({ week, mon, fri }) => {
              const isExpanded = expandedWeekInForm === week
              const note = weeklyNotes[week] ?? ''
              const todos = weeklyTodos[week] ?? []
              const doneTodos = todos.length

              return (
                <div
                  key={week}
                  className="bg-white border border-[#fcd34d]"
                  style={{ borderRadius: '2px' }}
                >
                  {/* 헤더 — 클릭 시 펼침 */}
                  <div className="p-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedWeekInForm(isExpanded ? null : week)
                      }
                      className="text-[#92400e] shrink-0"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <span className="text-[11px] font-bold text-[#92400e] w-8 shrink-0">
                      W{week}
                    </span>
                    <span className="text-[10px] text-[#92400e] w-20 shrink-0">
                      {mon}~{fri}
                    </span>
                    <span className="text-[10px] text-[#666] shrink-0">목표</span>
                    <Input
                      type="number"
                      value={weeklyTargets[week] ?? ''}
                      onChange={(e) => {
                        setTouchedWeeks((prev) => new Set(prev).add(week))
                        setWeeklyTargets((prev) => ({
                          ...prev,
                          [week]: e.target.value,
                        }))
                      }}
                      className="h-7 text-[11px] w-20"
                    />
                    {/* 실적은 펼침 안 큰 박스에서 입력. 헤더에는 읽기 전용 표시 */}
                    {(() => {
                      const t = Number(weeklyTargets[week] || 0)
                      const a = Number(weeklyActuals[week] || 0)
                      const hasActual =
                        weeklyActuals[week] != null && weeklyActuals[week] !== ''
                      if (!hasActual) {
                        return (
                          <span
                            className="text-[10px] shrink-0"
                            style={{ color: 'var(--nv-stone)' }}
                          >
                            · 실적 —
                          </span>
                        )
                      }
                      const rate = t > 0 ? (a / t) * 100 : 0
                      const color =
                        rate >= 80
                          ? '#76b900'
                          : rate >= 60
                            ? '#df6500'
                            : '#e52020'
                      return (
                        <span
                          className="text-[10px] tabular-nums shrink-0 inline-flex items-center gap-1"
                          style={{ color: 'var(--nv-mute)' }}
                        >
                          · 실적{' '}
                          <strong className="tabular-nums" style={{ color }}>
                            {a}
                          </strong>
                          {t > 0 && (
                            <strong className="tabular-nums" style={{ color }}>
                              {Math.round(rate)}%
                            </strong>
                          )}
                        </span>
                      )
                    })()}
                    {note && (
                      <span
                        className="text-[10px] text-[#000] truncate flex-1 min-w-0"
                        title={note}
                      >
                        🎯 {note}
                      </span>
                    )}
                    {!note && (
                      <span className="text-[10px] text-[#999] italic flex-1 min-w-0">
                        🎯 클릭 → 주 목표 + 5일 투두
                      </span>
                    )}
                    <span className="text-[10px] text-[#666] shrink-0 tabular-nums">
                      투두 {doneTodos}
                    </span>
                  </div>

                  {/* 펼친 영역: 큰 실적 입력 박스 + 주 목표 + 5일 투두 */}
                  {isExpanded && (
                    <ActualInputBox
                      week={week}
                      target={Number(weeklyTargets[week] ?? 0)}
                      actual={weeklyActuals[week] ?? ''}
                      onActualChange={(v) =>
                        setWeeklyActuals((prev) => ({ ...prev, [week]: v }))
                      }
                    />
                  )}
                  {isExpanded && (
                    <WeekFormDetail
                      week={week}
                      mon={mon}
                      fri={fri}
                      note={note}
                      onNoteChange={(v) =>
                        setWeeklyNotes((prev) => ({ ...prev, [week]: v }))
                      }
                      todos={todos}
                      onAddTodo={(date, title, priority) => {
                        setWeeklyTodos((prev) => ({
                          ...prev,
                          [week]: [
                            ...(prev[week] ?? []),
                            { date, title: title.trim(), priority, done: false },
                          ],
                        }))
                      }}
                      onRemoveTodo={(idx) => {
                        setWeeklyTodos((prev) => ({
                          ...prev,
                          [week]: (prev[week] ?? []).filter((_, i) => i !== idx),
                        }))
                      }}
                      onChangePriority={(idx, p) => {
                        setWeeklyTodos((prev) => ({
                          ...prev,
                          [week]: (prev[week] ?? []).map((t, i) =>
                            i === idx ? { ...t, priority: p } : t,
                          ),
                        }))
                      }}
                      onToggleDone={(idx) => {
                        setWeeklyTodos((prev) => ({
                          ...prev,
                          [week]: (prev[week] ?? []).map((t, i) =>
                            i === idx ? { ...t, done: !t.done } : t,
                          ),
                        }))
                      }}
                      startedDate={startedDate}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3️⃣ 후행 측정값 (선택) */}
      <PairSection
        label="3️⃣ 후행 (결과) — 활동의 기대 결과 (선택)"
        labelIcon={<TrendingDown className="w-3 h-3 text-[#a855f7]" />}
        labelColor="#a855f7"
        bgColor="#faf5ff"
        borderColor="#e9d5ff"
        metricGroup={KR_METRIC_GROUPS.result}
        selectedCode={lagCode}
        onSelectMetric={selectLag}
        selectedMetric={lagMetric}
        unit={lagUnit}
        onUnitChange={setLagUnit}
        autoSync={lagAutoSync}
        startValue={lagStart}
        onStartChange={setLagStart}
        targetValue={lagTarget}
        onTargetChange={setLagTarget}
        currentValue={lagCurrent}
        onCurrentChange={setLagCurrent}
        clearable
        onClear={() => {
          setLagCode('')
          setLagStart('')
          setLagTarget('')
          setLagCurrent('')
        }}
      />

      {/* 4️⃣ 후행 희망 성과 */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#666] block mb-1">
          4️⃣ 후행 희망 성과 — 자유 설명 (선택)
        </label>
        <textarea
          value={expectedLag}
          onChange={(e) => setExpectedLag(e.target.value)}
          rows={2}
          placeholder="예: 회사 전체 매출 +10% 기여 · 다음 사이클 KR 의 기반"
          className="w-full px-2 py-1.5 text-[12px] border border-[#cccccc] bg-white outline-none focus:border-[#a855f7] resize-none"
          style={{ borderRadius: '2px' }}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          <X className="w-3 h-3" />
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={saving || !leadCode}>
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              <Save className="w-3 h-3 mr-1" />
              저장 → 주별 타겟 자동 펼침
            </>
          )}
        </Button>
      </div>

      {mode === 'create' && (
        <p className="text-[10px] text-[#666]">
          ℹ 저장 시 선행 측정값 기준으로 12주 주별 타겟이 균등 분할로 자동 생성됩니다.
          후행 측정값은 사이클 종료 시점에 평가.
        </p>
      )}
    </div>
  )
}

// ============================================================
// 한 주의 디테일 (KrForm 안에서 W{n} 펼친 상태)
// 주 목표 (note) + 월~금 5일 투두
// ============================================================
interface WeekTodoLocal {
  date: string
  title: string
  priority: 1 | 2 | 3
  done?: boolean
}

// ============================================================
// 큰 실적 입력 박스 — 펼친 영역 안에서 크고 시각적으로 강조
// ============================================================
function ActualInputBox({
  week,
  target,
  actual,
  onActualChange,
}: {
  week: number
  target: number
  actual: string
  onActualChange: (v: string) => void
}) {
  const a = Number(actual || 0)
  const hasActual = actual != null && actual !== ''
  const rate = target > 0 && hasActual ? (a / target) * 100 : 0
  const color =
    !hasActual
      ? 'var(--nv-stone)'
      : rate >= 80
        ? '#76b900'
        : rate >= 60
          ? '#df6500'
          : '#e52020'
  const bgColor =
    !hasActual
      ? '#ffffff'
      : rate >= 80
        ? '#f3fbe1'
        : rate >= 60
          ? '#fff7ed'
          : '#fef2f2'

  return (
    <div
      className="px-3 py-3 flex items-center gap-3"
      style={{
        backgroundColor: bgColor,
        border: '2px solid',
        borderColor: hasActual ? color : 'var(--nv-hairline)',
        borderRadius: '2px',
        margin: '4px',
      }}
    >
      <div className="shrink-0">
        <div
          className="text-[9px] font-bold uppercase tracking-[0.14em]"
          style={{ color: 'var(--nv-mute)' }}
        >
          W{week} 이 주 실적
        </div>
        <div className="text-[10px]" style={{ color: 'var(--nv-stone)' }}>
          목표 <strong style={{ color: 'var(--nv-ink)' }}>{target.toLocaleString()}</strong>
        </div>
      </div>
      <input
        type="number"
        value={actual}
        onChange={(e) => onActualChange(e.target.value)}
        placeholder="실적 숫자 입력"
        className="flex-1 h-12 px-3 text-[20px] font-bold tabular-nums outline-none"
        style={{
          border: '1px solid var(--nv-hairline)',
          borderRadius: '2px',
          color: hasActual ? color : 'var(--nv-ink)',
          backgroundColor: '#ffffff',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--nv-primary)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--nv-hairline)')}
      />
      {hasActual && target > 0 && (
        <div className="text-right shrink-0 min-w-[60px]">
          <div
            className="text-[20px] font-bold tabular-nums leading-none"
            style={{ color }}
          >
            {Math.round(rate)}%
          </div>
          <div className="text-[9px]" style={{ color: 'var(--nv-stone)' }}>
            달성률
          </div>
        </div>
      )}
    </div>
  )
}

function WeekFormDetail({
  week,
  mon,
  fri,
  note,
  onNoteChange,
  todos,
  onAddTodo,
  onRemoveTodo,
  onChangePriority,
  onToggleDone,
  startedDate,
}: {
  week: number
  mon: string
  fri: string
  note: string
  onNoteChange: (v: string) => void
  todos: WeekTodoLocal[]
  onAddTodo: (date: string, title: string, priority: 1 | 2 | 3) => void
  onRemoveTodo: (idx: number) => void
  onChangePriority: (idx: number, p: 1 | 2 | 3) => void
  onToggleDone: (idx: number) => void
  startedDate: string
}) {
  // 이 주의 월~금 5일 날짜 (월요일 정규화)
  const days = useMemo(() => {
    const out: string[] = []
    if (!startedDate) return out
    const start = startOfWeekMonday(startedDate)
    const monDate = new Date(start)
    monDate.setDate(start.getDate() + (week - 1) * 7)
    for (let i = 0; i < 5; i++) {
      const dd = new Date(monDate)
      dd.setDate(monDate.getDate() + i)
      const yyyy = dd.getFullYear()
      const mm = String(dd.getMonth() + 1).padStart(2, '0')
      const day = String(dd.getDate()).padStart(2, '0')
      out.push(`${yyyy}-${mm}-${day}`)
    }
    return out
  }, [startedDate, week])

  const dayLabels = ['월', '화', '수', '목', '금']

  return (
    <div className="border-t border-[#fcd34d] p-2 bg-[#fffbeb] space-y-2">
      {/* 주 목표 textarea */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#92400e] block mb-1">
          🎯 W{week} ({mon}~{fri}) 주 목표 — 핵심 한 줄
        </label>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          placeholder="예: 디자이너 컨택 10건 + 미팅 2건 + 콘텐츠 5개 발행"
          className="w-full text-[12px] px-2 py-1 border border-[#cccccc] bg-white outline-none focus:border-[#f59e0b] resize-none"
          style={{ borderRadius: '2px' }}
        />
      </div>

      {/* 5일 투두 */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-[#92400e]">
          📅 매일 해야할 일 (월~금)
        </p>
        {days.map((date, i) => (
          <FormDayRow
            key={date}
            date={date}
            dayLabel={dayLabels[i]}
            todos={todos
              .map((t, idx) => ({ ...t, _idx: idx }))
              .filter((t) => t.date === date)
              .sort((a, b) => a.priority - b.priority)}
            onAdd={(title, priority) => onAddTodo(date, title, priority)}
            onRemove={onRemoveTodo}
            onChangePriority={onChangePriority}
            onToggleDone={onToggleDone}
          />
        ))}
      </div>
    </div>
  )
}

function FormDayRow({
  date,
  dayLabel,
  todos,
  onAdd,
  onRemove,
  onChangePriority,
  onToggleDone,
}: {
  date: string
  dayLabel: string
  todos: Array<WeekTodoLocal & { _idx: number }>
  onAdd: (title: string, priority: 1 | 2 | 3) => void
  onRemove: (idx: number) => void
  onChangePriority: (idx: number, p: 1 | 2 | 3) => void
  onToggleDone: (idx: number) => void
}) {
  const [input, setInput] = useState('')
  const [pri, setPri] = useState<1 | 2 | 3>(2)

  const PRI: Record<1 | 2 | 3, { label: string; color: string; bg: string }> = {
    1: { label: '!! 높음', color: '#ef4444', bg: '#fef2f2' },
    2: { label: '중간', color: '#f59e0b', bg: '#fffbeb' },
    3: { label: '낮음', color: '#9ca3af', bg: '#f9fafb' },
  }

  const handleAdd = () => {
    if (!input.trim()) return
    onAdd(input, pri)
    setInput('')
    setPri(2)
  }

  const doneCount = todos.filter((t) => t.done).length

  return (
    <div
      className="border border-[#e5e5e5] bg-white p-1.5 flex items-start gap-2"
      style={{ borderRadius: '2px' }}
    >
      <div className="w-[44px] shrink-0 text-center">
        <div className="text-[11px] font-bold text-[#666]">{dayLabel}</div>
        <div className="text-[9px] text-[#999]">{date.slice(5)}</div>
        {todos.length > 0 && (
          <div className="text-[8px] text-[#76b900] font-bold mt-0.5">
            ✓ {doneCount}/{todos.length}
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1">
        {/* 위에 추가된 투두 리스트 */}
        {todos.length === 0 && (
          <p className="text-[10px] text-[#999] italic py-0.5">
            아직 추가된 할 일 없음 — 아래에 입력 후 Enter
          </p>
        )}
        {todos.map((t) => {
          const meta = PRI[t.priority]
          return (
            <div
              key={t._idx}
              className="flex items-center gap-1.5 text-[11px] py-0.5 px-1 hover:bg-[#f9fafb]"
              style={{ borderRadius: '2px' }}
            >
              {/* ☐ ☑ 체크박스 */}
              <button
                type="button"
                onClick={() => onToggleDone(t._idx)}
                className={cn(
                  'w-4 h-4 shrink-0 border flex items-center justify-center transition-colors',
                  t.done
                    ? 'bg-[#76b900] border-[#76b900]'
                    : 'bg-white border-[#cccccc] hover:border-[#000]',
                )}
                style={{ borderRadius: '2px' }}
                title={t.done ? '완료 (클릭으로 취소)' : '완료 체크'}
              >
                {t.done && (
                  <svg viewBox="0 0 16 16" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="3,8 7,12 13,4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* 우선순위 칩 */}
              <button
                type="button"
                onClick={() => {
                  const next: 1 | 2 | 3 =
                    t.priority === 1 ? 2 : t.priority === 2 ? 3 : 1
                  onChangePriority(t._idx, next)
                }}
                className="px-1 text-[9px] font-bold shrink-0"
                style={{
                  backgroundColor: meta.bg,
                  color: meta.color,
                  borderRadius: '2px',
                }}
                title="클릭으로 우선순위 변경"
              >
                {meta.label}
              </button>

              <span className={cn('flex-1', t.done && 'line-through text-[#999]')}>
                {t.title}
              </span>
              <button
                type="button"
                onClick={() => onRemove(t._idx)}
                className="text-[#999] hover:text-[#991b1b] shrink-0"
                title="삭제"
              >
                ✕
              </button>
            </div>
          )
        })}

        {/* 추가 입력 */}
        <div className="flex items-center gap-1 pt-1 border-t border-dashed border-[#e5e5e5]">
          <select
            value={pri}
            onChange={(e) => setPri(Number(e.target.value) as 1 | 2 | 3)}
            className="h-6 px-1 text-[10px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
            style={{ borderRadius: '2px' }}
          >
            <option value={1}>!! 높음</option>
            <option value={2}>중간</option>
            <option value={3}>낮음</option>
          </select>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
            placeholder="+ 할 일 입력 후 Enter"
            className="h-6 text-[11px] px-1.5 flex-1"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!input.trim()}
            className="h-6 px-2 text-[10px] font-bold bg-black text-white disabled:opacity-40"
            style={{ borderRadius: '2px' }}
            title="추가"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 페어 섹션 (선행 또는 후행 한쪽 입력 그룹)
// ============================================================
function PairSection({
  label,
  labelIcon,
  labelColor,
  bgColor,
  borderColor,
  metricGroup,
  selectedCode,
  onSelectMetric,
  selectedMetric,
  unit,
  onUnitChange,
  autoSync,
  startValue,
  onStartChange,
  targetValue,
  onTargetChange,
  currentValue,
  onCurrentChange,
  required = false,
  clearable = false,
  onClear,
}: {
  label: string
  labelIcon: React.ReactNode
  labelColor: string
  bgColor: string
  borderColor: string
  metricGroup: (typeof KR_METRIC_CATALOG)
  selectedCode: string
  onSelectMetric: (code: string) => void
  selectedMetric: ReturnType<typeof getKrMetric>
  unit: KrUnit
  onUnitChange: (u: KrUnit) => void
  autoSync: boolean
  startValue: string
  onStartChange: (v: string) => void
  targetValue: string
  onTargetChange: (v: string) => void
  currentValue: string
  onCurrentChange: (v: string) => void
  required?: boolean
  clearable?: boolean
  onClear?: () => void
}) {
  // KRW 자동 메트릭은 단위 토글 비활성화 (KRW 고정)
  const isKrwMetric = selectedMetric?.unit === 'KRW'

  return (
    <div
      className="p-2.5 border space-y-2"
      style={{ backgroundColor: bgColor, borderColor, borderRadius: '2px' }}
    >
      <div className="flex items-center gap-1.5">
        {labelIcon}
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: labelColor }}>
          {label}
        </span>
        {required && <span className="text-[9px] text-[#ef4444]">필수</span>}
        <div className="flex-1" />
        {clearable && selectedCode && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-[#999] hover:text-[#000]"
          >
            ✕ 해제
          </button>
        )}
      </div>

      {/* 메트릭 토글 */}
      <div className="flex flex-wrap gap-1">
        {metricGroup.map((m) => (
          <MetricChip
            key={m.code}
            metric={m}
            active={selectedCode === m.code}
            onClick={() => onSelectMetric(m.code)}
          />
        ))}
      </div>

      {/* 선택 후 — 시작/목표/현재 + 단위 토글 */}
      {selectedMetric && (
        <>
          {/* 단위 토글 (KRW 자동 메트릭이 아닐 때만) — NVIDIA 톤, 6 옵션 chip */}
          {!isKrwMetric && (
            <div className="flex items-center flex-wrap gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ color: 'var(--nv-mute)' }}
              >
                단위
              </span>
              <div className="inline-flex flex-wrap gap-1">
                {KR_UNIT_OPTIONS.map((opt) => {
                  const active = unit === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onUnitChange(opt.value)}
                      title={opt.hint}
                      className="h-6 px-2 text-[10px] font-bold transition-colors"
                      style={{
                        backgroundColor: active ? 'var(--nv-ink)' : '#ffffff',
                        color: active ? '#ffffff' : 'var(--nv-mute)',
                        border: active
                          ? '1px solid var(--nv-ink)'
                          : '1px solid var(--nv-hairline)',
                        borderRadius: '2px',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.borderColor = 'var(--nv-ink)'
                      }}
                      onMouseLeave={(e) => {
                        if (!active)
                          e.currentTarget.style.borderColor = 'var(--nv-hairline)'
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {autoSync && (
                <span
                  className="text-[10px] font-bold ml-auto"
                  style={{ color: 'var(--nv-primary)' }}
                >
                  ⚡ 거래에서 자동 집계
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-[#666] block mb-0.5">
                시작값
              </label>
              <Input
                type="number"
                value={startValue}
                onChange={(e) => onStartChange(e.target.value)}
                className="h-7 text-[12px]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#666] block mb-0.5">
                목표값 *
              </label>
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => onTargetChange(e.target.value)}
                className="h-7 text-[12px]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#666] block mb-0.5">
                현재값{autoSync && ' (자동)'}
              </label>
              <Input
                type="number"
                value={currentValue}
                onChange={(e) => onCurrentChange(e.target.value)}
                className="h-7 text-[12px]"
                disabled={autoSync}
              />
            </div>
          </div>

          <p className="text-[10px] text-[#666]">
            {selectedMetric.hint}
          </p>
        </>
      )}
    </div>
  )
}

// ============================================================
// 메트릭 칩 (토글)
// ============================================================
function MetricChip({
  metric,
  active,
  onClick,
}: {
  metric: (typeof KR_METRIC_CATALOG)[number]
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 px-2 text-[11px] font-bold inline-flex items-center gap-1 transition-colors',
        active
          ? metric.group === 'result'
            ? 'bg-[#a855f7] text-white'
            : 'bg-[#0ea5e9] text-white'
          : 'bg-white text-[#1a1a1a] border border-[#cccccc] hover:border-[#000]',
      )}
      style={{ borderRadius: '2px' }}
      title={metric.hint}
    >
      <span>{metric.emoji}</span>
      <span>{metric.label}</span>
      {metric.auto_sync && (
        <Zap className="w-2.5 h-2.5" fill="currentColor" />
      )}
    </button>
  )
}

/** 입력된 title 이 카탈로그의 기본 라벨이면 메트릭 변경 시 덮어쓰기 가능 */
function isMetricDefaultTitle(t: string): boolean {
  return KR_METRIC_CATALOG.some((m) => m.label === t.trim())
}
