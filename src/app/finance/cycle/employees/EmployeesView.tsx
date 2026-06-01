'use client'

/**
 * 직원 관리 + 직원별 OKR 토글 리스트
 * Phase A: 직원 CRUD + 토글 (Goal/KR/주간/Todo 트리는 Phase B 에서 채움)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Crown,
  Save,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BUSINESS_TRACK_LABEL,
  type BusinessTrack,
  type Employee,
} from '@/lib/cycle-okr'
import { cn } from '@/lib/utils'
import OkrTree from './OkrTree'

const TRACK_COLORS: Record<BusinessTrack, { bg: string; text: string }> = {
  b2b: { bg: '#dbeafe', text: '#1e40af' },
  b2c: { bg: '#fce7f3', text: '#9d174d' },
  both: { bg: '#f3f4f6', text: '#1f2937' },
}

const PRESET_COLORS = [
  '#76b900', // green
  '#0ea5e9', // sky
  '#f59e0b', // amber
  '#a855f7', // purple
  '#f43f5e', // rose
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#84cc16', // lime
]

interface EmployeesViewProps {
  cycleId: number
  cycleStart: string
  cycleEnd: string
}

const EXPANDED_KEY = 'dian.cycle.employees.expanded'

export default function EmployeesView({ cycleId, cycleStart, cycleEnd }: EmployeesViewProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 여러 직원 동시 펼침 — 각자 자기 OKR 을 독립 작성·저장 가능
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // localStorage 에서 펼침 상태 복원 + URL hash 자동 펼침
  useEffect(() => {
    if (typeof window === 'undefined') return
    let initial = new Set<string>()
    try {
      const raw = localStorage.getItem(EXPANDED_KEY)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) initial = new Set(arr.filter((v) => typeof v === 'string'))
      }
    } catch {
      /* ignore */
    }
    const hash = window.location.hash
    if (hash.startsWith('#emp-')) {
      const id = hash.slice(5)
      initial.add(id)
      // 스크롤
      setTimeout(() => {
        const el = document.getElementById(`emp-${id}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
    setExpandedIds(initial)
  }, [])

  // 펼침 상태 변경 시 localStorage 저장
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(expandedIds)))
    } catch {
      /* ignore */
    }
  }, [expandedIds])

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(employees.map((e) => e.id)))
  }, [employees])

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  // ──────── 데이터 로드 ────────
  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cycle/employees')
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      setEmployees(json.employees ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  // ──────── 통계 ────────
  const stats = useMemo(() => {
    const total = employees.length
    const byTrack = employees.reduce(
      (acc, e) => {
        acc[e.business_track] = (acc[e.business_track] ?? 0) + 1
        return acc
      },
      {} as Record<BusinessTrack, number>,
    )
    return { total, byTrack }
  }, [employees])

  // ──────── 삭제 (soft) ────────
  const handleDeactivate = async (emp: Employee) => {
    if (!confirm(`"${emp.name}" 을 비활성화할까요?\n(데이터는 보존됩니다)`)) return
    try {
      const res = await fetch(`/api/cycle/employees/${emp.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`${res.status}`)
      await fetchEmployees()
    } catch (e) {
      setError(e instanceof Error ? e.message : '비활성화 실패')
    }
  }

  return (
    <div className="space-y-5">
      {/* 상단 통계 */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="font-bold text-[#000]">전체 {stats.total}명</span>
        <span className="text-[#cccccc]">·</span>
        <span style={{ color: '#1e40af' }}>B2B {stats.byTrack.b2b ?? 0}</span>
        <span className="text-[#cccccc]">·</span>
        <span style={{ color: '#9d174d' }}>B2C {stats.byTrack.b2c ?? 0}</span>
        <span className="text-[#cccccc]">·</span>
        <span className="text-[#666]">공통 {stats.byTrack.both ?? 0}</span>

        <div className="flex-1" />

        {/* 모두 펼치기/접기 — 직원들 동시에 작성 시 편리 */}
        {employees.length > 0 && (
          <>
            <button
              type="button"
              onClick={expandAll}
              disabled={expandedIds.size === employees.length}
              className="h-8 px-2.5 text-[11px] font-bold bg-white transition-colors disabled:opacity-40"
              style={{
                border: '1px solid var(--nv-hairline)',
                borderRadius: '2px',
                color: 'var(--nv-ink)',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled)
                  e.currentTarget.style.borderColor = 'var(--nv-ink)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--nv-hairline)'
              }}
              title="모든 직원 카드 펼치기"
            >
              모두 펼치기
            </button>
            <button
              type="button"
              onClick={collapseAll}
              disabled={expandedIds.size === 0}
              className="h-8 px-2.5 text-[11px] font-bold bg-white transition-colors disabled:opacity-40"
              style={{
                border: '1px solid var(--nv-hairline)',
                borderRadius: '2px',
                color: 'var(--nv-ink)',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled)
                  e.currentTarget.style.borderColor = 'var(--nv-ink)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--nv-hairline)'
              }}
              title="모든 직원 카드 접기"
            >
              모두 접기
            </button>
          </>
        )}

        <Button
          onClick={() => {
            setShowAddForm(true)
            setEditingId(null)
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          직원 추가
        </Button>
      </div>

      {/* 에러 */}
      {error && (
        <div
          className="border border-[#e52020] bg-[#fef2f2] p-3 text-[13px] text-[#991b1b]"
          style={{ borderRadius: '2px' }}
        >
          <div className="flex items-start justify-between gap-3">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)} className="shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 추가 폼 */}
      {showAddForm && (
        <EmployeeForm
          mode="create"
          onCancel={() => setShowAddForm(false)}
          onSaved={async () => {
            setShowAddForm(false)
            await fetchEmployees()
          }}
          onError={setError}
        />
      )}

      {/* 토글 리스트 */}
      {loading ? (
        <div className="text-center py-10 text-[#757575]">불러오는 중...</div>
      ) : employees.length === 0 ? (
        <div
          className="border border-dashed border-[#cccccc] bg-white py-12 text-center text-[14px] text-[#757575]"
          style={{ borderRadius: '2px' }}
        >
          아직 등록된 직원이 없습니다. 우측 상단 <strong>직원 추가</strong> 로 시작하세요.
        </div>
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => (
            <EmployeeToggleRow
              key={emp.id}
              employee={emp}
              allEmployees={employees}
              cycleId={cycleId}
              cycleStart={cycleStart}
              cycleEnd={cycleEnd}
              expanded={expandedIds.has(emp.id)}
              editing={editingId === emp.id}
              onToggle={() => toggleExpanded(emp.id)}
              onEdit={() => {
                setEditingId(emp.id)
                setExpandedIds((prev) => {
                  const next = new Set(prev)
                  next.add(emp.id)
                  return next
                })
              }}
              onCancelEdit={() => setEditingId(null)}
              onSaved={async () => {
                setEditingId(null)
                await fetchEmployees()
              }}
              onDeactivate={() => handleDeactivate(emp)}
              onError={setError}
            />
          ))}
        </div>
      )}

      {/* 사용법 안내 */}
      <div
        className="border border-[#cccccc] bg-[#f9fafb] p-4 text-[12px] text-[#666]"
        style={{ borderRadius: '2px' }}
      >
        <p className="font-bold text-[#000] mb-1">📌 사용법</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>각자 자기 카드를 펼쳐 동시에 작성·저장</strong> 가능 — 여러 직원이 한 화면에서 자기 OKR 을 따로 작성할 수 있고, 저장은 직원별로 독립적으로 처리됩니다. 펼침 상태는 자동 저장되어 새로고침해도 유지됩니다.
          </li>
          <li>직원 카드를 펼치면 <strong>12주 목표 (3개 권장) → KR (3개 권장) → 주간 타겟 → 일일 투두</strong> 트리가 표시됩니다.</li>
          <li>KR 옆 📌 아이콘으로 <strong>회사 핀</strong> 토글 — 메인 대시보드에 띄울 핵심 KR 선정 (대표 권장).</li>
          <li>일일 투두에 <strong>협업자 태그</strong>로 다른 직원 다중 선택 — 공유/협업 업무 표시.</li>
        </ul>
      </div>
    </div>
  )
}

