'use client'

/**
 * KR 펼침 안에서 표시되는 12주 카드 그리드.
 *
 * 각 주 카드:
 *   - 헤더: W{n}, 날짜 (월~금), 타겟값, actual 입력
 *   - 클릭 시 펼침 → 월~금 5일 투두 입력란
 *   - 투두마다 체크박스 + 삭제
 *   - 그 주 완료 % 자동 표시
 *
 * 데이터:
 *   - 12주 타겟: GET /api/cycle/weekly-targets?key_result_id=
 *   - 일일 투두: GET /api/cycle/todos?employee_id=&date_from=&date_to=
 *   - 투두 CRUD: /api/cycle/todos
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Check,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  currentWeekNumber,
  toLocalDateStr,
  todayLocal,
  startOfWeekMonday,
  formatKrValue,
  type DailyTodo,
  type Employee,
  type KrUnit,
  type WeeklyTarget,
} from '@/lib/cycle-okr'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['월', '화', '수', '목', '금']

interface Props {
  employee: Employee
  keyResultId: string
  unit: KrUnit
  /** KR 시작일 — null 이면 cycleStart fallback */
  startedDate: string | null
  cycleStart: string
  cycleEnd: string
  cycleId: number
  onError: (msg: string) => void
  /** actual 변경 시 알림 (부모가 KR refresh) */
  onActualChanged: () => Promise<void>
}

interface Suggestion {
  id: number
  cycle_id: number
  employee_id: string | null
  week_number_created: number
  title: string
  status: 'open' | 'resolved'
  resolved_at: string | null
  created_at: string
}

interface OneOnOne {
  id: number
  requester_id: string
  target_id: string
  meeting_date: string
  meeting_time: string | null
  notes: string | null
  status: 'pending' | 'done' | 'cancelled'
  week_number_created: number
  target_confirmed_at?: string | null
  requester?: { id: string; name: string; color: string | null } | null
  target?: { id: string; name: string; color: string | null } | null
}

