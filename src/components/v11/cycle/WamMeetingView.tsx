'use client'

/**
 * WAM 회의용 풀 페이지 뷰 — 개인별 분석 + 전사 진행도 시각화 (한 페이지)
 *
 * 구성:
 *   1) 상단 hero — 사이클 비전 + 이번 주 회사 포커스 + 회사 평균 진행 게이지
 *   2) 전사 빅 목표 진행률 차트 (직원별 비교 막대)
 *   3) 개인별 분석 카드 그리드 (8명, 발표·토론용)
 *      · 빅 목표 + 12주 근접도 게이지
 *      · ✓ 지난 주 한 일
 *      · ! 개선 필요
 *      · → 이번 주 할 일
 *   4) 하단 종합 — 잘된 점 / 우려 / 이번 주 한 방향
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Sparkles,
  RefreshCw,
  Loader2,
  Target,
  Star,
  AlertCircle,
  Compass,
  CheckCircle2,
  ArrowRight,
  Maximize2,
  Minimize2,
  TrendingUp,
  MessageSquare,
  Check,
} from 'lucide-react'
import { progressColor } from '@/lib/cycle-okr'
import { cn } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'

interface PerPersonAi {
  last_week_done?: string[]
  needs_improvement?: string[]
  this_week_plan?: string[]
  progress_pct?: number // 0~100, 12주 빅 목표 근접도
  one_liner?: string
  risk?: 'green' | 'yellow' | 'red'
}

interface EmpWeekData {
  name: string
  role: string | null
  track: string
  prev_week_todo_total: number
  prev_week_todo_done: number
  prev_week_kr_progress: Array<{
    kr_title: string
    metric: string
    unit: string
    target: number
    actual: number
    progress: number
  }>
  prev_week_note: string | null
  this_week_todo_total: number
  this_week_todos: string[]
  this_week_note: string | null
  big_goal: string | null
  avg_progress: number
  ai_per_person?: PerPersonAi
  color?: string
}

interface Wam {
  id: number
  cycle_id: number
  week_number: number
  meeting_date: string
  ai_summary: string | null
  ai_analysis: {
    highlights?: string[]
    concerns?: string[]
    this_week_focus?: string
    company_overall?: string // 회사 전체 한 줄 종합
  } | null
  previous_week_data: { employees: EmpWeekData[]; week: number } | null
  next_week_plan: {
    recommendations: Array<{ employee: string; action: string }>
    week: number
  } | null
  generated_at: string | null
  generated_by: string | null
}

interface CycleInfo {
  id: number
  start_date: string
  end_date: string
  vision_statement?: string | null
  cycle_number?: number
}

interface ApiResponse {
  wam: Wam | null
  cycle: CycleInfo | null
  this_week: number
}

interface WamSuggestion {
  id: number
  title: string
  status: 'open' | 'resolved'
  week_number_created: number
  employees?: { name?: string; color?: string } | null
}

interface WamOneOnOne {
  id: number
  meeting_date: string
  meeting_time: string | null
  notes: string | null
  status: 'pending' | 'done' | 'cancelled'
  requester?: { name?: string; color?: string } | null
  target?: { name?: string; color?: string } | null
}

export default function WamMeetingView() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bigScreen, setBigScreen] = useState(false)
  const [suggestions, setSuggestions] = useState<WamSuggestion[]>([])
  const [oneOnOnes, setOneOnOnes] = useState<WamOneOnOne[]>([])

  const fetchWam = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/cycle/wam/generate')
      if (!r.ok) throw new Error(`${r.status}`)
      const j = await r.json()
      setData(j)
      if (j?.cycle?.id) {
        const [sr, oRes] = await Promise.all([
          fetch(`/api/cycle/suggestions?cycle_id=${j.cycle.id}&status=open`),
          fetch(`/api/cycle/one-on-ones?cycle_id=${j.cycle.id}&status=pending`),
        ])
        if (sr.ok) {
          const sj = await sr.json()
          setSuggestions(sj.suggestions ?? [])
        }
        if (oRes.ok) {
          const oj = await oRes.json()
          setOneOnOnes(oj.one_on_ones ?? [])
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  const resolveSuggestion = async (id: number) => {
    try {
      await fetch('/api/cycle/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'resolved' }),
      })
      setSuggestions((prev) => prev.filter((s) => s.id !== id))
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    fetchWam()
  }, [fetchWam])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const r = await fetch('/api/cycle/wam/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: true, triggered_by: 'manual' }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error ?? `${r.status}`)
      }
      await fetchWam()
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패')
    } finally {
      setGenerating(false)
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
        WAM 로드 중...
      </div>
    )
  }

  if (!data || !data.cycle) {
    return (
      <div
        className="p-4 text-[13px]"
        style={{
          border: '1px solid var(--nv-primary)',
          backgroundColor: 'var(--nv-accent-pale)',
          color: 'var(--nv-ink)',
          borderRadius: '2px',
        }}
      >
        활성 사이클이 없습니다. 12주 대시보드에서 사이클을 시작해주세요.
      </div>
    )
  }

  const wam = data.wam
  const thisWeek = data.this_week
  const prevWeek = Math.max(1, thisWeek - 1)
  const empData = wam?.previous_week_data?.employees ?? []
  const recommendations = wam?.next_week_plan?.recommendations ?? []

  // 회사 평균 진행률
  const companyAvg =
    empData.length > 0
      ? empData.reduce(
          (s, e) => s + (e.ai_per_person?.progress_pct ?? e.avg_progress * 100),
          0,
        ) / empData.length
      : 0

  // 사이클 진행률 (이번 주 / 12주)
  const cycleProgress = (thisWeek / 12) * 100

  // 차트 데이터 (직원별 빅 목표 진행률)
  const chartData = empData.map((e) => ({
    name: e.name,
    진행률: Math.round(e.ai_per_person?.progress_pct ?? e.avg_progress * 100),
    color: e.color ?? '#76b900',
  }))

  return (
    <div
      className={cn(
        bigScreen && 'fixed inset-0 z-50 overflow-auto p-6',
        'space-y-3',
      )}
      style={bigScreen ? { backgroundColor: '#ffffff' } : undefined}
    >
      {/* 상단 액션 바 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: 'var(--nv-mute)' }}
          >
            사이클 #{data.cycle.cycle_number ?? data.cycle.id} · W{thisWeek}/12
          </span>
          {wam?.generated_at && (
            <span className="text-[10px]" style={{ color: 'var(--nv-stone)' }}>
              · 생성 {new Date(wam.generated_at).toLocaleString('ko-KR')} ·{' '}
              {wam.generated_by === 'cron' ? '🤖 자동' : '✋ 수동'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBigScreen(!bigScreen)}
            className="h-8 px-2.5 text-[11px] font-bold inline-flex items-center gap-1 bg-white transition-colors"
            style={{
              border: '1px solid var(--nv-hairline)',
              borderRadius: '2px',
              color: 'var(--nv-ink)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--nv-ink)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--nv-hairline)')}
          >
            {bigScreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            {bigScreen ? '일반' : '회의실 모드'}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="h-8 px-3 text-[11px] font-bold inline-flex items-center gap-1 disabled:opacity-50 transition-colors"
            style={{
              backgroundColor: 'var(--nv-primary)',
              color: '#000',
              borderRadius: '2px',
            }}
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {wam ? 'AI 재분석' : 'AI 분석 생성'}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="p-3 text-[12px]"
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

      {!wam ? (
        <EmptyState prevWeek={prevWeek} thisWeek={thisWeek} />
      ) : (
        <>
          {/* ============================================================
              1) HERO — 사이클 비전 + 이번 주 포커스 + 평균 게이지
              ============================================================ */}
          <section
            className="p-5"
            style={{
              backgroundColor: 'var(--nv-surface-dark)',
              color: 'var(--nv-on-dark)',
              borderRadius: '2px',
            }}
          >
            <div className="flex items-start gap-6 flex-wrap">
              {/* 좌측: 사이클 비전 + 이번 주 회사 포커스 */}
              <div className="flex-1 min-w-[280px]">
                <div className="flex items-center gap-1.5 mb-2">
                  <span
                    className="inline-block w-2.5 h-2.5"
                    style={{ backgroundColor: 'var(--nv-primary)' }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--nv-primary)' }}
                  >
                    이번 주 W{thisWeek} · 모두가 한 방향
                  </span>
                </div>
                <p
                  className={cn(
                    'font-bold leading-snug mb-2',
                    bigScreen ? 'text-[32px]' : 'text-[22px]',
                  )}
                  style={{ letterSpacing: '-0.02em' }}
                >
                  {wam.ai_analysis?.this_week_focus ?? '이번 주 회사 포커스 미입력'}
                </p>
                {data.cycle.vision_statement && (
                  <p
                    className={cn(bigScreen ? 'text-[14px]' : 'text-[12px]')}
                    style={{ color: 'var(--nv-on-dark-mute)' }}
                  >
                    🎯 사이클 비전: {data.cycle.vision_statement}
                  </p>
                )}
              </div>

              {/* 우측: 사이클 진행 게이지 + 평균 진행률 */}
              <div className="flex items-center gap-6 shrink-0">
                <GaugeBlock
                  label="사이클 진행"
                  value={cycleProgress}
                  hint={`W${thisWeek}/12`}
                  size={bigScreen ? 90 : 72}
                  primary="#2997ff"
                />
                <GaugeBlock
                  label="회사 평균"
                  value={companyAvg}
                  hint={`${empData.length}명 평균`}
                  size={bigScreen ? 90 : 72}
                  primary={
                    companyAvg >= 80 ? '#76b900' : companyAvg >= 60 ? '#df6500' : '#e52020'
                  }
                />
              </div>
            </div>

            {/* 회사 종합 한 줄 (선택) */}
            {wam.ai_analysis?.company_overall && (
              <div
                className="mt-4 pt-4 text-[13px] leading-relaxed"
                style={{
                  borderTop: '1px solid var(--nv-hairline-strong)',
                  color: 'var(--nv-on-dark-mute)',
                }}
              >
                <Sparkles
                  className="w-3.5 h-3.5 inline mr-1"
                  style={{ color: 'var(--nv-primary)' }}
                />
                {wam.ai_analysis.company_overall}
              </div>
            )}
            {!wam.ai_analysis?.company_overall && wam.ai_summary && (
              <div
                className="mt-4 pt-4 text-[13px] leading-relaxed"
                style={{
                  borderTop: '1px solid var(--nv-hairline-strong)',
                  color: 'var(--nv-on-dark-mute)',
                }}
              >
                <Sparkles
                  className="w-3.5 h-3.5 inline mr-1"
                  style={{ color: 'var(--nv-primary)' }}
                />
                {wam.ai_summary}
              </div>
            )}
          </section>

          {/* ============================================================
              2) 전사 빅 목표 진행률 — 직원별 비교 차트
              ============================================================ */}
          <section
            className="bg-white p-4"
            style={{
              border: '1px solid var(--nv-hairline)',
              borderRadius: '2px',
            }}
          >
            <div className="flex items-center gap-1.5 mb-3">
              <span
                className="inline-block w-2.5 h-2.5"
                style={{ backgroundColor: 'var(--nv-primary)' }}
              />
              <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--nv-mute)' }} />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--nv-mute)' }}
              >
                전사 빅 목표 12주 근접도 — 직원별
              </span>
              <span className="text-[10px]" style={{ color: 'var(--nv-stone)' }}>
                · 80% 라인은 의미 있는 성과 기준
              </span>
            </div>
            <div style={{ width: '100%', height: bigScreen ? 220 : 160 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--nv-hairline)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'var(--nv-mute)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--nv-hairline)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--nv-mute)', fontSize: 10 }}
                    axisLine={{ stroke: 'var(--nv-hairline)' }}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--nv-surface-soft)' }}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--nv-ink)',
                      borderRadius: 2,
                      fontSize: 11,
                    }}
                    formatter={(v) => [`${v}%`, '12주 근접도']}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="var(--nv-primary)"
                    strokeDasharray="4 4"
                    label={{
                      value: '80% 기준선',
                      position: 'insideTopRight',
                      fill: 'var(--nv-primary)',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                  <Bar dataKey="진행률" radius={[2, 2, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.진행률 >= 80
                            ? '#76b900'
                            : d.진행률 >= 60
                              ? '#df6500'
                              : d.진행률 > 0
                                ? '#e52020'
                                : 'var(--nv-hairline)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ============================================================
              3) 개인별 분석 카드 그리드 — 발표·토론용 (핵심)
              ============================================================ */}
          <section
            className="bg-white p-4"
            style={{
              border: '1px solid var(--nv-hairline)',
              borderRadius: '2px',
            }}
          >
            <div className="flex items-center gap-1.5 mb-3">
              <span
                className="inline-block w-2.5 h-2.5"
                style={{ backgroundColor: 'var(--nv-primary)' }}
              />
              <Compass className="w-3.5 h-3.5" style={{ color: 'var(--nv-mute)' }} />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--nv-mute)' }}
              >
                개인별 AI 분석 — 한 명씩 발표 · 토론
              </span>
              <span className="text-[10px]" style={{ color: 'var(--nv-stone)' }}>
                · 회의실에서 한 카드씩 함께 봅니다
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {empData.map((emp, idx) => (
                <PersonAnalysisCard
                  key={emp.name}
                  emp={emp}
                  weekNumber={thisWeek}
                  bigScreen={bigScreen}
                  speakerOrder={idx + 1}
                  // recommendations 폴백
                  fallbackThisWeek={
                    recommendations.find((r) => r.employee === emp.name)?.action ?? null
                  }
                />
              ))}
            </div>
          </section>

          {/* ============================================================
              4) 종합 — 잘된 점 / 우려 사항 (회사 단위)
              ============================================================ */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {(wam.ai_analysis?.highlights?.length ?? 0) > 0 && (
              <AiSummaryBox
                icon={<Star className="w-3.5 h-3.5" />}
                color="#76b900"
                bg="#f3fbe1"
                label={`잘된 점 (${wam.ai_analysis?.highlights?.length ?? 0})`}
                items={wam.ai_analysis?.highlights ?? []}
                big={bigScreen}
              />
            )}
            {(wam.ai_analysis?.concerns?.length ?? 0) > 0 && (
              <AiSummaryBox
                icon={<AlertCircle className="w-3.5 h-3.5" />}
                color="#df6500"
                bg="#fff7ed"
                label={`우려 사항 (${wam.ai_analysis?.concerns?.length ?? 0})`}
                items={wam.ai_analysis?.concerns ?? []}
                big={bigScreen}
              />
            )}
          </section>

          {/* 💬 지난 주 직원들이 작성한 건의사항 — 이번 회의에서 토론·해결 */}
          {suggestions.length > 0 && (
            <section
              className="bg-white p-4"
              style={{
                border: '1px solid var(--nv-warning)',
                borderLeft: '4px solid var(--nv-warning)',
                borderRadius: '2px',
              }}
            >
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <MessageSquare
                  className="w-4 h-4"
                  style={{ color: 'var(--nv-warning)' }}
                />
                <span
                  className={cn(
                    'font-bold uppercase tracking-[0.14em]',
                    bigScreen ? 'text-[14px]' : 'text-[12px]',
                  )}
                  style={{ color: 'var(--nv-warning)' }}
                >
                  💬 지난 주 직원들이 작성한 건의사항 {suggestions.length}건 — 이번 회의 토론·해결
                </span>
                <span className="text-[11px]" style={{ color: 'var(--nv-mute)' }}>
                  · 직원별 OKR 페이지 → 주별 카드 → 금요일 아래 입력 칸에서 작성됨
                </span>
              </div>
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-3 px-3 py-2"
                    style={{
                      backgroundColor: '#fff7ed',
                      border: '1px solid var(--nv-hairline)',
                      borderRadius: '2px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => resolveSuggestion(s.id)}
                      className="w-5 h-5 mt-0.5 shrink-0 flex items-center justify-center transition-colors"
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--nv-hairline)',
                        borderRadius: '2px',
                      }}
                      title="해결 처리"
                    >
                      <Check
                        className="w-3 h-3 opacity-0 hover:opacity-100"
                        style={{ color: 'var(--nv-primary)' }}
                        strokeWidth={3}
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'leading-snug font-semibold',
                          bigScreen ? 'text-[15px]' : 'text-[13px]',
                        )}
                        style={{ color: 'var(--nv-ink)' }}
                      >
                        {s.title}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--nv-stone)' }}>
                        W{s.week_number_created} · {s.employees?.name ?? '익명'} 작성
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 🤝 다음 주 예정된 1:1 미팅 — 회의에서 공유 */}
          {oneOnOnes.length > 0 && (
            <section
              className="bg-white p-4"
              style={{
                border: '1px solid #a855f7',
                borderLeft: '4px solid #a855f7',
                borderRadius: '2px',
              }}
            >
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <span
                  className="inline-block w-1.5 h-1.5"
                  style={{ backgroundColor: '#a855f7' }}
                />
                <span
                  className={cn(
                    'font-bold uppercase tracking-[0.14em]',
                    bigScreen ? 'text-[14px]' : 'text-[12px]',
                  )}
                  style={{ color: '#7e22ce' }}
                >
                  🤝 1:1 미팅 예정 {oneOnOnes.length}건 — 이번 주 일정 공유
                </span>
                <span className="text-[11px]" style={{ color: 'var(--nv-mute)' }}>
                  · 직원들이 신청한 1:1 미팅 — 두 직원 일일 투두에 자동 등록됨
                </span>
              </div>
              <ul className="space-y-2">
                {oneOnOnes.map((m) => {
                  const timeStr = m.meeting_time ? m.meeting_time.slice(0, 5) : ''
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-2 flex-wrap"
                      style={{
                        backgroundColor: '#faf5ff',
                        border: '1px solid var(--nv-hairline)',
                        borderRadius: '2px',
                      }}
                    >
                      <span
                        className="shrink-0 text-[11px] font-bold tabular-nums px-2 py-1"
                        style={{
                          backgroundColor: '#a855f7',
                          color: '#ffffff',
                          borderRadius: '2px',
                        }}
                      >
                        {m.meeting_date.slice(5).replace('-', '/')}
                        {timeStr && ` ${timeStr}`}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 inline-flex items-center gap-1.5 font-bold',
                          bigScreen ? 'text-[14px]' : 'text-[13px]',
                        )}
                        style={{ color: m.requester?.color ?? 'var(--nv-ink)' }}
                      >
                        <span
                          className="inline-block w-2 h-2"
                          style={{
                            backgroundColor: m.requester?.color ?? '#a855f7',
                          }}
                        />
                        {m.requester?.name ?? '요청자'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" style={{ color: '#a855f7' }} />
                      <span
                        className={cn(
                          'shrink-0 inline-flex items-center gap-1.5 font-bold',
                          bigScreen ? 'text-[14px]' : 'text-[13px]',
                        )}
                        style={{ color: m.target?.color ?? 'var(--nv-ink)' }}
                      >
                        <span
                          className="inline-block w-2 h-2"
                          style={{ backgroundColor: m.target?.color ?? '#a855f7' }}
                        />
                        {m.target?.name ?? '대상'}
                      </span>
                      {m.notes && (
                        <span
                          className={cn(
                            'flex-1 min-w-[120px]',
                            bigScreen ? 'text-[13px]' : 'text-[12px]',
                          )}
                          style={{ color: 'var(--nv-body)' }}
                        >
                          — {m.notes}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* 발표 순서 안내 */}
          <section
            className="p-3 text-[11px] flex items-center gap-2"
            style={{
              backgroundColor: 'var(--nv-surface-soft)',
              border: '1px solid var(--nv-hairline)',
              borderRadius: '2px',
              color: 'var(--nv-mute)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--nv-primary)' }} />
            <span>
              <strong style={{ color: 'var(--nv-ink)' }}>발표 흐름:</strong>
              {' '}1️⃣ 회사 비전 + 이번 주 포커스 확인 → 2️⃣ 전사 진행률 차트로 회사 상태 점검 → 3️⃣ 직원별 카드 한 명씩 발표·토론 (지난주 한 일 → 개선 → 이번주 할 일) → 4️⃣ 잘된 점/우려 종합 → 5️⃣ 건의사항 토론·해결 체크 → 6️⃣ 1:1 미팅 일정 공유
            </span>
          </section>
        </>
      )}
    </div>
  )
}

// ============================================================
// 개인별 분석 카드 — WAM 의 핵심
// ============================================================
function PersonAnalysisCard({
  emp,
  weekNumber,
  bigScreen,
  speakerOrder,
  fallbackThisWeek,
}: {
  emp: EmpWeekData
  weekNumber: number
  bigScreen: boolean
  speakerOrder: number
  fallbackThisWeek: string | null
}) {
  const ai = emp.ai_per_person ?? {}
  const progressPct = ai.progress_pct ?? Math.round(emp.avg_progress * 100)
  const color = progressColor(progressPct / 100)
  const todoRate =
    emp.prev_week_todo_total > 0
      ? emp.prev_week_todo_done / emp.prev_week_todo_total
      : 0

  const lastWeekDone =
    ai.last_week_done && ai.last_week_done.length > 0
      ? ai.last_week_done
      : emp.prev_week_kr_progress.length > 0
        ? emp.prev_week_kr_progress.map(
            (k) => `${k.kr_title} (${Math.round(k.progress * 100)}%)`,
          )
        : []

  const needs = ai.needs_improvement ?? []

  const thisWeekPlan =
    ai.this_week_plan && ai.this_week_plan.length > 0
      ? ai.this_week_plan
      : emp.this_week_todos.length > 0
        ? emp.this_week_todos
        : fallbackThisWeek
          ? [fallbackThisWeek]
          : []

  const empColor = emp.color ?? '#76b900'

  // 1열 그리드 — 한 줄에 한 명씩 + 글자 키움. 가로 활용해 좌측 헤더/우측 3섹션 grid.
  return (
    <div
      className="bg-white"
      style={{
        border: '1px solid var(--nv-hairline)',
        borderLeft: `5px solid ${empColor}`,
        borderRadius: '2px',
      }}
    >
      {/* 상단 헤더 — 발표 순서 + 이름 + 12주 게이지 (큰 글씨) */}
      <div
        className="p-4 flex items-center gap-3 flex-wrap"
        style={{ borderBottom: '1px solid var(--nv-hairline)' }}
      >
        <span
          className="shrink-0 inline-flex items-center justify-center font-bold text-white"
          style={{
            width: bigScreen ? 48 : 40,
            height: bigScreen ? 48 : 40,
            backgroundColor: empColor,
            borderRadius: '2px',
            fontSize: bigScreen ? 22 : 18,
          }}
        >
          {speakerOrder}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={cn(
                'font-bold tracking-tight',
                bigScreen ? 'text-[24px]' : 'text-[20px]',
              )}
              style={{ color: 'var(--nv-ink)', letterSpacing: '-0.02em' }}
            >
              {emp.name}
            </span>
            {emp.role && (
              <span
                className={cn(bigScreen ? 'text-[15px]' : 'text-[13px]')}
                style={{ color: 'var(--nv-stone)' }}
              >
                {emp.role}
              </span>
            )}
            <span
              className={cn(
                'px-2 py-0.5 font-bold uppercase tracking-[0.1em] inline-flex items-center gap-1',
                bigScreen ? 'text-[11px]' : 'text-[10px]',
              )}
              style={{
                backgroundColor: 'var(--nv-surface-soft)',
                color: 'var(--nv-ink)',
                borderRadius: '2px',
              }}
            >
              {emp.track}
            </span>
          </div>
          {emp.big_goal && (
            <p
              className={cn('mt-1', bigScreen ? 'text-[15px]' : 'text-[14px]')}
              style={{ color: 'var(--nv-mute)' }}
            >
              🎯 <strong style={{ color: 'var(--nv-ink)' }}>{emp.big_goal}</strong>
            </p>
          )}
          {!emp.big_goal && (
            <p
              className={cn('mt-1 italic', bigScreen ? 'text-[15px]' : 'text-[13px]')}
              style={{ color: 'var(--nv-error)' }}
            >
              ⚠ 빅 목표 미설정
            </p>
          )}
        </div>
        {/* 진행률 + 게이지 바 (오른쪽) */}
        <div className="shrink-0 text-right">
          <div
            className={cn('font-bold tabular-nums leading-none', bigScreen ? 'text-[44px]' : 'text-[36px]')}
            style={{ color, letterSpacing: '-0.02em' }}
          >
            {progressPct}%
          </div>
          <div
            className="text-[11px] mt-1 tabular-nums"
            style={{ color: 'var(--nv-stone)' }}
          >
            12주 근접도 · W{weekNumber}/12
          </div>
          <div
            className="mt-1.5 w-[180px] h-2"
            style={{ backgroundColor: 'var(--nv-surface-soft)', borderRadius: '2px' }}
          >
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(100, progressPct)}%`,
                backgroundColor: color,
                borderRadius: '2px',
              }}
            />
          </div>
        </div>
      </div>

      {/* 한 줄 평 + 지난 주 투두 진행률 */}
      <div
        className="px-4 py-3 flex items-center gap-4 flex-wrap"
        style={{ borderBottom: '1px solid var(--nv-hairline)' }}
      >
        {ai.one_liner && (
          <p
            className={cn(
              'italic leading-snug flex-1 min-w-[200px]',
              bigScreen ? 'text-[16px]' : 'text-[14px]',
            )}
            style={{ color: 'var(--nv-body)' }}
          >
            “{ai.one_liner}”
          </p>
        )}
        <div
          className={cn(
            'tabular-nums shrink-0',
            bigScreen ? 'text-[14px]' : 'text-[12px]',
          )}
          style={{ color: 'var(--nv-mute)' }}
        >
          지난 주 투두{' '}
          <strong style={{ color: 'var(--nv-ink)' }}>
            {emp.prev_week_todo_done}/{emp.prev_week_todo_total}
          </strong>{' '}
          <strong
            style={{
              color:
                todoRate >= 0.8
                  ? '#76b900'
                  : todoRate >= 0.6
                    ? '#df6500'
                    : todoRate > 0
                      ? '#e52020'
                      : 'var(--nv-stone)',
            }}
          >
            ({Math.round(todoRate * 100)}%)
          </strong>
        </div>
      </div>

      {/* 3 섹션 가로 그리드 — 지난 일 / 개선 / 이번주 할 일 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-4">
        <SectionBlock
          icon={<CheckCircle2 className={bigScreen ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
          color="#76b900"
          label="지난 주 한 일"
          items={lastWeekDone}
          emptyText="기록 없음 (사이클 첫 주)"
          big={bigScreen}
        />
        <SectionBlock
          icon={<AlertCircle className={bigScreen ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
          color="#df6500"
          label="개선 필요"
          items={needs}
          emptyText="—"
          big={bigScreen}
        />
        <SectionBlock
          icon={<ArrowRight className={bigScreen ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
          color="var(--nv-primary)"
          label={`이번 주 W${weekNumber} 할 일`}
          items={thisWeekPlan}
          emptyText="할 일 미설정"
          big={bigScreen}
          highlight
        />
      </div>
    </div>
  )
}

// 한 섹션 블록 (이모지/아이콘 + 라벨 + 항목 리스트)
function SectionBlock({
  icon,
  color,
  label,
  items,
  emptyText,
  big,
  highlight = false,
}: {
  icon: React.ReactNode
  color: string
  label: string
  items: string[]
  emptyText: string
  big: boolean
  highlight?: boolean
}) {
  return (
    <div
      className="px-3 py-2 h-full"
      style={
        highlight
          ? {
              backgroundColor: 'var(--nv-accent-pale)',
              borderLeft: `4px solid ${color}`,
              borderTop: '1px solid var(--nv-hairline)',
              borderRight: '1px solid var(--nv-hairline)',
              borderBottom: '1px solid var(--nv-hairline)',
              borderRadius: '2px',
            }
          : {
              borderLeft: `4px solid ${color}`,
              borderTop: '1px solid var(--nv-hairline)',
              borderRight: '1px solid var(--nv-hairline)',
              borderBottom: '1px solid var(--nv-hairline)',
              backgroundColor: '#ffffff',
              borderRadius: '2px',
            }
      }
    >
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color }}>
        {icon}
        <span
          className={cn(
            'font-bold uppercase tracking-[0.14em]',
            big ? 'text-[13px]' : 'text-[12px]',
          )}
        >
          {label}
        </span>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li
              key={i}
              className={cn('leading-relaxed', big ? 'text-[15px]' : 'text-[14px]')}
              style={{ color: 'var(--nv-body)' }}
            >
              · {it}
            </li>
          ))}
        </ul>
      ) : (
        <p
          className={cn('italic', big ? 'text-[14px]' : 'text-[13px]')}
          style={{ color: 'var(--nv-stone)' }}
        >
          {emptyText}
        </p>
      )}
    </div>
  )
}

// ============================================================
// 게이지 블록 (사이클 진행, 회사 평균) — SVG 도넛
// ============================================================
function GaugeBlock({
  label,
  value,
  hint,
  size = 72,
  primary = '#76b900',
}: {
  label: string
  value: number
  hint: string
  size?: number
  primary?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  const stroke = 6
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={primary}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-bold tabular-nums"
            style={{ fontSize: size * 0.26, color: 'var(--nv-on-dark)' }}
          >
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <p
        className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ color: 'var(--nv-on-dark-mute)' }}
      >
        {label}
      </p>
      <p className="text-[9px]" style={{ color: 'var(--nv-on-dark-mute)' }}>
        {hint}
      </p>
    </div>
  )
}

// ============================================================
// AI 종합 박스 (잘된 점 / 우려)
// ============================================================
function AiSummaryBox({
  icon,
  color,
  bg,
  label,
  items,
  big,
}: {
  icon: React.ReactNode
  color: string
  bg: string
  label: string
  items: string[]
  big: boolean
}) {
  return (
    <div
      className={cn(big ? 'p-4' : 'p-3')}
      style={{
        backgroundColor: bg,
        borderLeft: `4px solid ${color}`,
        borderTop: '1px solid var(--nv-hairline)',
        borderRight: '1px solid var(--nv-hairline)',
        borderBottom: '1px solid var(--nv-hairline)',
        borderRadius: '2px',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2" style={{ color }}>
        <span
          className="inline-block w-1.5 h-1.5"
          style={{ backgroundColor: color }}
        />
        {icon}
        <span
          className={cn(
            'font-bold uppercase tracking-[0.14em]',
            big ? 'text-[13px]' : 'text-[11px]',
          )}
        >
          {label}
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li
            key={i}
            className={cn('leading-relaxed', big ? 'text-[14px]' : 'text-[12px]')}
            style={{ color: 'var(--nv-body)' }}
          >
            · {it}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ============================================================
// 빈 상태
// ============================================================
function EmptyState({ prevWeek, thisWeek }: { prevWeek: number; thisWeek: number }) {
  return (
    <div
      className="bg-white p-8 text-center"
      style={{
        border: '1px dashed var(--nv-hairline)',
        borderRadius: '2px',
      }}
    >
      <Sparkles
        className="w-8 h-8 mx-auto mb-3"
        style={{ color: 'var(--nv-hairline)' }}
      />
      <p
        className="text-[14px] font-bold mb-1"
        style={{ color: 'var(--nv-ink)' }}
      >
        이번 주 WAM 자료가 아직 생성되지 않았습니다
      </p>
      <p className="text-[12px] mb-4" style={{ color: 'var(--nv-mute)' }}>
        우측 상단 <strong>AI 분석 생성</strong> 버튼을 눌러 지난 주(W{prevWeek}) 결과 분석 + 이번 주(W{thisWeek}) 권장 액션을 자동 생성하세요.
        <br />
        매주 월요일 오전 8시에 자동 생성됩니다.
      </p>
    </div>
  )
}