// ============================================================
// 토글 행
// ============================================================
function EmployeeToggleRow({
  employee,
  allEmployees,
  cycleId,
  cycleStart,
  cycleEnd,
  expanded,
  editing,
  onToggle,
  onEdit,
  onCancelEdit,
  onSaved,
  onDeactivate,
  onError,
}: {
  employee: Employee
  allEmployees: Employee[]
  cycleId: number
  cycleStart: string
  cycleEnd: string
  expanded: boolean
  editing: boolean
  onToggle: () => void
  onEdit: () => void
  onCancelEdit: () => void
  onSaved: () => Promise<void>
  onDeactivate: () => void
  onError: (msg: string) => void
}) {
  const trackColor = TRACK_COLORS[employee.business_track]

  return (
    <div
      id={`emp-${employee.id}`}
      className="border border-[#e5e5e5] bg-white overflow-hidden hover:border-[#000] transition-colors scroll-mt-4"
      style={{ borderRadius: '2px' }}
    >
      {/* 헤더 (클릭하면 토글) */}
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 shrink-0 text-[#757575]" strokeWidth={2} />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0 text-[#757575]" strokeWidth={2} />
          )}

          {/* 색상 칩 + 이모지 */}
          <div
            className="w-9 h-9 shrink-0 flex items-center justify-center text-[14px] font-bold text-white"
            style={{ backgroundColor: employee.color, borderRadius: '2px' }}
          >
            {employee.avatar_emoji ?? employee.name.charAt(0)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[14px] font-bold tracking-tight text-[#000]">
                {employee.name}
              </span>
              {employee.is_leader && (
                <Crown className="w-3.5 h-3.5 text-[#f59e0b]" fill="#f59e0b" />
              )}
              {employee.role_label && (
                <span className="text-[11px] text-[#757575]">
                  {employee.role_label}
                </span>
              )}
              {employee.department && (
                <>
                  <span className="text-[#cccccc] text-[10px]">·</span>
                  <span className="text-[11px] text-[#666]">
                    {employee.department}
                  </span>
                </>
              )}
            </div>
            <span
              className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: trackColor.bg,
                color: trackColor.text,
                borderRadius: '2px',
              }}
            >
              {BUSINESS_TRACK_LABEL[employee.business_track]}
            </span>
          </div>
        </button>

        {/* 액션 */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="h-7 w-7 inline-flex items-center justify-center hover:bg-[#f7f7f7] transition-colors"
            style={{ borderRadius: '2px' }}
            title="수정"
          >
            <Pencil className="w-3.5 h-3.5 text-[#666]" strokeWidth={2} />
          </button>
          {!employee.is_leader && (
            <button
              onClick={onDeactivate}
              className="h-7 w-7 inline-flex items-center justify-center hover:bg-[#fef2f2] text-[#991b1b] transition-colors"
              style={{ borderRadius: '2px' }}
              title="비활성화"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* 펼친 영역 */}
      {expanded && (
        <div className="border-t border-[#e5e5e5] p-4 bg-[#fafafa]">
          {editing ? (
            <EmployeeForm
              mode="edit"
              initial={employee}
              onCancel={onCancelEdit}
              onSaved={onSaved}
              onError={onError}
            />
          ) : (
            <OkrTree
              employee={employee}
              allEmployees={allEmployees}
              cycleId={cycleId}
              cycleStart={cycleStart}
              cycleEnd={cycleEnd}
              onError={onError}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 직원 추가/수정 폼
// ============================================================
function EmployeeForm({
  mode,
  initial,
  onCancel,
  onSaved,
  onError,
}: {
  mode: 'create' | 'edit'
  initial?: Employee
  onCancel: () => void
  onSaved: () => Promise<void>
  onError: (msg: string) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [roleLabel, setRoleLabel] = useState(initial?.role_label ?? '')
  const [department, setDepartment] = useState(initial?.department ?? '')
  const [businessTrack, setBusinessTrack] = useState<BusinessTrack>(
    initial?.business_track ?? 'both',
  )
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0])
  const [avatarEmoji, setAvatarEmoji] = useState(initial?.avatar_emoji ?? '')
  const [isLeader, setIsLeader] = useState(initial?.is_leader ?? false)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      onError('이름은 필수입니다.')
      return
    }
    setSaving(true)
    try {
      const url =
        mode === 'create'
          ? '/api/cycle/employees'
          : `/api/cycle/employees/${initial!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          role_label: roleLabel.trim() || null,
          department: department.trim() || null,
          business_track: businessTrack,
          color,
          avatar_emoji: avatarEmoji.trim() || null,
          is_leader: isLeader,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? `${res.status}`)
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
      className="border border-[#e5e5e5] bg-white p-4 space-y-3"
      style={{ borderRadius: '2px' }}
    >
      <p className="text-[13px] font-bold tracking-tight text-[#000]">
        {mode === 'create' ? '새 직원 추가' : '직원 정보 수정'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="이름 *">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="직위">
          <Input
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.target.value)}
            placeholder="대표 · 부장 · 과장 · 팀장 등"
          />
        </Field>
        <Field label="부서/담당">
          <Input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="영업 · 마케팅 · 운영 · B2C 신사업 등"
          />
        </Field>
        <Field label="비즈니스 트랙">
          <select
            value={businessTrack}
            onChange={(e) => setBusinessTrack(e.target.value as BusinessTrack)}
            className="h-9 w-full px-2 text-[13px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
            style={{ borderRadius: '2px' }}
          >
            <option value="both">공통</option>
            <option value="b2b">B2B</option>
            <option value="b2c">B2C</option>
          </select>
        </Field>
        <Field label="아바타 이모지">
          <Input
            value={avatarEmoji}
            onChange={(e) => setAvatarEmoji(e.target.value)}
            placeholder="👑 · 🎯 · 💼 (선택)"
            maxLength={4}
          />
        </Field>
        <Field label="대표 여부">
          <label className="flex items-center gap-2 h-9 text-[13px]">
            <input
              type="checkbox"
              checked={isLeader}
              onChange={(e) => setIsLeader(e.target.checked)}
              className="w-4 h-4 accent-[#f59e0b]"
            />
            <span>이 직원은 회사 대표(사장)입니다</span>
          </label>
        </Field>
      </div>

      {/* 색상 선택 */}
      <Field label="카드 색상">
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'w-8 h-8 transition-all',
                color === c ? 'ring-2 ring-offset-2 ring-[#000]' : '',
              )}
              style={{ backgroundColor: c, borderRadius: '2px' }}
              title={c}
            />
          ))}
        </div>
      </Field>

      <Field label="비고 / 메모">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-2 py-1.5 text-[13px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900] resize-none"
          style={{ borderRadius: '2px' }}
          placeholder="(선택) 강점·관심영역·1:1 노트 등"
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="gap-2">
          <X className="w-4 h-4" />
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              저장 중
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              저장
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold tracking-tight text-[#666]">
        {label}
      </label>
      {children}
    </div>
  )
}