export default function WeeklyCardsBoard({
  employee,
  keyResultId,
  unit,
  startedDate,
  cycleStart,
  cycleEnd,
  cycleId,
  onError,
  onActualChanged,
}: Props) {
  const [weeks, setWeeks] = useState<WeeklyTarget[]>([])
  const [todos, setTodos] = useState<DailyTodo[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)
  const [actualEditing, setActualEditing] = useState<{ week: number; value: string } | null>(null)
  const [noteEditing, setNoteEditing] = useState<{ week: number; value: string } | null>(null)
  // 건의사항 — 회사 전체 차원, 직원+주 별
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [sugInput, setSugInput] = useState<Record<number, string>>({})
  const [sugSubmitting, setSugSubmitting] = useState<number | null>(null)
  // 1:1 미팅 + 직원 리스트 (대상 선택용)
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOne[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [oooSubmitting, setOooSubmitting] = useState<number | null>(null)

  // 시작일 (KR.started_date 또는 cycleStart fallback)
  const effectiveStart = startedDate ?? cycleStart

  // 시작일이 포함된 주의 월요일부터 12주 (각 주 월~금)
  const weekDates = useMemo(() => {
    const out: Array<{ week: number; days: string[]; monLabel: string; friLabel: string }> = []
    if (!effectiveStart) return out
    const start = startOfWeekMonday(effectiveStart) // 그 주의 월요일로 정규화
    for (let w = 0; w < 12; w++) {
      const mon = new Date(start)
      mon.setDate(start.getDate() + w * 7)
      const days: string[] = []
      for (let i = 0; i < 5; i++) {
        const d = new Date(mon)
        d.setDate(mon.getDate() + i)
        days.push(toLocalDateStr(d))
      }
      const friDate = new Date(mon)
      friDate.setDate(mon.getDate() + 4)
      out.push({
        week: w + 1,
        days,
        monLabel: `${mon.getMonth() + 1}/${mon.getDate()}`,
        friLabel: `${friDate.getMonth() + 1}/${friDate.getDate()}`,
      })
    }
    return out
  }, [effectiveStart])

  const dateToWeek = useMemo(() => {
    const m = new Map<string, number>()
    for (const wd of weekDates) {
      for (const d of wd.days) m.set(d, wd.week)
    }
    return m
  }, [weekDates])

  // currentWeek — 월요일 정규화된 시작일 기준
  const currentWeek = useMemo(() => {
    if (!effectiveStart) return 1
    const startMon = startOfWeekMonday(effectiveStart).getTime()
    const diffDays = Math.floor((Date.now() - startMon) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return 0
    return Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1))
  }, [effectiveStart])

  const today = todayLocal()

  // 데이터 로드 — 주별 타겟 + 투두 + 건의사항 + 1:1 미팅 + 직원 목록
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [wRes, tRes, sRes, oRes, eRes] = await Promise.all([
        fetch(`/api/cycle/weekly-targets?key_result_id=${keyResultId}`),
        weekDates.length > 0
          ? fetch(
              `/api/cycle/todos?employee_id=${employee.id}&date_from=${weekDates[0].days[0]}&date_to=${weekDates[11].days[4]}`,
            )
          : Promise.resolve(null),
        fetch(`/api/cycle/suggestions?cycle_id=${cycleId}&status=all`),
        fetch(`/api/cycle/one-on-ones?cycle_id=${cycleId}`),
        fetch('/api/cycle/employees'),
      ])
      let freshWeeks: WeeklyTarget[] = []
      if (wRes.ok) {
        const j = await wRes.json()
        freshWeeks = j.weekly_targets ?? []
        setWeeks(freshWeeks)
      }
      if (tRes && tRes.ok) {
        const j = await tRes.json()
        const all: DailyTodo[] = j.todos ?? []
        const krWeeklyIds = new Set(freshWeeks.map((w) => w.id))
        const filtered = all.filter(
          (t) => !t.weekly_target_id || krWeeklyIds.has(t.weekly_target_id),
        )
        setTodos(filtered)
      }
      if (sRes.ok) {
        const j = await sRes.json()
        const all: Suggestion[] = j.suggestions ?? []
        setSuggestions(all.filter((s) => s.employee_id === employee.id))
      }
      if (oRes.ok) {
        const j = await oRes.json()
        const all: OneOnOne[] = j.one_on_ones ?? []
        // 본인이 요청자 또는 대상자인 1:1 만 표시
        setOneOnOnes(
          all.filter(
            (o) => o.requester_id === employee.id || o.target_id === employee.id,
          ),
        )
      }
      if (eRes.ok) {
        const j = await eRes.json()
        setAllEmployees(j.employees ?? [])
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : '주별 데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [keyResultId, employee.id, weekDates, onError, cycleId])

  // 건의사항 추가
  const addSuggestion = async (week: number) => {
    const title = (sugInput[week] ?? '').trim()
    if (!title) return
    setSugSubmitting(week)
    try {
      const r = await fetch('/api/cycle/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_id: cycleId,
          employee_id: employee.id,
          week_number_created: week,
          title,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error ?? `${r.status}`)
      }
      setSugInput((prev) => ({ ...prev, [week]: '' }))
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '건의사항 등록 실패')
    } finally {
      setSugSubmitting(null)
    }
  }

  // 건의사항 삭제 (작성자 본인)
  const deleteSuggestion = async (id: number) => {
    try {
      await fetch(`/api/cycle/suggestions?id=${id}`, { method: 'DELETE' })
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '건의사항 삭제 실패')
    }
  }

  // 1:1 미팅 추가 — 자동으로 두 직원 daily_todos 생성
  const addOneOnOne = async (
    week: number,
    payload: {
      target_id: string
      meeting_date: string
      meeting_time: string
      notes: string
    },
  ) => {
    setOooSubmitting(week)
    try {
      const r = await fetch('/api/cycle/one-on-ones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_id: cycleId,
          requester_id: employee.id,
          target_id: payload.target_id,
          meeting_date: payload.meeting_date,
          meeting_time: payload.meeting_time || null,
          notes: payload.notes,
          week_number_created: week,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error ?? `${r.status}`)
      }
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '1:1 미팅 등록 실패')
    } finally {
      setOooSubmitting(null)
    }
  }

  // 1:1 미팅 삭제 — CASCADE 로 연결된 daily_todos 도 자동 삭제
  const deleteOneOnOne = async (id: number) => {
    try {
      await fetch(`/api/cycle/one-on-ones?id=${id}`, { method: 'DELETE' })
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '1:1 삭제 실패')
    }
  }

  // 1:1 컨펌 토글 (대상자가 일정 동의)
  const confirmOneOnOne = async (id: number, confirmed: boolean) => {
    try {
      await fetch('/api/cycle/one-on-ones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, target_confirmed: confirmed }),
      })
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '컨펌 실패')
    }
  }

  // 1:1 일정 변경 (날짜/시간 조정) — daily_todos 도 자동 동기화됨
  const rescheduleOneOnOne = async (
    id: number,
    payload: { meeting_date: string; meeting_time: string },
  ) => {
    try {
      const r = await fetch('/api/cycle/one-on-ones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          meeting_date: payload.meeting_date,
          meeting_time: payload.meeting_time || null,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error ?? `${r.status}`)
      }
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '일정 변경 실패')
    }
  }

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // weeks 변경 effect 제거 — fetchAll 안에서 freshWeeks 로 즉시 필터링하므로 불필요

  // 주차별 todo 그룹
  const todosByWeek = useMemo(() => {
    const m = new Map<number, DailyTodo[]>()
    for (const t of todos) {
      const w = dateToWeek.get(t.date)
      if (!w) continue
      if (!m.has(w)) m.set(w, [])
      m.get(w)!.push(t)
    }
    return m
  }, [todos, dateToWeek])

  // 주별 note (주 목표 / 메모) 저장
  const saveNote = async (week: number, value: string) => {
    try {
      await fetch('/api/cycle/weekly-targets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_result_id: keyResultId,
          week_number: week,
          note: value.trim() || null,
        }),
      })
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '주 목표 저장 실패')
    }
    setNoteEditing(null)
  }

  // 주별 actual 저장
  const saveActual = async (week: number, value: string) => {
    const num = Number(value)
    if (Number.isNaN(num)) {
      onError('숫자만 입력 가능')
      return
    }
    try {
      await fetch('/api/cycle/weekly-targets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_result_id: keyResultId,
          week_number: week,
          actual_value: num,
        }),
      })
      await fetchAll()
      await onActualChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : '실적 저장 실패')
    }
    setActualEditing(null)
  }

  // todo 추가 (우선순위 함께)
  const addTodo = async (
    date: string,
    weeklyTargetId: string,
    title: string,
    priority: 1 | 2 | 3 = 2,
  ) => {
    if (!title.trim()) return
    try {
      const r = await fetch('/api/cycle/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          weekly_target_id: weeklyTargetId,
          date,
          title: title.trim(),
          priority,
        }),
      })
      if (!r.ok) throw new Error(`${r.status}`)
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '투두 추가 실패')
    }
  }

  // 우선순위 변경
  const changeTodoPriority = async (todo: DailyTodo, priority: 1 | 2 | 3) => {
    try {
      await fetch(`/api/cycle/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      })
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '우선순위 변경 실패')
    }
  }

  // todo 상태 토글 (done ↔ todo)
  const toggleTodo = async (todo: DailyTodo) => {
    const next = todo.status === 'done' ? 'todo' : 'done'
    try {
      await fetch(`/api/cycle/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '상태 변경 실패')
    }
  }

  // todo 삭제 — confirm 없이 즉시 삭제
  const deleteTodo = async (todo: DailyTodo) => {
    try {
      await fetch(`/api/cycle/todos/${todo.id}`, { method: 'DELETE' })
      await fetchAll()
    } catch (e) {
      onError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  if (loading) {
    return (
      <div className="text-[11px] text-[#666] flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        12주 데이터 로드 중...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-bold tracking-tight text-[#000]">
          📅 12주 주별 카드 — 클릭 시 월~금 투두 입력
        </p>
        <span className="text-[10px] text-[#999]">
          시작일 {effectiveStart} ~ {weekDates[11]?.friLabel}
        </span>
      </div>

      <div className="space-y-1.5">
        {weekDates.map(({ week, days, monLabel, friLabel }) => {
          const wt = weeks.find((w) => w.week_number === week)
          const target = Number(wt?.target_value ?? 0)
          const actual = Number(wt?.actual_value ?? 0)
          const targetRate = target > 0 ? actual / target : 0

          const weekTodos = todosByWeek.get(week) ?? []
          const doneCnt = weekTodos.filter((t) => t.status === 'done').length
          const todoRate = weekTodos.length > 0 ? doneCnt / weekTodos.length : 0

          const isNow = week === currentWeek
          const isFuture = week > currentWeek
          const isPast = week < currentWeek
          const isExpanded = expandedWeek === week

          const barColor =
            targetRate >= 0.8
              ? '#76b900'
              : targetRate >= 0.6
                ? '#f59e0b'
                : actual > 0
                  ? '#ef4444'
                  : '#cccccc'

          return (
            <div
              key={week}
              className={cn(
                'bg-white border transition-colors',
                isNow ? 'border-[#000] border-2' : 'border-[#e5e5e5]',
              )}
              style={{ borderRadius: '2px' }}
            >
              {/* 헤더 — 가로형 한 줄. 클릭 시 토글 */}
              <button
                type="button"
                onClick={() => setExpandedWeek(isExpanded ? null : week)}
                className="w-full text-left px-2 py-2 flex items-center gap-2 hover:bg-[#f9fafb] transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#666]" strokeWidth={2} />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#666]" strokeWidth={2} />
                )}
                <span
                  className={cn(
                    'text-[12px] font-bold w-8 shrink-0',
                    isNow ? 'text-[#000]' : 'text-[#666]',
                  )}
                >
                  W{week}
                </span>
                {isNow ? (
                  <span className="text-[9px] bg-[#000] text-white px-1 py-0 shrink-0" style={{ borderRadius: '2px' }}>
                    이번 주
                  </span>
                ) : (
                  <span className="w-12 shrink-0" />
                )}
                <span className="text-[10px] text-[#999] w-20 shrink-0">
                  {monLabel}~{friLabel}
                </span>
                <span className="text-[10px] text-[#666] shrink-0">목표</span>
                <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: '#666' }}>
                  {formatKrValue(target, unit)}
                </span>
                <span className="text-[10px] text-[#cccccc] shrink-0">·</span>
                <span className="text-[10px] text-[#666] shrink-0">실적</span>
                <span
                  className="text-[11px] font-bold tabular-nums shrink-0"
                  style={{ color: barColor }}
                >
                  {actual > 0 ? formatKrValue(actual, unit) : '—'}
                </span>
                {/* 주 목표 (note) 미리보기 */}
                <span className="text-[10px] text-[#cccccc] shrink-0">·</span>
                {wt?.note ? (
                  <span
                    className="text-[11px] text-[#000] truncate flex-1 min-w-0"
                    title={wt.note}
                  >
                    🎯 {wt.note}
                  </span>
                ) : (
                  <span className="text-[10px] text-[#999] italic flex-1 min-w-0 truncate">
                    🎯 주 목표 미입력 — 클릭해서 추가
                  </span>
                )}
                {weekTodos.length > 0 && (
                  <span className="text-[10px] text-[#666] shrink-0">
                    ✓ {doneCnt}/{weekTodos.length}
                    <span
                      className="ml-1 font-bold"
                      style={{
                        color: todoRate >= 0.8 ? '#76b900' : todoRate >= 0.6 ? '#f59e0b' : '#ef4444',
                      }}
                    >
                      {Math.round(todoRate * 100)}%
                    </span>
                  </span>
                )}
              </button>

              {/* 진행 바 */}
              <div className="h-[3px] bg-[#f3f4f6]">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min(100, targetRate * 100)}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>

              {/* 펼친 영역 — 주 목표 + actual 입력 + 월~금 투두 */}
              {isExpanded && (
                <div className="border-t border-[#e5e5e5] p-2 space-y-2 bg-[#fafafa]">
                  {/* 🎯 주 목표 (note) */}
                  <div className="bg-white border border-[#fcd34d] p-2" style={{ borderRadius: '2px' }}>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#92400e]">
                        🎯 W{week} 주 목표 — 이번 주 핵심 한 줄
                      </span>
                    </div>
                    {noteEditing?.week === week ? (
                      <textarea
                        autoFocus
                        value={noteEditing.value}
                        onChange={(e) => setNoteEditing({ week, value: e.target.value })}
                        onBlur={() => saveNote(week, noteEditing.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setNoteEditing(null)
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            saveNote(week, noteEditing.value)
                          }
                        }}
                        rows={2}
                        placeholder="이 주에 이루고 싶은 핵심 한 줄 (예: 디자이너 컨택 50건 + 미팅 5건)"
                        className="w-full text-[12px] px-2 py-1 border border-[#cccccc] outline-none focus:border-[#f59e0b] resize-none"
                        style={{ borderRadius: '2px' }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setNoteEditing({ week, value: wt?.note ?? '' })}
                        className="w-full text-left text-[12px] py-1 hover:bg-[#fffbeb] transition-colors"
                        style={{ borderRadius: '2px' }}
                      >
                        {wt?.note ? (
                          <span className="text-[#000]">{wt.note}</span>
                        ) : (
                          <span className="text-[#999] italic">+ 클릭해서 주 목표 작성</span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* actual 입력 */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#666]">이 주 실적:</span>
                    {actualEditing?.week === week ? (
                      <>
                        <Input
                          type="number"
                          value={actualEditing.value}
                          onChange={(e) =>
                            setActualEditing({ week, value: e.target.value })
                          }
                          className="h-6 w-[80px] text-[11px]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveActual(week, actualEditing.value)
                            if (e.key === 'Escape') setActualEditing(null)
                          }}
                          onBlur={() => saveActual(week, actualEditing.value)}
                        />
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setActualEditing({ week, value: String(actual) })
                        }
                        className="text-[11px] font-bold underline"
                        style={{ color: barColor }}
                      >
                        {formatKrValue(actual, unit)}
                      </button>
                    )}
                    <span className="text-[10px] text-[#999]">
                      / 목표 {formatKrValue(target, unit)}
                    </span>
                  </div>

                  {/* 5일 투두 + 💬 건의사항 (금요일 다음 행, 동일 디자인) */}
                  <div className="space-y-1.5">
                    {days.map((date, i) => (
                      <DayTodos
                        key={date}
                        date={date}
                        dayLabel={DAY_LABELS[i]}
                        weeklyTargetId={wt?.id ?? null}
                        todos={weekTodos
                          .filter((t) => t.date === date)
                          .sort((a, b) => a.priority - b.priority)}
                        today={today}
                        onAdd={(title, priority) =>
                          wt?.id ? addTodo(date, wt.id, title, priority) : Promise.resolve()
                        }
                        onToggle={toggleTodo}
                        onChangePriority={changeTodoPriority}
                        onDelete={deleteTodo}
                        oneOnOnes={oneOnOnes}
                        myEmployeeId={employee.id}
                        onConfirmOneOnOne={confirmOneOnOne}
                        onRescheduleOneOnOne={rescheduleOneOnOne}
                      />
                    ))}
                    {/* 💬 건의사항 — 금요일 바로 아래 같은 디자인 (다음 주 WAM 회의 페이지 표시) */}
                    <SuggestionBox
                      week={week}
                      suggestions={suggestions.filter(
                        (s) => s.week_number_created === week,
                      )}
                      inputValue={sugInput[week] ?? ''}
                      onInputChange={(v) =>
                        setSugInput((prev) => ({ ...prev, [week]: v }))
                      }
                      onSubmit={() => addSuggestion(week)}
                      onDelete={deleteSuggestion}
                      submitting={sugSubmitting === week}
                    />

                    {/* 🤝 1:1 미팅 — 건의사항 아래 같은 디자인 */}
                    <OneOnOneBox
                      week={week}
                      defaultDate={days[0]}
                      meetings={oneOnOnes.filter(
                        (o) => o.week_number_created === week,
                      )}
                      myEmployeeId={employee.id}
                      employees={allEmployees}
                      submitting={oooSubmitting === week}
                      onSubmit={(payload) => addOneOnOne(week, payload)}
                      onDelete={deleteOneOnOne}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// 하루의 투두 행 (요일 라벨 + 투두 목록 + 추가 input)
// ============================================================
const PRIORITY_META: Record<1 | 2 | 3, { label: string; color: string; bg: string }> = {
  1: { label: '!! 높음', color: '#ef4444', bg: '#fef2f2' },
  2: { label: '중간', color: '#f59e0b', bg: '#fffbeb' },
  3: { label: '낮음', color: '#9ca3af', bg: '#f9fafb' },
}

function DayTodos({
  date,
  dayLabel,
  weeklyTargetId,
  todos,
  today,
  onAdd,
  onToggle,
  onChangePriority,
  onDelete,
  oneOnOnes,
  myEmployeeId,
  onConfirmOneOnOne,
  onRescheduleOneOnOne,
}: {
  date: string
  dayLabel: string
  weeklyTargetId: string | null
  todos: DailyTodo[]
  today: string
  onAdd: (title: string, priority: 1 | 2 | 3) => Promise<void>
  onToggle: (t: DailyTodo) => void
  onChangePriority: (t: DailyTodo, p: 1 | 2 | 3) => Promise<void>
  onDelete: (t: DailyTodo) => void
  oneOnOnes: OneOnOne[]
  myEmployeeId: string
  onConfirmOneOnOne: (id: number, confirmed: boolean) => Promise<void>
  onRescheduleOneOnOne: (
    id: number,
    payload: { meeting_date: string; meeting_time: string },
  ) => Promise<void>
}) {
  const [input, setInput] = useState('')
  const [inputPriority, setInputPriority] = useState<1 | 2 | 3>(2)
  const [adding, setAdding] = useState(false)
  const isToday = date === today

  const handleAdd = async () => {
    if (!input.trim() || !weeklyTargetId) return
    setAdding(true)
    try {
      await onAdd(input, inputPriority)
      setInput('')
      setInputPriority(2)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      className={cn(
        'border bg-white p-1.5 flex items-start gap-2',
        isToday ? 'border-[#000]' : 'border-[#e5e5e5]',
      )}
      style={{ borderRadius: '2px' }}
    >
      {/* 요일 + 날짜 라벨 */}
      <div className="w-[44px] shrink-0 text-center">
        <div
          className={cn(
            'text-[11px] font-bold',
            isToday ? 'text-[#000]' : 'text-[#666]',
          )}
        >
          {dayLabel}
        </div>
        <div className="text-[9px] text-[#999]">{date.slice(5)}</div>
      </div>

      {/* 투두 리스트 + 추가 */}
      <div className="flex-1 space-y-1">
        {todos.map((t) => {
          // 1:1 미팅 자동 todo 인 경우 별도 렌더링
          if (t.source_one_on_one_id) {
            const meeting = oneOnOnes.find((o) => o.id === t.source_one_on_one_id)
            if (meeting) {
              return (
                <OneOnOneTodoRow
                  key={t.id}
                  todo={t}
                  meeting={meeting}
                  myEmployeeId={myEmployeeId}
                  onToggle={() => onToggle(t)}
                  onConfirm={(confirmed) =>
                    onConfirmOneOnOne(meeting.id, confirmed)
                  }
                  onReschedule={(payload) =>
                    onRescheduleOneOnOne(meeting.id, payload)
                  }
                />
              )
            }
          }
          const pri = (t.priority as 1 | 2 | 3) ?? 2
          const meta = PRIORITY_META[pri]
          return (
            <div
              key={t.id}
              className="group flex items-center gap-1.5 text-[11px] py-0.5"
            >
              {/* 체크박스 */}
              <button
                type="button"
                onClick={() => onToggle(t)}
                className={cn(
                  'w-4 h-4 shrink-0 border flex items-center justify-center transition-colors',
                  t.status === 'done'
                    ? 'bg-[#76b900] border-[#76b900]'
                    : 'bg-white border-[#cccccc] hover:border-[#000]',
                )}
                style={{ borderRadius: '2px' }}
                title={t.status === 'done' ? '완료됨 (클릭으로 취소)' : '완료 체크'}
              >
                {t.status === 'done' && (
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                )}
              </button>

              {/* 우선순위 칩 (클릭 → 다음 단계) */}
              <button
                type="button"
                onClick={() => {
                  const next: 1 | 2 | 3 = pri === 1 ? 2 : pri === 2 ? 3 : 1
                  onChangePriority(t, next)
                }}
                className="px-1 text-[9px] font-bold shrink-0 inline-flex items-center"
                style={{
                  backgroundColor: meta.bg,
                  color: meta.color,
                  borderRadius: '2px',
                }}
                title="클릭으로 우선순위 변경"
              >
                {meta.label}
              </button>

              <span
                className={cn(
                  'flex-1',
                  t.status === 'done' && 'line-through text-[#999]',
                )}
              >
                {t.title}
              </span>
              <button
                type="button"
                onClick={() => onDelete(t)}
                className="text-[#999] hover:text-[#991b1b] shrink-0 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          )
        })}

        {/* 추가 input — 우선순위 + 제목 */}
        {weeklyTargetId ? (
          <div className="flex items-center gap-1">
            <select
              value={inputPriority}
              onChange={(e) => setInputPriority(Number(e.target.value) as 1 | 2 | 3)}
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
                if (e.key === 'Enter') handleAdd()
              }}
              placeholder="+ 할 일 추가 (Enter)"
              className="h-6 text-[11px] px-1.5 flex-1"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!input.trim() || adding}
              className="h-6 px-1.5 text-[10px] font-bold bg-black text-white disabled:opacity-40"
              style={{ borderRadius: '2px' }}
            >
              {adding ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : '+'}
            </button>
          </div>
        ) : (
          <p className="text-[9px] text-[#999] italic">
            ⚠ 주간 타겟이 없어 투두 추가 불가
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 💬 건의사항 박스 — 금요일 아래, DayTodos 와 동일한 디자인
// 일별 투두 (월~금) 행과 같은 시각 구조: 좌측 라벨 + 우측 본문
// 다음 주 WAM 회의 페이지에 자동 표시되어 토론
// ============================================================
function SuggestionBox({
  week,
  suggestions,
  inputValue,
  onInputChange,
  onSubmit,
  onDelete,
  submitting,
}: {
  week: number
  suggestions: Array<{ id: number; title: string; status: 'open' | 'resolved' }>
  inputValue: string
  onInputChange: (v: string) => void
  onSubmit: () => void
  onDelete: (id: number) => void
  submitting: boolean
}) {
  return (
    <div
      className="border bg-white p-1.5 flex items-start gap-2"
      style={{
        borderColor: 'var(--nv-primary)',
        borderRadius: '2px',
      }}
    >
      {/* 좌측 라벨 — DayTodos 의 "금 05-22" 와 같은 자리 */}
      <div className="w-[44px] shrink-0 text-center">
        <div
          className="text-[11px] font-bold"
          style={{ color: 'var(--nv-success-deep)' }}
        >
          💬 건의
        </div>
        <div className="text-[9px]" style={{ color: 'var(--nv-stone)' }}>
          W{week}
        </div>
      </div>

      {/* 우측 본문 — 안내문 + 리스트 + 입력 행 */}
      <div className="flex-1 space-y-1">
        {/* 안내문 (todo 없을 때 placeholder 역할) */}
        {suggestions.length === 0 && (
          <p
            className="text-[10px] italic px-0.5"
            style={{ color: 'var(--nv-mute)' }}
          >
            아직 등록된 건의사항 없음 — 회사 전체에 대한 건의·요청·개선 사항을 적으세요. 다음 주 WAM 회의 페이지에 자동 표시됩니다.
          </p>
        )}

        {/* 기존 건의사항 리스트 */}
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="group flex items-center gap-1.5 text-[11px] py-0.5"
          >
            {/* 상태 표시 (체크/대기) */}
            <span
              className="w-4 h-4 shrink-0 flex items-center justify-center"
              style={{
                backgroundColor:
                  s.status === 'resolved' ? 'var(--nv-primary)' : 'transparent',
                border:
                  s.status === 'resolved'
                    ? '1px solid var(--nv-primary)'
                    : '1px solid var(--nv-hairline)',
                borderRadius: '2px',
              }}
              title={s.status === 'resolved' ? '해결됨' : '미해결'}
            >
              {s.status === 'resolved' && (
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              )}
            </span>

            {/* 라벨 칩 (status — DayTodos 의 우선순위 칩 자리) */}
            <span
              className="px-1 text-[9px] font-bold shrink-0 inline-flex items-center"
              style={{
                backgroundColor:
                  s.status === 'resolved'
                    ? 'var(--nv-surface-soft)'
                    : 'var(--nv-accent-pale)',
                color:
                  s.status === 'resolved'
                    ? 'var(--nv-stone)'
                    : 'var(--nv-success-deep)',
                borderRadius: '2px',
              }}
            >
              {s.status === 'resolved' ? '해결' : '건의'}
            </span>

            <span
              className={cn('flex-1')}
              style={{
                color:
                  s.status === 'resolved' ? 'var(--nv-stone)' : 'var(--nv-ink)',
                textDecoration: s.status === 'resolved' ? 'line-through' : 'none',
              }}
            >
              {s.title}
            </span>

            <button
              type="button"
              onClick={() => onDelete(s.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100"
              style={{ color: 'var(--nv-stone)' }}
              title="삭제"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}

        {/* 입력 행 — DayTodos 의 추가 input 자리 (우선순위 select 자리는 라벨로 대체) */}
        <div className="flex items-center gap-1">
          <span
            className="h-6 px-2 text-[10px] font-bold inline-flex items-center shrink-0"
            style={{
              backgroundColor: 'var(--nv-accent-pale)',
              color: 'var(--nv-success-deep)',
              border: '1px solid var(--nv-primary)',
              borderRadius: '2px',
            }}
          >
            건의
          </span>
          <Input
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit()
            }}
            placeholder="+ 회사 전체 건의·요청·개선 사항 입력 후 Enter (예: 거래처 데이터 정리 시스템 필요)"
            className="h-6 text-[11px] px-1.5 flex-1"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!inputValue.trim() || submitting}
            className="h-6 px-1.5 text-[10px] font-bold disabled:opacity-40"
            style={{
              backgroundColor: 'var(--nv-primary)',
              color: '#000',
              borderRadius: '2px',
            }}
          >
            {submitting ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : (
              '추가'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 🤝 1:1 미팅 박스 — 건의사항 아래, DayTodos 와 동일 디자인
// 직원 선택 chip + 날짜 + 시간 + 내용 → POST 시 두 직원 daily_todos 자동 생성
// ============================================================
function OneOnOneBox({
  week,
  defaultDate,
  meetings,
  myEmployeeId,
  employees,
  submitting,
  onSubmit,
  onDelete,
}: {
  week: number
  defaultDate: string
  meetings: OneOnOne[]
  myEmployeeId: string
  employees: Employee[]
  submitting: boolean
  onSubmit: (payload: {
    target_id: string
    meeting_date: string
    meeting_time: string
    notes: string
  }) => Promise<void>
  onDelete: (id: number) => Promise<void>
}) {
  const [targetId, setTargetId] = useState<string>('')
  const [date, setDate] = useState<string>(defaultDate)
  const [time, setTime] = useState<string>('14:00')
  const [notes, setNotes] = useState<string>('')

  const canSubmit = targetId && date && !submitting

  const handleAdd = async () => {
    if (!canSubmit) return
    await onSubmit({ target_id: targetId, meeting_date: date, meeting_time: time, notes })
    setTargetId('')
    setNotes('')
    setTime('14:00')
    setDate(defaultDate)
  }

  // 본인 제외 직원 리스트
  const others = employees.filter((e) => e.id !== myEmployeeId)

  return (
    <div
      className="border bg-white p-1.5 flex items-start gap-2"
      style={{
        borderColor: '#a855f7',
        borderRadius: '2px',
      }}
    >
      {/* 좌측 라벨 */}
      <div className="w-[44px] shrink-0 text-center">
        <div className="text-[11px] font-bold" style={{ color: '#7e22ce' }}>
          🤝 1:1
        </div>
        <div className="text-[9px]" style={{ color: 'var(--nv-stone)' }}>
          W{week}
        </div>
      </div>

      {/* 우측 본문 */}
      <div className="flex-1 space-y-1.5">
        {/* 안내문 */}
        {meetings.length === 0 && (
          <p
            className="text-[10px] italic px-0.5"
            style={{ color: 'var(--nv-mute)' }}
          >
            아직 등록된 1:1 미팅 없음 — 대상 직원·날짜·시간·내용 입력. 등록 시 두 직원 일일 투두에
            자동 추가 + 다음 주 WAM 회의 페이지 표시.
          </p>
        )}

        {/* 기존 1:1 리스트 */}
        {meetings.map((m) => {
          const other = m.requester_id === myEmployeeId ? m.target : m.requester
          const role = m.requester_id === myEmployeeId ? '요청' : '대상'
          const timeStr = m.meeting_time ? m.meeting_time.slice(0, 5) : ''
          return (
            <div
              key={m.id}
              className="group flex items-center gap-1.5 text-[11px] py-0.5"
            >
              {/* 상태 */}
              <span
                className="w-4 h-4 shrink-0 flex items-center justify-center"
                style={{
                  backgroundColor:
                    m.status === 'done' ? 'var(--nv-primary)' : 'transparent',
                  border:
                    m.status === 'done'
                      ? '1px solid var(--nv-primary)'
                      : '1px solid var(--nv-hairline)',
                  borderRadius: '2px',
                }}
                title={m.status === 'done' ? '완료' : '예정'}
              >
                {m.status === 'done' && (
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                )}
              </span>

              {/* 라벨 칩 */}
              <span
                className="px-1 text-[9px] font-bold shrink-0 inline-flex items-center"
                style={{
                  backgroundColor: '#f5e6ff',
                  color: '#7e22ce',
                  borderRadius: '2px',
                }}
              >
                {role}
              </span>

              {/* 날짜·시간 */}
              <span
                className="shrink-0 tabular-nums text-[10px]"
                style={{ color: 'var(--nv-mute)' }}
              >
                {m.meeting_date.slice(5)}
                {timeStr && ` ${timeStr}`}
              </span>

              {/* 상대방 이름 */}
              {other && (
                <span
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold"
                  style={{ color: other.color ?? 'var(--nv-ink)' }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5"
                    style={{ backgroundColor: other.color ?? 'var(--nv-primary)' }}
                  />
                  {other.name}
                </span>
              )}

              {/* 내용 */}
              <span className="flex-1 truncate" style={{ color: 'var(--nv-body)' }}>
                {m.notes ?? '—'}
              </span>

              <button
                type="button"
                onClick={() => onDelete(m.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100"
                style={{ color: 'var(--nv-stone)' }}
                title="삭제 (자동 생성된 일일 투두도 함께 삭제됨)"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          )
        })}

        {/* 입력 행 1 — 대상 직원 chip 토글 */}
        {others.length > 0 ? (
          <>
            <div className="flex items-center gap-1 flex-wrap">
              <span
                className="text-[9px] font-bold shrink-0"
                style={{ color: 'var(--nv-mute)' }}
              >
                대상:
              </span>
              {others.map((e) => {
                const active = targetId === e.id
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setTargetId(active ? '' : e.id)}
                    className="px-2 text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                    style={{
                      height: 22,
                      backgroundColor: active ? e.color ?? '#a855f7' : '#ffffff',
                      color: active ? '#ffffff' : 'var(--nv-ink)',
                      border: `1px solid ${
                        active ? e.color ?? '#a855f7' : 'var(--nv-hairline)'
                      }`,
                      borderRadius: '2px',
                    }}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5"
                      style={{
                        backgroundColor: active ? '#ffffff' : e.color ?? '#a855f7',
                      }}
                    />
                    {e.name}
                  </button>
                )
              })}
            </div>

            {/* 입력 행 2 — 날짜 + 시간 + 내용 + 추가 */}
            <div className="flex items-center gap-1 flex-wrap">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-6 text-[11px] px-1.5"
                style={{ width: 130 }}
              />
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-6 text-[11px] px-1.5"
                style={{ width: 90 }}
              />
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="+ 1:1 미팅 내용·주제 입력 후 추가"
                className="h-6 text-[11px] px-1.5 flex-1 min-w-[140px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleAdd()
                }}
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!canSubmit}
                className="h-6 px-1.5 text-[10px] font-bold disabled:opacity-40"
                style={{
                  backgroundColor: '#a855f7',
                  color: '#ffffff',
                  borderRadius: '2px',
                }}
              >
                {submitting ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  '추가'
                )}
              </button>
            </div>
          </>
        ) : (
          <p
            className="text-[9px] italic px-0.5"
            style={{ color: 'var(--nv-stone)' }}
          >
            ⚠ 다른 직원이 등록되지 않아 1:1 신청 불가
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 🤝 1:1 미팅 todo row — 일별 투두 안에 표시
// - 날짜 + 시간 라벨
// - ✓ 완료 체크박스 (todo status)
// - ✅ 컨펌 체크박스 (상대방 일정 동의)
// - 🔄 변경 요청 버튼 → 클릭 시 인라인 날짜/시간 폼
// ============================================================
function OneOnOneTodoRow({
  todo,
  meeting,
  myEmployeeId,
  onToggle,
  onConfirm,
  onReschedule,
}: {
  todo: DailyTodo
  meeting: OneOnOne
  myEmployeeId: string
  onToggle: () => void
  onConfirm: (confirmed: boolean) => Promise<void>
  onReschedule: (payload: { meeting_date: string; meeting_time: string }) => Promise<void>
}) {
  const [rescheduling, setRescheduling] = useState(false)
  const [newDate, setNewDate] = useState(meeting.meeting_date)
  const [newTime, setNewTime] = useState(meeting.meeting_time ?? '14:00')
  const [submitting, setSubmitting] = useState(false)

  const isRequester = meeting.requester_id === myEmployeeId
  const other = isRequester ? meeting.target : meeting.requester
  const dateLabel = meeting.meeting_date.slice(5)
  const timeStr = meeting.meeting_time ? meeting.meeting_time.slice(0, 5) : ''
  const confirmed = !!meeting.target_confirmed_at

  const handleReschedule = async () => {
    setSubmitting(true)
    try {
      await onReschedule({ meeting_date: newDate, meeting_time: newTime })
      setRescheduling(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="py-1 px-1.5"
      style={{
        backgroundColor: '#faf5ff',
        borderLeft: '3px solid #a855f7',
        borderRadius: '2px',
      }}
    >
      <div className="flex items-center gap-1.5 text-[11px]">
        {/* 완료 체크박스 (todo status) */}
        <button
          type="button"
          onClick={onToggle}
          className="w-4 h-4 shrink-0 flex items-center justify-center transition-colors"
          style={{
            backgroundColor: todo.status === 'done' ? 'var(--nv-primary)' : '#ffffff',
            border:
              todo.status === 'done'
                ? '1px solid var(--nv-primary)'
                : '1px solid var(--nv-hairline)',
            borderRadius: '2px',
          }}
          title={todo.status === 'done' ? '완료됨 (해제)' : '미팅 완료 체크'}
        >
          {todo.status === 'done' && (
            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          )}
        </button>

        {/* 라벨 칩 */}
        <span
          className="px-1 text-[9px] font-bold shrink-0 inline-flex items-center"
          style={{
            backgroundColor: '#a855f7',
            color: '#ffffff',
            borderRadius: '2px',
          }}
        >
          🤝 1:1
        </span>

        {/* 날짜 + 시간 (앞에 노출) */}
        <span
          className="shrink-0 font-bold tabular-nums text-[11px]"
          style={{ color: '#7e22ce' }}
        >
          {dateLabel}
          {timeStr && ` ${timeStr}`}
        </span>

        {/* 상대방 이름 */}
        {other && (
          <span
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: other.color ?? 'var(--nv-ink)' }}
          >
            <span
              className="inline-block w-1.5 h-1.5"
              style={{ backgroundColor: other.color ?? '#a855f7' }}
            />
            {other.name}
          </span>
        )}

        {/* 내용 */}
        {meeting.notes && (
          <span
            className="flex-1 truncate text-[11px]"
            style={{ color: 'var(--nv-mute)' }}
          >
            — {meeting.notes}
          </span>
        )}
        {!meeting.notes && <span className="flex-1" />}

        {/* ✅ 컨펌 체크박스 */}
        <button
          type="button"
          onClick={() => onConfirm(!confirmed)}
          className="h-6 px-1.5 text-[10px] font-bold inline-flex items-center gap-1 shrink-0 transition-colors"
          style={{
            backgroundColor: confirmed ? '#a855f7' : '#ffffff',
            color: confirmed ? '#ffffff' : '#7e22ce',
            border: '1px solid #a855f7',
            borderRadius: '2px',
          }}
          title={confirmed ? '컨펌 해제' : '일정 컨펌 (동의)'}
        >
          {confirmed ? '✅ 컨펌됨' : '☐ 컨펌'}
        </button>

        {/* 🔄 변경 요청 버튼 */}
        <button
          type="button"
          onClick={() => setRescheduling(!rescheduling)}
          className="h-6 px-1.5 text-[10px] font-bold inline-flex items-center gap-1 shrink-0 transition-colors"
          style={{
            backgroundColor: rescheduling ? 'var(--nv-warning)' : '#ffffff',
            color: rescheduling ? '#ffffff' : 'var(--nv-warning)',
            border: '1px solid var(--nv-warning)',
            borderRadius: '2px',
          }}
          title="일정 변경 요청"
        >
          🔄 변경
        </button>
      </div>

      {/* 인라인 변경 요청 폼 */}
      {rescheduling && (
        <div className="flex items-center gap-1.5 mt-1.5 pl-5">
          <span
            className="text-[10px] font-bold shrink-0"
            style={{ color: 'var(--nv-warning)' }}
          >
            새 일정:
          </span>
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="h-6 text-[11px] px-1.5"
            style={{ width: 130 }}
          />
          <Input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="h-6 text-[11px] px-1.5"
            style={{ width: 90 }}
          />
          <button
            type="button"
            onClick={handleReschedule}
            disabled={submitting}
            className="h-6 px-2 text-[10px] font-bold disabled:opacity-40"
            style={{
              backgroundColor: 'var(--nv-warning)',
              color: '#ffffff',
              borderRadius: '2px',
            }}
          >
            {submitting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : '저장'}
          </button>
          <button
            type="button"
            onClick={() => {
              setRescheduling(false)
              setNewDate(meeting.meeting_date)
              setNewTime(meeting.meeting_time ?? '14:00')
            }}
            className="h-6 px-2 text-[10px]"
            style={{ color: 'var(--nv-stone)', borderRadius: '2px' }}
          >
            취소
          </button>
        </div>
      )}
    </div>
  )
}
