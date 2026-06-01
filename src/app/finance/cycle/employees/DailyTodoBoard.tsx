'use client'

/**
 * 일일 투두 보드 — 특정 KR 의 weekly_target 단위
 *
 * - 주간 선택기 (W1 ~ W12, 기본 현재 주)
 * - 그 주 월~일 7일 칸반
 * - 각 칸에 todo 카드 (status, 협업자 태그, 우선순위)
 * - "추가" 클릭 → 인라인 입력 (제목 + 우선순위 + 협업자 다중 선택)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Loader2,
  Trash2,
  Users as UsersIcon,
  AlertCircle,
  Check,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  TODO_STATUS_LABEL,
  TODO_STATUS_COLOR,
  currentWeekNumber,
  weekDateRange,
  weekExecRate,
  toLocalDateStr,
  todayLocal,
  type DailyTodo,
  type TodoStatus,
  type Employee,
  type WeeklyTarget,
} from '@/lib/cycle-okr'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

interface Props {
  employee: Employee
  allEmployees: Employee[]
  keyResultId: string
  cycleStart: string
  cycleEnd: string
  onError: (msg: string) => void
}

export default function DailyTodoBoard({
  employee,
  allEmployees,
  keyResultId,
  cycleStart,
  cycleEnd,
  onError,
}: Props) {
  const [weekNumber, setWeekNumber] = useState(() =>
    Math.max(1, currentWeekNumber(cycleStart, cycleEnd) || 1),
  )
  const [weeklyTargetId, setWeeklyTargetId] = useState<string | null>(null)
  const [todos, setTodos] = useState<DailyTodo[]>([])
  const [loading, setLoading] = useState(true)
  const [addingDate, setAddingDate] = useState<string | null>(null)

  // 주간 범위
  const range = useMemo(
    () => weekDateRange(cycleStart, weekNumber),
    [cycleStart, weekNumber],
  )

  // 7일 날짜 (로컬 타임존)
  const dates = useMemo(() => {
    const out: string[] = []
    const [yStr, mStr, dStr] = range.mondayISO.split('-')
    const m = new Date(Number(yStr), Number(mStr) - 1, Number(dStr))
    for (let i = 0; i < 7; i++) {
      const d = new Date(m)
      d.setDate(m.getDate() + i)
      out.push(toLocalDateStr(d))
    }
    return out
  }, [range])

  // ──────── weekly_target_id 찾기 ────────
  const fetchWeeklyTargetId = useCallback(async () => {
    try {
      const r = await fetch(`/api/cycle/weekly-targets?key_result_id=${keyResultId}`)
      if (!r.ok) return
      const j = await r.json()
      const targets: WeeklyTarget[] = j.weekly_targets ?? []
      const matched = targets.find((t) => t.week_number === weekNumber)
      setWeeklyTargetId(matched?.id ?? null)
    } catch {
      // ignore
    }
  }, [keyResultId, weekNumber])

  // ──────── todos 로드 ────────
  const fetchTodos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        employee_id: employee.id,
        date_from: range.mondayISO,
        date_to: range.sundayISO,
        include_collab: 'true',
      })
      const r = await fetch(`/api/cycle/todos?${params}`)
      if (!r.ok) throw new Error(`${r.status}`)
      const j = await r.json()
      // 이 KR 의 weekly_target 와 연결된 것 + 자유 투두 둘 다 보여줌
      // 필터: 본인 + (이 KR 의 weekly_target_id 또는 free)
      const all: DailyTodo[] = j.todos ?? []
      const filtered = all.filter((t) => {
        if (!t.weekly_target_id) return true // free todo
        return t.weekly_target_id === weeklyTargetId
      })
      setTodos(filtered)
    } catch (e) {
      onError(e instanceof Error ? e.message : '투두 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [employee.id, range, weeklyTargetId, onError])

  useEffect(() => {
    fetchWeeklyTargetId()
  }, [fetchWeeklyTargetId])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  // ──────── 통계 ────────
  const stats = useMemo(() => {
    const total = todos.length
    const done = todos.filter((t) => t.status === 'done').length
    const blocked = todos.filter((t) => t.status === 'blocked').length
    return { total, done, blocked, rate: weekExecRate(todos) }
  }, [todos])

  // 현재 주차 vs 선택된 주차 (주간 계획 가이드용)
  const realCurrentWeek = useMemo(
    () => Math.max(1, currentWeekNumber(cycleStart, cycleEnd) || 1),
    [cycleStart, cycleEnd],
  )
  const isCurrentWeek = weekNumber === realCurrentWeek
  // 현재 주차인데 todo 가 없으면 안내 표시
  const showWeekPlanGuide = isCurrentWeek && todos.length === 0 && !loading

  // 협업자 lookup
  const empById = useMemo(() => {
    const m = new Map<string, Employee>()
    for (const e of allEmployees) m.set(e.id, e)
    return m
  }, [allEmployees])

  // 날짜별 그룹
  const todosByDate = useMemo(() => {
    const m: Record<string, DailyTodo[]> = {}
    for (const t of todos) {
      m[t.date] = m[t.date] ?? []
      m[t.date].push(t)
    }
    return m
  }, [todos])

  return (
    <div className="space-y-2">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-bold tracking-tight text-[#000]">
          일일 투두
        </p>
        <span className="text-[10px] text-[#999]">
          {range.mondayISO.slice(5)} ~ {range.sundayISO.slice(5)}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#666]">주차</span>
          <select
            value={weekNumber}
            onChange={(e) => setWeekNumber(Number(e.target.value))}
            className="h-6 px-1.5 text-[11px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
            style={{ borderRadius: '2px' }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                W{i + 1}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-[#666] ml-2">
            완료 {stats.done}/{stats.total}
          </span>
          <span
            className={cn(
              'text-[10px] font-bold tabular-nums',
              stats.rate >= 0.8 ? 'text-[#76b900]' : stats.rate >= 0.6 ? 'text-[#f59e0b]' : 'text-[#ef4444]',
            )}
          >
            {Math.round(stats.rate * 100)}%
          </span>
          {stats.blocked > 0 && (
            <span className="text-[10px] text-[#ef4444] inline-flex items-center gap-0.5">
              <AlertCircle className="w-2.5 h-2.5" />
              {stats.blocked}
            </span>
          )}
        </div>
      </div>

      {/* 주간 계획 가이드 — 현재 주차인데 todo 비어있을 때 */}
      {showWeekPlanGuide && (
        <div
          className="border border-[#f59e0b] bg-[#fffbeb] p-2 text-[11px] text-[#92400e]"
          style={{ borderRadius: '2px' }}
        >
          <p className="font-bold mb-0.5">📅 이번 주 (W{weekNumber}) 계획을 작성하세요</p>
          <p className="text-[10px]">
            주가 시작될 때 (월요일) 그 주에 해야 할 일을 요일별로 펼쳐서 입력하면, 매일 칸반에서 진행 상태만 체크하면 됩니다.
            각 칸 ⊕ 버튼으로 추가.
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-[11px] text-[#666] flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          투두 로드 중...
        </div>
      ) : (
        <div className="overflow-x-auto -mx-3 px-3">
          <div className="inline-flex gap-2 min-w-full">
            {dates.map((date, i) => (
              <DayColumn
                key={date}
                date={date}
                dayLabel={DAY_LABELS[i]}
                todos={todosByDate[date] ?? []}
                employees={allEmployees}
                empById={empById}
                weeklyTargetId={weeklyTargetId}
                myEmployeeId={employee.id}
                isAdding={addingDate === date}
                onStartAdd={() => setAddingDate(date)}
                onCancelAdd={() => setAddingDate(null)}
                onChanged={fetchTodos}
                onError={onError}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-[#999]">
        ⊕ 로 일일 투두 추가 · 카드 클릭으로 상태 순환 (대기→진행→완료→막힘→대기) · 협업자 다중 선택 가능
      </p>
    </div>
  )
}

// ============================================================
// Day Column (한 날짜의 칸반 컬럼)
// ============================================================
function DayColumn({
  date,
  dayLabel,
  todos,
  employees,
  empById,
  weeklyTargetId,
  myEmployeeId,
  isAdding,
  onStartAdd,
  onCancelAdd,
  onChanged,
  onError,
}: {
  date: string
  dayLabel: string
  todos: DailyTodo[]
  employees: Employee[]
  empById: Map<string, Employee>
  weeklyTargetId: string | null
  myEmployeeId: string
  isAdding: boolean
  onStartAdd: () => void
  onCancelAdd: () => void
  onChanged: () => Promise<void>
  onError: (msg: string) => void
}) {
  const today = todayLocal()
  const isToday = date === today

  return (
    <div
      className={cn(
        'w-[160px] sm:w-[180px] shrink-0 bg-white flex flex-col',
        'border',
        isToday ? 'border-[#000] border-2' : 'border-[#e5e5e5]',
      )}
      style={{ borderRadius: '2px' }}
    >
      <div
        className={cn(
          'px-2 py-1 text-[10px] font-bold flex items-center justify-between',
          isToday ? 'bg-[#000] text-white' : 'bg-[#f9fafb] text-[#666]',
        )}
      >
        <span>
          {dayLabel} · {date.slice(5)}
          {isToday && <span className="ml-1 text-[8px]">TODAY</span>}
        </span>
        <span className="text-[9px]">{todos.length}</span>
      </div>

      <div className="p-1.5 space-y-1.5 flex-1">
        {todos.map((t) => (
          <TodoCard
            key={t.id}
            todo={t}
            empById={empById}
            myEmployeeId={myEmployeeId}
            onChanged={onChanged}
            onError={onError}
          />
        ))}

        {isAdding ? (
          <AddTodoForm
            date={date}
            employees={employees}
            myEmployeeId={myEmployeeId}
            weeklyTargetId={weeklyTargetId}
            onCancel={onCancelAdd}
            onSaved={async () => {
              await onChanged()
              onCancelAdd()
            }}
            onError={onError}
          />
        ) : (
          <button
            onClick={onStartAdd}
            className="w-full py-1 text-[10px] text-[#666] border border-dashed border-[#e5e5e5] hover:border-[#000] hover:bg-[#f9fafb] transition-colors flex items-center justify-center gap-1"
            style={{ borderRadius: '2px' }}
          >
            <Plus className="w-2.5 h-2.5" />
            추가
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Todo Card
// ============================================================
const STATUS_ORDER: TodoStatus[] = ['todo', 'doing', 'done', 'blocked']

function TodoCard({
  todo,
  empById,
  myEmployeeId,
  onChanged,
  onError,
}: {
  todo: DailyTodo
  empById: Map<string, Employee>
  myEmployeeId: string
  onChanged: () => Promise<void>
  onError: (msg: string) => void
}) {
  const [saving, setSaving] = useState(false)

  const cycleStatus = async () => {
    const idx = STATUS_ORDER.indexOf(todo.status)
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
    setSaving(true)
    try {
      const r = await fetch(`/api/cycle/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!r.ok) throw new Error(`${r.status}`)
      await onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : '상태 변경 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    // confirm 없이 즉시 삭제
    try {
      const r = await fetch(`/api/cycle/todos/${todo.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`${r.status}`)
      await onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  const isCollab = todo.employee_id !== myEmployeeId

  return (
    <div
      className="border border-[#e5e5e5] bg-white p-1.5 text-[10px] hover:shadow-sm transition-shadow"
      style={{
        borderRadius: '2px',
        borderLeft: `3px solid ${TODO_STATUS_COLOR[todo.status]}`,
      }}
    >
      <div className="flex items-start gap-1">
        <button
          onClick={cycleStatus}
          disabled={saving}
          className="shrink-0 mt-0.5"
          title={`상태: ${TODO_STATUS_LABEL[todo.status]} (클릭으로 순환)`}
        >
          {saving ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin text-[#666]" />
          ) : todo.status === 'done' ? (
            <div
              className="w-2.5 h-2.5 flex items-center justify-center"
              style={{ backgroundColor: TODO_STATUS_COLOR.done, borderRadius: '50%' }}
            >
              <Check className="w-2 h-2 text-white" strokeWidth={3} />
            </div>
          ) : todo.status === 'blocked' ? (
            <div
              className="w-2.5 h-2.5 flex items-center justify-center"
              style={{ backgroundColor: TODO_STATUS_COLOR.blocked, borderRadius: '50%' }}
            >
              <X className="w-2 h-2 text-white" strokeWidth={3} />
            </div>
          ) : (
            <div
              className="w-2.5 h-2.5 border-[1.5px]"
              style={{
                borderColor: TODO_STATUS_COLOR[todo.status],
                backgroundColor: todo.status === 'doing' ? TODO_STATUS_COLOR.doing : 'transparent',
                borderRadius: '50%',
              }}
            />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-[10px] leading-tight break-words',
              todo.status === 'done' && 'line-through text-[#999]',
            )}
          >
            {todo.title}
          </p>
          {/* 협업자·소유자 */}
          {(isCollab || todo.collaborator_ids.length > 0) && (
            <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
              {isCollab && (
                <span
                  className="px-1 py-0 text-[8px] font-bold"
                  style={{
                    backgroundColor: empById.get(todo.employee_id)?.color ?? '#666',
                    color: 'white',
                    borderRadius: '2px',
                  }}
                  title={`소유: ${empById.get(todo.employee_id)?.name ?? '?'}`}
                >
                  {empById.get(todo.employee_id)?.name.charAt(0) ?? '?'}
                </span>
              )}
              {todo.collaborator_ids.map((cid) => {
                const e = empById.get(cid)
                if (!e) return null
                return (
                  <span
                    key={cid}
                    className="px-1 py-0 text-[8px] font-bold"
                    style={{
                      backgroundColor: e.color,
                      color: 'white',
                      borderRadius: '2px',
                    }}
                    title={`협업: ${e.name}`}
                  >
                    {e.name.charAt(0)}
                  </span>
                )
              })}
              {todo.is_shared && (
                <span title="공유 업무">
                  <UsersIcon className="w-2.5 h-2.5 text-[#0ea5e9]" />
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleDelete}
          className="shrink-0 opacity-0 hover:opacity-100 text-[#991b1b]"
          title="삭제"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Add Todo Form (인라인)
// ============================================================
function AddTodoForm({
  date,
  employees,
  myEmployeeId,
  weeklyTargetId,
  onCancel,
  onSaved,
  onError,
}: {
  date: string
  employees: Employee[]
  myEmployeeId: string
  weeklyTargetId: string | null
  onCancel: () => void
  onSaved: () => Promise<void>
  onError: (msg: string) => void
}) {
  const [title, setTitle] = useState('')
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([])
  const [priority, setPriority] = useState<1 | 2 | 3>(2)
  const [saving, setSaving] = useState(false)
  const [showCollabPicker, setShowCollabPicker] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/cycle/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: myEmployeeId,
          weekly_target_id: weeklyTargetId,
          date,
          title: title.trim(),
          priority,
          collaborator_ids: collaboratorIds,
          is_shared: collaboratorIds.length > 0,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error ?? `${r.status}`)
      }
      await onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : '추가 실패')
    } finally {
      setSaving(false)
    }
  }

  const otherEmployees = employees.filter((e) => e.id !== myEmployeeId)

  return (
    <div
      className="border border-[var(--nv-primary)] bg-white p-1.5 space-y-1.5"
      style={{ borderRadius: '2px' }}
    >
      <Input
        autoFocus
        placeholder="할 일..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
          if (e.key === 'Escape') onCancel()
        }}
        className="h-6 text-[10px] px-1.5"
      />
      <div className="flex items-center gap-1 flex-wrap">
        {/* 우선순위 */}
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}
          className="h-5 px-1 text-[9px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
          style={{ borderRadius: '2px' }}
        >
          <option value={1}>!! 높음</option>
          <option value={2}>중간</option>
          <option value={3}>· 낮음</option>
        </select>
        {/* 협업자 */}
        <button
          onClick={() => setShowCollabPicker(!showCollabPicker)}
          className={cn(
            'h-5 px-1.5 text-[9px] font-bold inline-flex items-center gap-0.5',
            collaboratorIds.length > 0
              ? 'bg-[#0ea5e9] text-white'
              : 'bg-[#f9fafb] text-[#666] hover:bg-[#f3f4f6]',
          )}
          style={{ borderRadius: '2px' }}
        >
          <UsersIcon className="w-2.5 h-2.5" />
          {collaboratorIds.length > 0 ? `${collaboratorIds.length}명` : '협업자'}
        </button>
        <div className="flex-1" />
        <button
          onClick={onCancel}
          disabled={saving}
          className="h-5 w-5 inline-flex items-center justify-center hover:bg-[#f7f7f7]"
          style={{ borderRadius: '2px' }}
        >
          <X className="w-3 h-3" />
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
          className="h-5 px-1.5 text-[9px] font-bold bg-black text-white disabled:opacity-40"
          style={{ borderRadius: '2px' }}
        >
          {saving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : '추가'}
        </button>
      </div>

      {/* 협업자 picker */}
      {showCollabPicker && (
        <div
          className="border border-[#e5e5e5] bg-[#f9fafb] p-1.5 space-y-0.5 max-h-32 overflow-auto"
          style={{ borderRadius: '2px' }}
        >
          {otherEmployees.length === 0 ? (
            <p className="text-[9px] text-[#666]">다른 직원 없음</p>
          ) : (
            otherEmployees.map((emp) => {
              const checked = collaboratorIds.includes(emp.id)
              return (
                <label
                  key={emp.id}
                  className="flex items-center gap-1.5 cursor-pointer text-[10px] hover:bg-white px-1 py-0.5"
                  style={{ borderRadius: '2px' }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCollaboratorIds([...collaboratorIds, emp.id])
                      } else {
                        setCollaboratorIds(collaboratorIds.filter((id) => id !== emp.id))
                      }
                    }}
                    className="w-2.5 h-2.5 accent-[#0ea5e9]"
                  />
                  <span
                    className="w-4 h-4 inline-flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ backgroundColor: emp.color, borderRadius: '2px' }}
                  >
                    {emp.name.charAt(0)}
                  </span>
                  <span>{emp.name}</span>
                  {emp.role_label && (
                    <span className="text-[8px] text-[#999]">{emp.role_label}</span>
                  )}
                </label>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
