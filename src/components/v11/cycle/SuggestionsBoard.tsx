'use client'

/**
 * 12주 사이클 건의사항 보드 — 목록 + 필터 + 토글
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Check, RotateCcw, Trash2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Suggestion {
  id: number
  cycle_id: number
  employee_id: string | null
  week_number_created: number
  title: string
  status: 'open' | 'resolved'
  resolved_at: string | null
  resolved_note: string | null
  created_at: string
  employees?: { id: string; name: string; color: string; role_label: string | null } | null
}

interface Cycle {
  id: number
  cycle_number: number
}

type FilterStatus = 'all' | 'open' | 'resolved'

export default function SuggestionsBoard() {
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('open')
  const [editingNote, setEditingNote] = useState<{ id: number; value: string } | null>(null)
  const [submitting, setSubmitting] = useState<number | null>(null)

  // 활성 사이클 조회
  const fetchCycle = useCallback(async () => {
    try {
      const r = await fetch('/api/cycle/info')
      if (!r.ok) return
      const j = await r.json()
      if (j.cycle) setCycle(j.cycle)
    } catch {
      /* ignore */
    }
  }, [])

  const fetchSuggestions = useCallback(
    async (cycleId: number) => {
      setLoading(true)
      try {
        const r = await fetch(
          `/api/cycle/suggestions?cycle_id=${cycleId}&status=all`,
        )
        if (!r.ok) throw new Error(`${r.status}`)
        const j = await r.json()
        setSuggestions(j.suggestions ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : '로드 실패')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchCycle()
  }, [fetchCycle])

  useEffect(() => {
    if (cycle?.id) fetchSuggestions(cycle.id)
  }, [cycle?.id, fetchSuggestions])

  const filtered = suggestions.filter((s) => {
    if (filter === 'all') return true
    return s.status === filter
  })

  const openCount = suggestions.filter((s) => s.status === 'open').length
  const resolvedCount = suggestions.filter((s) => s.status === 'resolved').length

  const toggleStatus = async (s: Suggestion) => {
    setSubmitting(s.id)
    try {
      await fetch('/api/cycle/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: s.id,
          status: s.status === 'open' ? 'resolved' : 'open',
        }),
      })
      if (cycle?.id) await fetchSuggestions(cycle.id)
    } finally {
      setSubmitting(null)
    }
  }

  const saveNote = async (id: number, value: string) => {
    setSubmitting(id)
    try {
      await fetch('/api/cycle/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolved_note: value }),
      })
      if (cycle?.id) await fetchSuggestions(cycle.id)
    } finally {
      setSubmitting(null)
      setEditingNote(null)
    }
  }

  const removeSuggestion = async (id: number) => {
    setSubmitting(id)
    try {
      await fetch(`/api/cycle/suggestions?id=${id}`, { method: 'DELETE' })
      if (cycle?.id) await fetchSuggestions(cycle.id)
    } finally {
      setSubmitting(null)
    }
  }

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
        <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
        로드 중...
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="p-4 text-[12px]"
        style={{
          border: '1px solid var(--nv-error)',
          backgroundColor: '#fef2f2',
          color: 'var(--nv-error)',
          borderRadius: '2px',
        }}
      >
        ⚠ {error}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 필터 + 통계 */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { key: 'open' as const, label: `미해결 ${openCount}`, color: 'var(--nv-warning)' },
            { key: 'resolved' as const, label: `해결됨 ${resolvedCount}`, color: 'var(--nv-primary)' },
            { key: 'all' as const, label: `전체 ${suggestions.length}`, color: 'var(--nv-mute)' },
          ] satisfies Array<{ key: FilterStatus; label: string; color: string }>
        ).map((opt) => {
          const active = filter === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFilter(opt.key)}
              className="h-8 px-3 text-[12px] font-bold transition-colors"
              style={{
                backgroundColor: active ? 'var(--nv-ink)' : '#ffffff',
                color: active ? '#ffffff' : opt.color,
                border: `1px solid ${active ? 'var(--nv-ink)' : 'var(--nv-hairline)'}`,
                borderRadius: '2px',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div
          className="bg-white p-8 text-center"
          style={{
            border: '1px dashed var(--nv-hairline)',
            borderRadius: '2px',
          }}
        >
          <MessageSquare
            className="w-8 h-8 mx-auto mb-2"
            style={{ color: 'var(--nv-hairline)' }}
          />
          <p
            className="text-[13px] font-bold mb-1"
            style={{ color: 'var(--nv-ink)' }}
          >
            {filter === 'open'
              ? '미해결 건의사항이 없습니다'
              : filter === 'resolved'
                ? '해결된 건의사항이 없습니다'
                : '아직 등록된 건의사항이 없습니다'}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--nv-mute)' }}>
            직원별 OKR 페이지 → 주별 카드 펼침 → 금요일 아래 건의사항 입력
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => {
            const isResolved = s.status === 'resolved'
            const empColor = s.employees?.color ?? '#76b900'
            return (
              <li
                key={s.id}
                className="bg-white p-3 flex items-start gap-3"
                style={{
                  border: '1px solid var(--nv-hairline)',
                  borderLeft: `4px solid ${
                    isResolved ? 'var(--nv-primary)' : 'var(--nv-warning)'
                  }`,
                  borderRadius: '2px',
                }}
              >
                {/* 체크박스 */}
                <button
                  type="button"
                  onClick={() => toggleStatus(s)}
                  disabled={submitting === s.id}
                  className="w-5 h-5 mt-0.5 shrink-0 flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: isResolved ? 'var(--nv-primary)' : '#ffffff',
                    border: `1px solid ${
                      isResolved ? 'var(--nv-primary)' : 'var(--nv-hairline)'
                    }`,
                    borderRadius: '2px',
                  }}
                  title={isResolved ? '미해결로 되돌리기' : '해결 처리'}
                >
                  {submitting === s.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isResolved ? (
                    <Check className="w-3 h-3" style={{ color: '#000' }} strokeWidth={3} />
                  ) : null}
                </button>

                {/* 본문 */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn('text-[14px] leading-snug')}
                    style={{
                      color: isResolved ? 'var(--nv-stone)' : 'var(--nv-ink)',
                      textDecoration: isResolved ? 'line-through' : 'none',
                      fontWeight: 600,
                    }}
                  >
                    {s.title}
                  </p>
                  <div
                    className="mt-1 text-[10px] flex items-center gap-2 flex-wrap"
                    style={{ color: 'var(--nv-stone)' }}
                  >
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ color: empColor }}
                    >
                      <span
                        className="inline-block w-1.5 h-1.5"
                        style={{ backgroundColor: empColor }}
                      />
                      <strong>{s.employees?.name ?? '익명'}</strong>
                      {s.employees?.role_label && (
                        <span style={{ color: 'var(--nv-stone)' }}>
                          ({s.employees.role_label})
                        </span>
                      )}
                    </span>
                    <span>W{s.week_number_created} 작성</span>
                    <span>·</span>
                    <span>{new Date(s.created_at).toLocaleDateString('ko-KR')}</span>
                    {isResolved && s.resolved_at && (
                      <>
                        <span>·</span>
                        <span style={{ color: 'var(--nv-primary)' }}>
                          ✓ 해결 {new Date(s.resolved_at).toLocaleDateString('ko-KR')}
                        </span>
                      </>
                    )}
                  </div>

                  {/* 해결 메모 */}
                  {(isResolved || editingNote?.id === s.id) && (
                    <div className="mt-2">
                      {editingNote?.id === s.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingNote.value}
                            onChange={(e) =>
                              setEditingNote({ id: s.id, value: e.target.value })
                            }
                            placeholder="해결 메모 (어떻게 해결했는지)"
                            className="flex-1 h-7 px-2 text-[12px] outline-none"
                            style={{
                              border: '1px solid var(--nv-hairline)',
                              borderRadius: '2px',
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveNote(s.id, editingNote.value)
                              if (e.key === 'Escape') setEditingNote(null)
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => saveNote(s.id, editingNote.value)}
                            className="h-7 px-2 text-[11px] font-bold"
                            style={{
                              backgroundColor: 'var(--nv-primary)',
                              color: '#000',
                              borderRadius: '2px',
                            }}
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNote(null)}
                            className="h-7 px-2 text-[11px]"
                            style={{
                              color: 'var(--nv-stone)',
                              borderRadius: '2px',
                            }}
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingNote({ id: s.id, value: s.resolved_note ?? '' })
                          }
                          className="text-[11px] text-left w-full px-2 py-1"
                          style={{
                            backgroundColor: 'var(--nv-accent-pale)',
                            color: 'var(--nv-ink)',
                            borderRadius: '2px',
                          }}
                        >
                          {s.resolved_note ? (
                            <>📝 {s.resolved_note}</>
                          ) : (
                            <span
                              className="italic"
                              style={{ color: 'var(--nv-success-deep)' }}
                            >
                              + 해결 메모 추가 (어떻게 해결됐는지)
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 액션 */}
                <div className="flex items-center gap-1 shrink-0">
                  {isResolved && (
                    <button
                      type="button"
                      onClick={() => toggleStatus(s)}
                      className="h-7 w-7 inline-flex items-center justify-center transition-colors"
                      style={{ borderRadius: '2px', color: 'var(--nv-stone)' }}
                      title="미해결로 되돌리기"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeSuggestion(s.id)}
                    className="h-7 w-7 inline-flex items-center justify-center transition-colors"
                    style={{ borderRadius: '2px', color: 'var(--nv-stone)' }}
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
