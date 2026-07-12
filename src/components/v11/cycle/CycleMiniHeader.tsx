'use client'

/**
 * 12주 사이클 미니 헤더 — NVIDIA 톤
 *
 * - 큰 목표 (vision_statement) : NVIDIA accent-pale(#bff230) bg + green 좌측 strip
 * - Week N/12 · D-N · WAM D-N · 진행률% 미니 strip — single-hue green
 * - 시작일·종료일·큰 목표 인라인 편집 (펜 버튼)
 * - 시작일 변경 시 모든 직원 KR.started_date 자동 동기화 → 페이지 reload
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Calendar,
  Clock,
  Target,
  Pencil,
  Save,
  X,
  Loader2,
  Check,
  MessageSquare,
} from 'lucide-react'

export interface MiniHeaderCycle {
  id: number
  cycle_number: number
  start_date: string
  end_date: string
  vision_statement?: string | null
}

interface Props {
  cycle: MiniHeaderCycle
}

interface Suggestion {
  id: number
  title: string
  status: 'open' | 'resolved'
  week_number_created: number
  employees?: { name?: string; color?: string } | null
}

export default function CycleMiniHeader({ cycle: initial }: Props) {
  const [cycle, setCycle] = useState<MiniHeaderCycle>(initial)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 건의사항 (open 만)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  const fetchSuggestions = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/cycle/suggestions?cycle_id=${cycle.id}&status=open`,
      )
      if (!r.ok) return
      const j = await r.json()
      setSuggestions(j.suggestions ?? [])
    } catch {
      /* ignore */
    }
  }, [cycle.id])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  const resolveSuggestion = async (id: number) => {
    setResolvingId(id)
    try {
      await fetch('/api/cycle/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'resolved' }),
      })
      await fetchSuggestions()
    } finally {
      setResolvingId(null)
    }
  }

  const [startDate, setStartDate] = useState(initial.start_date)
  const [endDate, setEndDate] = useState(initial.end_date)
  const [vision, setVision] = useState(initial.vision_statement ?? '')

  const [progress, setProgress] = useState<{
    weekNumber: number
    daysRemaining: number
    totalProgress: number
  } | null>(null)
  const [wamDday, setWamDday] = useState<number | null>(null)

  useEffect(() => {
    const s = new Date(cycle.start_date).getTime()
    const e = new Date(cycle.end_date).getTime()
    const now = Date.now()
    let p
    if (now < s) {
      p = { weekNumber: 0, daysRemaining: Math.ceil((e - s) / 86400000), totalProgress: 0 }
    } else if (now > e) {
      p = { weekNumber: 12, daysRemaining: 0, totalProgress: 1 }
    } else {
      const diff = now - s
      const total = e - s
      const days = Math.floor(diff / 86400000)
      p = {
        weekNumber: Math.min(12, Math.floor(days / 7) + 1),
        daysRemaining: Math.ceil((e - now) / 86400000),
        totalProgress: diff / total,
      }
    }
    setProgress(p)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dow = today.getDay()
    setWamDday(dow === 0 ? 1 : (8 - dow) % 7)
  }, [cycle.start_date, cycle.end_date])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/cycle/info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          vision_statement: vision.trim() || null,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error ?? `${r.status}`)
      }
      const j = await r.json()
      setCycle(j.cycle)
      setEditing(false)
      // 캐시 무효화 (대시보드 요약이 stale 한 cycle 정보 보이지 않게)
      try {
        sessionStorage.removeItem('dian:dashboard-summary')
      } catch {
        /* ignore */
      }
      if (j.day_delta && j.day_delta !== 0) {
        window.location.reload()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setStartDate(cycle.start_date)
    setEndDate(cycle.end_date)
    setVision(cycle.vision_statement ?? '')
    setEditing(false)
    setError(null)
  }

  return (
    <div className="space-y-2">
      {/* 큰 목표 — NVIDIA green pale + 좌측 green strip */}
      {!editing && cycle.vision_statement && (
        <div
          className="flex items-start gap-2 px-3 py-2"
          style={{
            backgroundColor: 'var(--nv-accent-pale)',
            borderLeft: '4px solid var(--nv-primary)',
            borderRadius: '2px',
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Target className="w-3 h-3" style={{ color: 'var(--nv-success-deep)' }} />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--nv-success-deep)' }}
              >
                12주 큰 목표 · 모두가 향하는 한 방향
              </span>
            </div>
            <p
              className="text-[14px] font-bold leading-snug"
              style={{ color: 'var(--nv-ink)' }}
            >
              {cycle.vision_statement}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 p-0.5 transition-colors"
            style={{ color: 'var(--nv-success-deep)', borderRadius: '2px' }}
            title="큰 목표 편집"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      )}
      {!editing && !cycle.vision_statement && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full text-left bg-white px-3 py-2 flex items-center gap-1.5 transition-colors"
          style={{
            border: '1px dashed var(--nv-hairline)',
            borderRadius: '2px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--nv-ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--nv-hairline)')}
        >
          <Target className="w-3 h-3" style={{ color: 'var(--nv-stone)' }} />
          <span
            className="text-[11px] italic"
            style={{ color: 'var(--nv-mute)' }}
          >
            12주 큰 목표 — 한 문장으로 적어주세요 (예: "B2C 신사업 안착 + B2B 매출 +30%")
          </span>
        </button>
      )}

      {/* 미니 strip — single-hue green */}
      {!editing && (
        <div
          className="bg-white px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5"
          style={{
            border: '1px solid var(--nv-hairline)',
            borderRadius: '2px',
          }}
        >
          {/* Week N/12 */}
          <div className="flex items-baseline gap-1 shrink-0">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ color: 'var(--nv-mute)' }}
            >
              Week
            </span>
            <span
              className="text-[16px] font-bold tabular-nums"
              style={{ color: 'var(--nv-ink)' }}
            >
              {progress?.weekNumber ?? '—'}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--nv-stone)' }}>
              /12
            </span>
          </div>

          {/* 진행 바 (green only) */}
          <div className="flex-1 min-w-[120px]">
            <div
              className="relative h-2 overflow-hidden"
              style={{ backgroundColor: 'var(--nv-surface-soft)', borderRadius: '2px' }}
            >
              <div
                className="absolute left-0 top-0 h-full transition-all"
                style={{
                  width: progress ? `${(progress.totalProgress * 100).toFixed(2)}%` : '0%',
                  backgroundColor: 'var(--nv-primary)',
                }}
              />
              {Array.from({ length: 11 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full w-px"
                  style={{ left: `${((i + 1) / 12) * 100}%`, backgroundColor: '#ffffff' }}
                />
              ))}
            </div>
          </div>

          {/* 진행률% + D-N */}
          <div className="flex items-baseline gap-1 shrink-0">
            <span
              className="text-[14px] font-bold tabular-nums"
              style={{ color: 'var(--nv-primary)' }}
            >
              {progress ? `${Math.round(progress.totalProgress * 100)}%` : '—'}
            </span>
            {progress && (
              <span className="text-[10px]" style={{ color: 'var(--nv-stone)' }}>
                · D-{progress.daysRemaining}
              </span>
            )}
          </div>

          {/* WAM dday — NVIDIA neutral (surface-soft + ink + green dot) */}
          {wamDday !== null && wamDday <= 7 && (
            <div
              className="px-2 py-0.5 text-[10px] inline-flex items-center gap-1 shrink-0"
              style={{
                backgroundColor: 'var(--nv-surface-soft)',
                color: 'var(--nv-ink)',
                borderRadius: '2px',
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5"
                style={{ backgroundColor: 'var(--nv-primary)' }}
              />
              <Clock className="w-2.5 h-2.5" style={{ color: 'var(--nv-mute)' }} />
              WAM <strong>{wamDday === 0 ? '오늘' : `D-${wamDday}`}</strong>
            </div>
          )}

          {/* 시작/종료일 + 편집 */}
          <div
            className="flex items-center gap-2 shrink-0 text-[10px]"
            style={{ color: 'var(--nv-stone)' }}
          >
            <Calendar className="w-2.5 h-2.5" />
            <span>
              {cycle.start_date.slice(5)} ~ {cycle.end_date.slice(5)}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="p-0.5 transition-colors"
              style={{ color: 'var(--nv-mute)', borderRadius: '2px' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--nv-ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--nv-mute)')}
              title="시작일·종료일 편집"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 💬 미해결 건의사항 strip — 체크 시 해결 처리되어 사라짐 */}
      {!editing && suggestions.length > 0 && (
        <div
          className="px-3 py-2"
          style={{
            backgroundColor: '#fff7ed',
            border: '1px solid var(--nv-warning)',
            borderRadius: '2px',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageSquare
              className="w-3 h-3"
              style={{ color: 'var(--nv-warning)' }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: 'var(--nv-warning)' }}
            >
              💬 미해결 건의사항 {suggestions.length}건
            </span>
            <span
              className="text-[10px] italic"
              style={{ color: 'var(--nv-mute)' }}
            >
              · 체크 시 해결 처리 + 목록에 자동 보관
            </span>
            <a
              href="/finance/cycle/suggestions"
              className="ml-auto text-[10px] font-bold underline"
              style={{ color: 'var(--nv-success-deep)' }}
            >
              전체 목록 보기 →
            </a>
          </div>
          <ul className="space-y-1">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="flex items-start gap-2 px-2 py-1 bg-white"
                style={{
                  border: '1px solid var(--nv-hairline)',
                  borderRadius: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => resolveSuggestion(s.id)}
                  disabled={resolvingId === s.id}
                  className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--nv-hairline)',
                    borderRadius: '2px',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--nv-primary)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--nv-hairline)')
                  }
                  title="체크 시 해결로 처리 (목록 보관)"
                >
                  {resolvingId === s.id && (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[12px] leading-snug"
                    style={{ color: 'var(--nv-ink)' }}
                  >
                    {s.title}
                  </p>
                  <p className="text-[9px]" style={{ color: 'var(--nv-stone)' }}>
                    W{s.week_number_created} · {s.employees?.name ?? '익명'} 작성
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 편집 모드 — NVIDIA surface-soft + ink border */}
      {editing && (
        <div
          className="p-3 space-y-3"
          style={{
            backgroundColor: 'var(--nv-surface-soft)',
            border: '1px solid var(--nv-ink)',
            borderRadius: '2px',
          }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'var(--nv-ink)' }}
          >
            사이클 정보 편집
          </p>
          <div>
            <label
              className="text-[10px] font-bold block mb-0.5"
              style={{ color: 'var(--nv-mute)' }}
            >
              12주 큰 목표 (한 문장)
            </label>
            <textarea
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              rows={2}
              placeholder='예: B2C 신사업 안착 + 디자이너 인지도 30% 상승 + 매출 +20%'
              className="w-full px-2 py-1.5 text-[13px] bg-white outline-none resize-none"
              style={{
                border: '1px solid var(--nv-hairline)',
                borderRadius: '2px',
                color: 'var(--nv-body)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--nv-primary)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--nv-hairline)')}
            />
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--nv-stone)' }}>
              모두가 향하는 단 하나의 방향. 헤더에 큰 글씨로 표시됨.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className="text-[10px] font-bold block mb-0.5"
                style={{ color: 'var(--nv-mute)' }}
              >
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const v = e.target.value
                  setStartDate(v)
                  // 12주 사이클 — 시작일을 고르면 종료일을 12주 뒤(+84일 − 1일)로 자동 세팅
                  if (v) {
                    const d = new Date(v + 'T00:00:00')
                    d.setDate(d.getDate() + 12 * 7 - 1)
                    setEndDate(d.toLocaleDateString('sv-SE'))
                  }
                }}
                className="h-9 w-full px-2 text-[13px] bg-white outline-none"
                style={{
                  border: '1px solid var(--nv-hairline)',
                  borderRadius: '2px',
                  color: 'var(--nv-body)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--nv-primary)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--nv-hairline)')}
              />
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--nv-stone)' }}>
                ℹ 시작일을 고르면 종료일이 12주 뒤로 자동 설정 (수동 조정 가능) · 변경 시 모든 직원 KR 시작일 자동 이동
              </p>
            </div>
            <div>
              <label
                className="text-[10px] font-bold block mb-0.5"
                style={{ color: 'var(--nv-mute)' }}
              >
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-full px-2 text-[13px] bg-white outline-none"
                style={{
                  border: '1px solid var(--nv-hairline)',
                  borderRadius: '2px',
                  color: 'var(--nv-body)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--nv-primary)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--nv-hairline)')}
              />
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--nv-stone)' }}>
                보통 시작일 + 11주 후 금요일 (12주차 종료)
              </p>
            </div>
          </div>

          {error && (
            <div
              className="px-2 py-1 text-[11px]"
              style={{
                border: '1px solid var(--nv-error)',
                backgroundColor: '#fef2f2',
                color: 'var(--nv-error)',
                borderRadius: '2px',
              }}
            >
              ⚠ {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="h-8 px-3 text-[11px] font-bold bg-white inline-flex items-center gap-1 transition-colors"
              style={{
                border: '1px solid var(--nv-hairline)',
                borderRadius: '2px',
                color: 'var(--nv-ink)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--nv-ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--nv-hairline)')}
            >
              <X className="w-3 h-3" />
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-3 text-[11px] font-bold inline-flex items-center gap-1 disabled:opacity-50 transition-colors"
              style={{
                backgroundColor: 'var(--nv-primary)',
                color: '#000',
                borderRadius: '2px',
              }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = 'var(--nv-primary-dark)'
              }}
              onMouseLeave={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = 'var(--nv-primary)'
              }}
            >
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )}
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
