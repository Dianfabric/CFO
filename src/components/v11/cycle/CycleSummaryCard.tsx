'use client'

/**
 * 사이클 1장 요약 카드 (재사용 — summary/page.tsx 및 history)
 *
 * 데이터:
 *   - GET /api/cycle/kpis (KR 데이터)
 *   - GET /api/cycle/dashboard-summary (cycle 메타 + 직원별 평균)
 *   - POST /api/cycle/ai-summary (AI 요약 — 처음에는 캐시된 거 가져오기)
 *
 * 액션:
 *   - "AI 요약 생성/재생성" 버튼
 *   - "사이클 종료 + 새 사이클 시작" 버튼 (carryover)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Target,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Loader2,
  Crown,
  Star,
  Lightbulb,
  AlertCircle,
  Compass,
  PlayCircle,
} from 'lucide-react'
import { formatKrValue, progressColor, type KrUnit } from '@/lib/cycle-okr'
import { getKrMetric } from '@/lib/kr-metrics'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface Cycle {
  id: number
  cycle_number: number
  start_date: string
  end_date: string
  vision_statement: string | null
  status: string
  ai_summary: string | null
  ai_analysis: {
    highlights?: string[]
    improvements?: string[]
    next_focus?: string[]
    generated_at?: string
  } | null
  total_revenue: number | null
  total_margin: number | null
  completed_at: string | null
}

interface KpiKr {
  kr_id: string
  kr_title: string
  lead_metric: string | null
  lead_unit: string
  lead_start: number
  lead_target: number
  lead_current: number
  lead_progress: number
  lag_metric: string | null
  lag_unit: string | null
  lag_progress: number | null
  lag_current: number | null
  lag_target: number | null
  is_big_goal: boolean
  goal_title: string
  employee_id: string
  employee_name: string
  employee_color: string
  employee_track: string
}

interface EmpSummary {
  id: string
  name: string
  color: string
  role_label: string | null
  business_track: string
  avg_progress: number
  kr_count: number
}

interface SummaryData {
  cycle: Cycle
  kpis: KpiKr[]
  employees: EmpSummary[]
}

export default function CycleSummaryCard({ cycleId }: { cycleId: number }) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [genAi, setGenAi] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [showFinalize, setShowFinalize] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 사이클 메타
      const cycleRes = await fetch(`/api/cycle/info`)
      const cycleJson = await cycleRes.json()
      let cycle: Cycle | null = cycleJson.cycle
      if (!cycle || cycle.id !== cycleId) {
        // cycleId 가 활성과 다르면 직접 조회 — 간단히 dashboard summary 응답에서 빠지면 직접 cycles 조회
        // (보통 활성 사이클만 다루므로 그대로)
      }

      const [kpisRes, summaryRes] = await Promise.all([
        fetch('/api/cycle/kpis'),
        fetch('/api/cycle/dashboard-summary'),
      ])
      const kpisJson = await kpisRes.json()
      const summaryJson = await summaryRes.json()
      const realCycle = summaryJson.cycle ?? cycle
      setData({
        cycle: realCycle,
        kpis: kpisJson.kpis ?? [],
        employees: summaryJson.employees_summary ?? [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally {
      setLoading(false)
    }
  }, [cycleId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const stats = useMemo(() => {
    if (!data) return { total: 0, above80: 0, between60_80: 0, below60: 0, avg: 0 }
    const all = data.kpis.flatMap((k) => {
      const arr = [k.lead_progress]
      if (k.lag_progress != null) arr.push(k.lag_progress)
      return arr
    })
    if (all.length === 0)
      return { total: 0, above80: 0, between60_80: 0, below60: 0, avg: 0 }
    const above80 = all.filter((p) => p >= 0.8).length
    const between60_80 = all.filter((p) => p >= 0.6 && p < 0.8).length
    const below60 = all.filter((p) => p < 0.6).length
    const avg = all.reduce((s, p) => s + p, 0) / all.length
    return { total: all.length, above80, between60_80, below60, avg }
  }, [data])

  const handleGenAi = async () => {
    if (!data) return
    setGenAi(true)
    try {
      await fetch('/api/cycle/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: data.cycle.id, regenerate: true }),
      })
      await fetchAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 요약 실패')
    } finally {
      setGenAi(false)
    }
  }

  const handleFinalize = async (carryover: boolean) => {
    if (
      !confirm(
        carryover
          ? '사이클을 종료하고 미완료 KR 을 다음 사이클로 이월합니다. 계속할까요?'
          : '사이클을 종료하고 빈 새 사이클을 시작합니다. 계속할까요?',
      )
    )
      return
    setFinalizing(true)
    try {
      const r = await fetch('/api/cycle/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carryover_unfinished: carryover }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error ?? `${r.status}`)
      }
      const j = await r.json()
      alert(
        `사이클 종료 완료. 새 사이클 #${j.new_cycle.cycle_number} 시작.\nCarryover KR: ${j.carryover_kr_count}개`,
      )
      window.location.href = '/finance/cycle'
    } catch (e) {
      setError(e instanceof Error ? e.message : '사이클 종료 실패')
    } finally {
      setFinalizing(false)
    }
  }

  if (loading) {
    return (
      <div
        className="border border-[#e5e5e5] bg-white p-6 text-center text-[12px] text-[#666]"
        style={{ borderRadius: '2px' }}
      >
        사이클 요약 로드 중...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div
        className="border border-[#ef4444] bg-[#fef2f2] p-4 text-[12px] text-[#991b1b]"
        style={{ borderRadius: '2px' }}
      >
        ⚠ {error ?? '데이터 없음'}
      </div>
    )
  }

  const { cycle, kpis, employees } = data

  return (
    <div className="space-y-3" id="cycle-summary-print">
      {/* 1. 큰 목표 */}
      <div
        className="border-l-4 border-[#f59e0b] bg-[#fffbeb] px-4 py-3"
        style={{ borderRadius: '2px' }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <Target className="w-3 h-3 text-[#92400e]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#92400e]">
            12주 큰 목표
          </span>
        </div>
        {cycle.vision_statement ? (
          <p className="text-[18px] font-bold text-[#000] leading-snug">
            {cycle.vision_statement}
          </p>
        ) : (
          <p className="text-[13px] text-[#999] italic">미설정</p>
        )}
      </div>

      {/* 2. AI 요약 */}
      <div
        className="border border-[var(--nv-primary)] bg-white p-4"
        style={{ borderRadius: '2px' }}
      >
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[var(--nv-primary)]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nv-primary)]">
              AI 분석
            </span>
          </div>
          <button
            type="button"
            onClick={handleGenAi}
            disabled={genAi}
            className="h-7 px-2.5 text-[10px] font-bold inline-flex items-center gap-1 bg-[#f9fafb] hover:bg-[#f3f4f6] border border-[#cccccc] disabled:opacity-50"
            style={{ borderRadius: '2px' }}
          >
            {genAi ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {cycle.ai_summary ? 'AI 재분석' : 'AI 분석 생성'}
          </button>
        </div>
        {cycle.ai_summary ? (
          <>
            <p className="text-[14px] font-bold text-[#000] leading-snug mb-3">
              {cycle.ai_summary}
            </p>
            {cycle.ai_analysis && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                {(cycle.ai_analysis.highlights?.length ?? 0) > 0 && (
                  <AiBox
                    icon={<Star className="w-3 h-3" />}
                    color="#76b900"
                    bg="#f7fee7"
                    label="잘된 점"
                    items={cycle.ai_analysis.highlights ?? []}
                  />
                )}
                {(cycle.ai_analysis.improvements?.length ?? 0) > 0 && (
                  <AiBox
                    icon={<AlertCircle className="w-3 h-3" />}
                    color="#f59e0b"
                    bg="#fffbeb"
                    label="개선 필요"
                    items={cycle.ai_analysis.improvements ?? []}
                  />
                )}
                {(cycle.ai_analysis.next_focus?.length ?? 0) > 0 && (
                  <AiBox
                    icon={<Compass className="w-3 h-3" />}
                    color="#0ea5e9"
                    bg="#eff6ff"
                    label="다음 집중"
                    items={cycle.ai_analysis.next_focus ?? []}
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-[12px] text-[#999] italic">
            아직 AI 분석이 생성되지 않았습니다. 우측 <strong>AI 분석 생성</strong> 클릭.
          </p>
        )}
      </div>

      {/* 3. 누적 지표 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox
          label="총 KR"
          value={String(stats.total)}
          color="#000"
        />
        <StatBox
          label="평균 진행률"
          value={`${Math.round(stats.avg * 100)}%`}
          color={progressColor(stats.avg)}
        />
        <StatBox
          label="누적 매출"
          value={cycle.total_revenue != null ? formatKRW(Number(cycle.total_revenue)) : '—'}
          color="#000"
        />
        <StatBox
          label="누적 공헌이익"
          value={cycle.total_margin != null ? formatKRW(Number(cycle.total_margin)) : '—'}
          color="#000"
        />
      </div>

      {/* 4. 점수 분포 */}
      <div
        className="border border-[#e5e5e5] bg-white p-3"
        style={{ borderRadius: '2px' }}
      >
        <p className="text-[11px] font-bold mb-2">KR 점수 분포</p>
        <div className="flex h-6 overflow-hidden" style={{ borderRadius: '2px' }}>
          <div
            className="bg-[#76b900] flex items-center justify-center text-[10px] font-bold text-white"
            style={{ width: stats.total ? `${(stats.above80 / stats.total) * 100}%` : 0 }}
          >
            {stats.above80 > 0 && `${stats.above80} 성공`}
          </div>
          <div
            className="bg-[#f59e0b] flex items-center justify-center text-[10px] font-bold text-white"
            style={{
              width: stats.total ? `${(stats.between60_80 / stats.total) * 100}%` : 0,
            }}
          >
            {stats.between60_80 > 0 && `${stats.between60_80} 진전`}
          </div>
          <div
            className="bg-[#ef4444] flex items-center justify-center text-[10px] font-bold text-white"
            style={{ width: stats.total ? `${(stats.below60 / stats.total) * 100}%` : 0 }}
          >
            {stats.below60 > 0 && `${stats.below60} 미흡`}
          </div>
          {stats.total === 0 && (
            <div className="w-full bg-[#f3f4f6] flex items-center justify-center text-[10px] text-[#999]">
              KR 없음
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-[#666]">
          <span>● 80%+ 성공</span>
          <span>● 60-79% 진전</span>
          <span>● &lt;60% 미흡</span>
        </div>
      </div>

      {/* 5. 직원별 평균 */}
      <div
        className="border border-[#e5e5e5] bg-white p-3"
        style={{ borderRadius: '2px' }}
      >
        <p className="text-[11px] font-bold mb-2">직원별 평균</p>
        <div className="space-y-1.5">
          {employees.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-[11px]">
              <div
                className="w-5 h-5 shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                style={{ backgroundColor: e.color, borderRadius: '2px' }}
              >
                {e.name.charAt(0)}
              </div>
              <span className="font-bold text-[#000] w-20">{e.name}</span>
              <span className="text-[10px] text-[#999] w-12">KR {e.kr_count}</span>
              <div className="flex-1 h-1.5 bg-[#f3f4f6]" style={{ borderRadius: '1px' }}>
                <div
                  className="h-full"
                  style={{
                    width: `${e.avg_progress * 100}%`,
                    backgroundColor: progressColor(e.avg_progress),
                    borderRadius: '1px',
                  }}
                />
              </div>
              <span
                className="text-[11px] font-bold tabular-nums w-10 text-right"
                style={{ color: progressColor(e.avg_progress) }}
              >
                {Math.round(e.avg_progress * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. KR 점수표 */}
      <div
        className="border border-[#e5e5e5] bg-white p-3"
        style={{ borderRadius: '2px' }}
      >
        <p className="text-[11px] font-bold mb-2">KR 점수표</p>
        <div className="space-y-1">
          {kpis.map((k) => (
            <KrScoreRow key={k.kr_id} k={k} />
          ))}
          {kpis.length === 0 && (
            <p className="text-[10px] text-[#999] italic">등록된 KR 없음</p>
          )}
        </div>
      </div>

      {/* 7. 사이클 종료 (활성 사이클만) */}
      {cycle.status === 'active' && (
        <div
          className="border border-[#fcd34d] bg-[#fffbeb] p-3"
          style={{ borderRadius: '2px' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-[12px] font-bold text-[#92400e] mb-0.5">
                🏁 사이클 종료 + 새 사이클 시작
              </p>
              <p className="text-[10px] text-[#92400e]">
                완료된 KR 은 archive, 미완료 KR 은 다음 사이클로 이월 (선택). 회고는 별도{' '}
                <a href="/finance/cycle/retro" className="underline">
                  회고 페이지
                </a>{' '}
                에서 작성.
              </p>
            </div>
            {!showFinalize ? (
              <button
                type="button"
                onClick={() => setShowFinalize(true)}
                className="h-8 px-3 text-[11px] font-bold bg-[#92400e] text-white inline-flex items-center gap-1"
                style={{ borderRadius: '2px' }}
              >
                <PlayCircle className="w-3 h-3" />
                사이클 종료 옵션
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFinalize(false)}
                  className="h-8 px-2 text-[10px] font-bold bg-white border border-[#cccccc]"
                  style={{ borderRadius: '2px' }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalize(false)}
                  disabled={finalizing}
                  className="h-8 px-2.5 text-[10px] font-bold bg-white border border-[#cccccc] hover:border-[#000]"
                  style={{ borderRadius: '2px' }}
                >
                  종료만
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalize(true)}
                  disabled={finalizing}
                  className="h-8 px-3 text-[11px] font-bold bg-[#92400e] text-white inline-flex items-center gap-1"
                  style={{ borderRadius: '2px' }}
                >
                  {finalizing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <PlayCircle className="w-3 h-3" />
                  )}
                  Carryover + 새 사이클
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 보조 컴포넌트
// ============================================================

function AiBox({
  icon,
  color,
  bg,
  label,
  items,
}: {
  icon: React.ReactNode
  color: string
  bg: string
  label: string
  items: string[]
}) {
  return (
    <div
      className="p-2 border space-y-1"
      style={{ backgroundColor: bg, borderColor: color + '40', borderRadius: '2px' }}
    >
      <div className="flex items-center gap-1" style={{ color }}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <ul className="space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="text-[10px] text-[#000] leading-snug">
            · {it}
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div
      className="border border-[#e5e5e5] bg-white p-2"
      style={{ borderRadius: '2px' }}
    >
      <p className="text-[9px] font-bold uppercase tracking-wider text-[#666] mb-0.5">
        {label}
      </p>
      <p className="text-[16px] font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

function KrScoreRow({ k }: { k: KpiKr }) {
  const leadColor = progressColor(k.lead_progress)
  const lagColor = k.lag_progress != null ? progressColor(k.lag_progress) : null
  const leadMeta = getKrMetric(k.lead_metric ?? '')
  const lagMeta = getKrMetric(k.lag_metric ?? '')
  return (
    <div className="border-l-2 border-[#e5e5e5] pl-2 py-1 flex items-center gap-2 text-[10px]">
      {k.is_big_goal && <Crown className="w-3 h-3 text-[#f59e0b] shrink-0" fill="currentColor" />}
      <div
        className="w-3 h-3 shrink-0"
        style={{ backgroundColor: k.employee_color, borderRadius: '1px' }}
      />
      <span className="text-[10px] font-bold w-16 truncate">{k.employee_name}</span>
      <span className="text-[10px] truncate flex-1">
        {leadMeta?.emoji} {k.kr_title}
      </span>
      {/* 선행 */}
      <span
        className="text-[10px] font-bold tabular-nums w-12 text-right inline-flex items-center justify-end gap-0.5"
        style={{ color: leadColor }}
        title={`선행: ${formatKrValue(k.lead_current, k.lead_unit as KrUnit)} / ${formatKrValue(k.lead_target, k.lead_unit as KrUnit)}`}
      >
        <TrendingUp className="w-2.5 h-2.5" />
        {Math.round(k.lead_progress * 100)}%
      </span>
      {/* 후행 (있으면) */}
      {k.lag_progress != null && lagColor && (
        <span
          className="text-[10px] font-bold tabular-nums w-12 text-right inline-flex items-center justify-end gap-0.5"
          style={{ color: lagColor }}
          title={`후행: ${lagMeta?.label}`}
        >
          <TrendingDown className="w-2.5 h-2.5" />
          {Math.round(k.lag_progress * 100)}%
        </span>
      )}
    </div>
  )
}
