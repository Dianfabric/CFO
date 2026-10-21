'use client'

/**
 * 사이클 전환 카드 — 활성 사이클의 종료일이 지났을 때 대시보드 최상단에 표시.
 *
 * 12주 시스템의 핵심은 사이클이 끊기지 않고 이어지는 것:
 *   ① 회고 작성 → ② 1장 요약 확인 → ③ 새 사이클 시작 (이월 선택)
 * ③은 /api/cycle/finalize 호출 (이전 사이클 completed 처리 + 새 사이클 생성 + KR 이월).
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Flag, NotebookPen, FileCheck2, Rocket, Loader2, ArrowRight } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface Props {
  cycleNumber: number
  endDate: string // YYYY-MM-DD
  daysSinceEnd: number
  visionStatement: string | null
  revenue: number
  margin: number
}

/** 다음 월요일 (오늘이 월요일이면 오늘) — 'YYYY-MM-DD' */
function nextMonday(): string {
  const d = new Date()
  const add = (8 - d.getDay()) % 7
  d.setDate(d.getDate() + add)
  return d.toLocaleDateString('sv-SE')
}

export default function CycleTransitionCard({
  cycleNumber,
  endDate,
  daysSinceEnd,
  visionStatement,
  revenue,
  margin,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [startDate, setStartDate] = useState(nextMonday())
  const [vision, setVision] = useState(visionStatement ?? '')
  const [carryover, setCarryover] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleStart = () => {
    if (
      !confirm(
        `사이클 #${cycleNumber}을 종료하고 ${startDate}부터 새 12주 사이클 #${cycleNumber + 1}을 시작합니다.` +
          (carryover ? '\n미완료 KR은 새 사이클로 이월됩니다.' : '\nKR 이월 없이 빈 사이클로 시작합니다.') +
          '\n계속할까요?',
      )
    )
      return
    setError(null)
    startTransition(async () => {
      try {
        const r = await fetch('/api/cycle/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_date: startDate,
            vision_statement: vision.trim() || null,
            carryover_unfinished: carryover,
          }),
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? `${r.status}`)
        // 요약 캐시 제거 — 새 사이클 데이터로 다시 로드되도록
        try {
          sessionStorage.removeItem('dian:dashboard-summary')
          sessionStorage.removeItem('dian:kpis')
        } catch { /* ignore */ }
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '사이클 전환 실패')
      }
    })
  }

  return (
    <div
      className="bg-white"
      style={{ border: '2px solid var(--nv-primary)', borderRadius: '2px' }}
    >
      {/* 헤더 */}
      <div className="p-4 sm:p-5 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Flag className="w-4 h-4 shrink-0" style={{ color: 'var(--nv-primary)' }} />
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--nv-ink)' }}>
            사이클 #{cycleNumber} 종료 — 다음 12주를 시작하세요
          </h2>
          <span className="text-[11.5px]" style={{ color: 'var(--nv-stone)' }}>
            {endDate} 종료 · D+{daysSinceEnd}일 경과
          </span>
        </div>

        {/* 지난 사이클 스냅샷 */}
        <div className="mt-2 flex items-center gap-4 flex-wrap text-[12px]" style={{ color: 'var(--nv-mute)' }}>
          <span>
            누적 매출 <strong className="tabular-nums" style={{ color: 'var(--nv-ink)' }}>{formatKRW(revenue)}</strong>
          </span>
          <span>
            공헌이익 <strong className="tabular-nums" style={{ color: 'var(--nv-ink)' }}>{formatKRW(margin)}</strong>
          </span>
          {visionStatement && (
            <span className="truncate max-w-full">
              큰 목표였던 것: <em>{visionStatement}</em>
            </span>
          )}
        </div>
      </div>

      {/* 3단계 */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-px"
        style={{ backgroundColor: 'var(--nv-hairline)', borderTop: '1px solid var(--nv-hairline)' }}
      >
        {/* ① 회고 */}
        <Link
          href="/finance/cycle/retro"
          className="bg-white p-3 sm:p-4 flex items-start gap-2.5 transition-colors hover:bg-[var(--nv-surface-soft)] min-h-[44px]"
        >
          <NotebookPen className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--nv-mute)' }} />
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold" style={{ color: 'var(--nv-ink)' }}>
              ① 12주 회고 작성 <ArrowRight className="w-3 h-3 inline" />
            </p>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--nv-stone)' }}>
              잘된 것 / 안된 것 / 배운 것 — 10분이면 충분
            </p>
          </div>
        </Link>

        {/* ② 1장 요약 */}
        <Link
          href="/finance/cycle/summary"
          className="bg-white p-3 sm:p-4 flex items-start gap-2.5 transition-colors hover:bg-[var(--nv-surface-soft)] min-h-[44px]"
        >
          <FileCheck2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--nv-mute)' }} />
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold" style={{ color: 'var(--nv-ink)' }}>
              ② 1장 요약 확인 <ArrowRight className="w-3 h-3 inline" />
            </p>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--nv-stone)' }}>
              KR 점수표 + AI 분석으로 사이클 결과 정리
            </p>
          </div>
        </Link>

        {/* ③ 새 사이클 시작 */}
        <div className="bg-white p-3 sm:p-4">
          <div className="flex items-start gap-2.5">
            <Rocket className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--nv-primary)' }} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold" style={{ color: 'var(--nv-ink)' }}>
                ③ 새 사이클 #{cycleNumber + 1} 시작
              </p>
              <div className="mt-1.5 space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <label className="text-[11px]" style={{ color: 'var(--nv-mute)' }}>시작일</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 px-1.5 text-[12px] bg-white"
                    style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}
                  />
                </div>
                <input
                  value={vision}
                  onChange={(e) => setVision(e.target.value)}
                  placeholder="새 사이클 큰 목표 (한 문장)"
                  className="h-8 w-full px-1.5 text-[12px] bg-white"
                  style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}
                />
                <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer" style={{ color: 'var(--nv-mute)' }}>
                  <input
                    type="checkbox"
                    checked={carryover}
                    onChange={(e) => setCarryover(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#76b900]"
                  />
                  미완료 KR 이월 (달성분은 아카이브)
                </label>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={isPending || !startDate}
                  className="h-9 px-3 w-full text-[12.5px] font-bold active:scale-95 transition-transform disabled:opacity-50"
                  style={{ backgroundColor: 'var(--nv-primary)', color: '#000', borderRadius: '2px' }}
                >
                  {isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />전환 중...</>
                  ) : (
                    `사이클 #${cycleNumber} 종료 + #${cycleNumber + 1} 시작`
                  )}
                </button>
                {error && <p className="text-[11px]" style={{ color: 'var(--nv-error, #e52020)' }}>⚠ {error}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
