'use client'

/**
 * KR 의 12주 분 주간 타겟 — 인라인 편집 (target / actual)
 *
 * 가로 12 cell 그리드 — 모바일에선 가로 스크롤 허용.
 * 현재 주 표시 (cycleStart 기준).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import {
  currentWeekNumber,
  formatKrValue,
  type KrUnit,
  type WeeklyTarget,
} from '@/lib/cycle-okr'
import { cn } from '@/lib/utils'

interface Props {
  keyResultId: string
  unit: KrUnit
  cycleStart: string
  cycleEnd: string
  onError: (msg: string) => void
  /** actual 값 변경 시 호출 (KR.current_value 가 서버에서 업데이트되므로 부모가 refresh) */
  onActualChanged: () => Promise<void>
}

export default function WeeklyTargetGrid({
  keyResultId,
  unit,
  cycleStart,
  cycleEnd,
  onError,
  onActualChanged,
}: Props) {
  const [weeks, setWeeks] = useState<WeeklyTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState<{
    week: number
    type: 'target' | 'actual'
  } | null>(null)
  const [pendingValue, setPendingValue] = useState('')
  const [saving, setSaving] = useState(false)

  const currentWeek = useMemo(
    () => currentWeekNumber(cycleStart, cycleEnd),
    [cycleStart, cycleEnd],
  )

  const fetchWeeks = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/cycle/weekly-targets?key_result_id=${keyResultId}`)
      if (!r.ok) throw new Error(`${r.status}`)
      const j = await r.json()
      setWeeks(j.weekly_targets ?? [])
    } catch (e) {
      onError(e instanceof Error ? e.message : '주간 타겟 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [keyResultId, onError])

  useEffect(() => {
    fetchWeeks()
  }, [fetchWeeks])

  const handleSave = async (
    weekNumber: number,
    type: 'target' | 'actual',
    value: string,
  ) => {
    const num = Number(value)
    if (Number.isNaN(num)) {
      onError('숫자만 입력 가능합니다.')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        key_result_id: keyResultId,
        week_number: weekNumber,
      }
      if (type === 'target') body.target_value = num
      else body.actual_value = num

      const r = await fetch('/api/cycle/weekly-targets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error ?? `${r.status}`)
      }
      await fetchWeeks()
      if (type === 'actual') await onActualChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
      setEditingCell(null)
      setPendingValue('')
    }
  }

  const startEdit = (week: number, type: 'target' | 'actual', current: number) => {
    setEditingCell({ week, type })
    setPendingValue(String(current ?? 0))
  }

  if (loading) {
    return (
      <div className="text-[11px] text-[#666] flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        주간 타겟 로드 중...
      </div>
    )
  }

  // week 1~12 정렬
  const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number)
  // total
  const totalTarget = sortedWeeks.reduce((s, w) => s + Number(w.target_value ?? 0), 0)
  const totalActual = sortedWeeks.reduce((s, w) => s + Number(w.actual_value ?? 0), 0)
  const totalRate = totalTarget > 0 ? totalActual / totalTarget : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold tracking-tight text-[#000]">
          주간 타겟 (12주)
        </p>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-[#666]">
            누적 actual {formatKrValue(totalActual, unit)} / target {formatKrValue(totalTarget, unit)}
          </span>
          <span
            className={cn(
              'font-bold tabular-nums',
              totalRate >= 0.8 ? 'text-[#76b900]' : totalRate >= 0.6 ? 'text-[#f59e0b]' : 'text-[#ef4444]',
            )}
          >
            {Math.round(totalRate * 100)}%
          </span>
          <button
            onClick={fetchWeeks}
            disabled={saving}
            className="h-5 w-5 inline-flex items-center justify-center text-[#666] hover:bg-[#f7f7f7]"
            style={{ borderRadius: '2px' }}
            title="새로고침"
          >
            <RefreshCw className={cn('w-3 h-3', saving && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* 가로 스크롤 가능 그리드 */}
      <div className="overflow-x-auto pb-1 -mx-3 px-3">
        <div className="inline-flex gap-1 min-w-full">
          {sortedWeeks.map((w) => {
            const target = Number(w.target_value ?? 0)
            const actual = Number(w.actual_value ?? 0)
            const rate = target > 0 ? actual / target : 0
            const isCurrent = w.week_number === currentWeek
            const isPast = w.week_number < currentWeek
            const isFuture = w.week_number > currentWeek

            const cellColor =
              !isPast && !isCurrent
                ? '#e5e5e5'
                : rate >= 0.8
                  ? '#76b900'
                  : rate >= 0.6
                    ? '#f59e0b'
                    : actual > 0
                      ? '#ef4444'
                      : '#cccccc'

            return (
              <div
                key={w.week_number}
                className={cn(
                  'w-[68px] shrink-0 border bg-white',
                  isCurrent ? 'border-[#000] border-2' : 'border-[#e5e5e5]',
                )}
                style={{ borderRadius: '2px' }}
              >
                <div
                  className={cn(
                    'text-center text-[10px] font-bold py-0.5',
                    isCurrent ? 'bg-[#000] text-white' : 'bg-[#f9fafb] text-[#666]',
                  )}
                >
                  W{w.week_number}
                  {isCurrent && <span className="ml-0.5 text-[8px]">·NOW</span>}
                </div>

                {/* Target */}
                <button
                  onClick={() => startEdit(w.week_number, 'target', target)}
                  className="block w-full text-center py-1 text-[10px] hover:bg-[#f7f7f7] transition-colors border-b border-[#f0f0f0]"
                  disabled={saving}
                >
                  {editingCell?.week === w.week_number && editingCell?.type === 'target' ? (
                    <input
                      autoFocus
                      type="number"
                      value={pendingValue}
                      onChange={(e) => setPendingValue(e.target.value)}
                      onBlur={() => handleSave(w.week_number, 'target', pendingValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave(w.week_number, 'target', pendingValue)
                        if (e.key === 'Escape') {
                          setEditingCell(null)
                          setPendingValue('')
                        }
                      }}
                      className="w-full text-center text-[10px] outline-none bg-[#fef9c3]"
                    />
                  ) : (
                    <>
                      <span className="text-[#999] text-[8px]">타겟</span>
                      <div className="font-bold tabular-nums text-[#666]">
                        {formatShort(target, unit)}
                      </div>
                    </>
                  )}
                </button>

                {/* Actual */}
                <button
                  onClick={() => startEdit(w.week_number, 'actual', actual)}
                  className={cn(
                    'block w-full text-center py-1 text-[10px] hover:bg-[#f7f7f7] transition-colors',
                    isFuture && 'opacity-50',
                  )}
                  disabled={saving}
                >
                  {editingCell?.week === w.week_number && editingCell?.type === 'actual' ? (
                    <input
                      autoFocus
                      type="number"
                      value={pendingValue}
                      onChange={(e) => setPendingValue(e.target.value)}
                      onBlur={() => handleSave(w.week_number, 'actual', pendingValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave(w.week_number, 'actual', pendingValue)
                        if (e.key === 'Escape') {
                          setEditingCell(null)
                          setPendingValue('')
                        }
                      }}
                      className="w-full text-center text-[10px] outline-none bg-[#dcfce7]"
                    />
                  ) : (
                    <>
                      <span className="text-[#999] text-[8px]">실적</span>
                      <div
                        className="font-bold tabular-nums"
                        style={{ color: cellColor }}
                      >
                        {actual > 0 ? formatShort(actual, unit) : '—'}
                      </div>
                    </>
                  )}
                </button>

                {/* 진행률 바 */}
                <div className="h-1 bg-[#f3f4f6]">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min(100, rate * 100)}%`,
                      backgroundColor: cellColor,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[10px] text-[#999]">
        타겟·실적 셀 클릭 후 숫자 입력 → Enter / blur 로 저장. Esc 로 취소.
      </p>
    </div>
  )
}

/** 짧은 포맷 (셀 안에 들어가도록) */
function formatShort(value: number, unit: KrUnit): string {
  if (unit === 'KRW') {
    if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`
    if (value >= 10_000) return `${Math.round(value / 10_000)}만`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
    return `${Math.round(value)}`
  }
  if (unit === 'percent') return `${value.toFixed(1)}%`
  if (unit === 'ratio') return `${value.toFixed(2)}x`
  if (unit === 'hours') return `${value.toFixed(1)}h`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return `${Math.round(value)}`
}
