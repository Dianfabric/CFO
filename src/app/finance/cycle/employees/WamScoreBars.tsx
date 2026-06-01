'use client'

/**
 * 직원별 12주 WAM 점수 — 미니 막대 + 자기평가 1~5점 입력
 *
 * 산식: (투두 실행률 0.5 + KR 진행률 0.5) × 100  → base
 *      자기평가 1→0.8 ... 5→1.2 multiplier 적용
 *
 * 메인 대시보드 카드용 read-only 모드 (compact prop)
 * 직원 워크스페이스용 편집 가능 모드 (default)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Star, BarChart3 } from 'lucide-react'
import {
  calcWamScore,
  currentWeekNumber,
  type WamWeeklyScore,
} from '@/lib/cycle-okr'
import { cn } from '@/lib/utils'

interface Props {
  employeeId: string
  cycleStart: string
  cycleEnd: string
  /** true 면 read-only mini (대시보드용) */
  compact?: boolean
  onError?: (msg: string) => void
}

export default function WamScoreBars({
  employeeId,
  cycleStart,
  cycleEnd,
  compact = false,
  onError,
}: Props) {
  const [scores, setScores] = useState<WamWeeklyScore[]>([])
  const [loading, setLoading] = useState(true)
  const [editingWeek, setEditingWeek] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const currentWeek = useMemo(
    () => currentWeekNumber(cycleStart, cycleEnd),
    [cycleStart, cycleEnd],
  )

  const fetchScores = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/cycle/wam-scores?employee_id=${employeeId}`)
      if (!r.ok) throw new Error(`${r.status}`)
      const j = await r.json()
      setScores(j.scores ?? [])
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'WAM 점수 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [employeeId, onError])

  useEffect(() => {
    fetchScores()
  }, [fetchScores])

  const handleSetSelfScore = async (week: number, score: number) => {
    setSaving(true)
    try {
      const r = await fetch('/api/cycle/wam-scores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          week_number: week,
          self_score: score,
        }),
      })
      if (!r.ok) throw new Error(`${r.status}`)
      await fetchScores()
      setEditingWeek(null)
    } catch (e) {
      onError?.(e instanceof Error ? e.message : '자기평가 저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const sorted = useMemo(
    () => [...scores].sort((a, b) => a.week_number - b.week_number),
    [scores],
  )

  // 평균 (지나간 주 + 현재 주만)
  const stats = useMemo(() => {
    const pastWeeks = sorted.filter((s) => s.week_number <= Math.max(1, currentWeek))
    const finals = pastWeeks.map((s) => calcWamScore(s).final)
    const validFinals = finals.filter((f) => f > 0)
    const avg =
      validFinals.length > 0
        ? validFinals.reduce((a, b) => a + b, 0) / validFinals.length
        : 0
    return { avg, count: validFinals.length }
  }, [sorted, currentWeek])

  if (loading) {
    return (
      <div className="text-[10px] text-[#666] flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        WAM 점수 로드 중...
      </div>
    )
  }

  return (
    <div className={cn('space-y-1.5', compact ? '' : 'mt-2')}>
      {/* 헤더 */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#666]" />
            <span className="text-[11px] font-bold tracking-tight text-[#000]">
              WAM 12주 점수표
            </span>
            <span className="text-[10px] text-[#999]">
              · 평균 {Math.round(stats.avg)}점 ({stats.count}주)
            </span>
          </div>
        </div>
      )}

      {/* 12주 막대 */}
      <div className="flex items-end gap-[3px] h-12">
        {sorted.map((s) => {
          const calc = calcWamScore(s)
          const score = calc.final
          const isPast = s.week_number < currentWeek
          const isNow = s.week_number === currentWeek
          const isFuture = s.week_number > currentWeek

          // 높이 비율 (0~100 기준, 120 까지 가능)
          const heightPct = Math.max(2, Math.min(100, score))

          let color = '#e5e5e5'
          if (score >= 80) color = '#76b900'
          else if (score >= 60) color = '#f59e0b'
          else if (score > 0) color = '#ef4444'

          return (
            <button
              key={s.week_number}
              type="button"
              onClick={() => {
                if (compact) return
                if (isFuture) return
                setEditingWeek(editingWeek === s.week_number ? null : s.week_number)
              }}
              disabled={compact || isFuture}
              className={cn(
                'flex-1 flex flex-col items-center justify-end relative group',
                !compact && !isFuture && 'cursor-pointer',
              )}
              style={{ minWidth: '14px' }}
              title={
                isFuture
                  ? `W${s.week_number} — 아직`
                  : `W${s.week_number}: ${Math.round(score)}점${s.self_score ? ` (자기 ${s.self_score}★)` : ''}\n투두 ${s.week_done}/${s.week_total} · KR ${Math.round(calc.krRate * 100)}%`
              }
            >
              {/* 막대 */}
              <div
                className={cn(
                  'w-full transition-all',
                  isNow && 'ring-1 ring-[#000]',
                )}
                style={{
                  height: isFuture ? '4px' : `${heightPct}%`,
                  backgroundColor: isFuture ? '#f3f4f6' : color,
                  borderRadius: '1px',
                }}
              />
              {/* 자기평가 별 */}
              {s.self_score && !compact && (
                <span
                  className="absolute top-0 text-[7px] font-bold"
                  style={{ color: '#f59e0b' }}
                >
                  {s.self_score}★
                </span>
              )}
              {/* 주차 라벨 */}
              <span
                className={cn(
                  'text-[8px] mt-0.5',
                  isNow ? 'font-bold text-[#000]' : 'text-[#999]',
                )}
              >
                {s.week_number}
              </span>
            </button>
          )
        })}
      </div>

      {/* 자기평가 입력 (편집 모드만) */}
      {!compact && editingWeek && (
        <div
          className="border border-[#f59e0b] bg-[#fffbeb] p-2 flex items-center gap-2 text-[11px]"
          style={{ borderRadius: '2px' }}
        >
          <span className="font-bold text-[#92400e]">W{editingWeek} 자기평가:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleSetSelfScore(editingWeek, n)}
              disabled={saving}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-[#fef3c7] transition-colors"
              style={{ borderRadius: '2px' }}
              title={
                n === 1
                  ? '아쉬움 (×0.8)'
                  : n === 2
                    ? '보통 (×0.9)'
                    : n === 3
                      ? '평균 (×1.0)'
                      : n === 4
                        ? '잘함 (×1.1)'
                        : '최고 (×1.2)'
              }
            >
              <Star
                className={cn(
                  'w-3 h-3',
                  scores.find((s) => s.week_number === editingWeek)?.self_score === n
                    ? 'text-[#f59e0b]'
                    : 'text-[#cccccc]',
                )}
                fill={
                  scores.find((s) => s.week_number === editingWeek)?.self_score === n
                    ? 'currentColor'
                    : 'none'
                }
              />
              <span>{n}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEditingWeek(null)}
            className="ml-auto text-[10px] text-[#666] hover:text-[#000]"
          >
            취소
          </button>
        </div>
      )}

      {/* 사용 팁 (편집 모드만) */}
      {!compact && !editingWeek && (
        <p className="text-[9px] text-[#999]">
          막대 클릭 → 자기평가 1~5점 입력 · 자동 점수 = 투두실행률 50% + KR진행률 50%
        </p>
      )}
    </div>
  )
}
