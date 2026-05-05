/**
 * 선·후행 지표 트래커 (Phase 8 #1 ③ + ⑦)
 * 12주 사이클 동안의 선행지표(활동) → 후행지표(결과) 흐름.
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  ChevronLeft,
  Activity,
  Trophy,
  Target,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { calculateCycleProgress } from '@/lib/v11-cycle'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()

    // 활성 사이클
    const { data: cycle } = await supabase
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!cycle) {
      return { cycle: null, errors: ['활성 사이클 없음'] }
    }

    const [txRes, activitiesRes, goalsRes, samplesRes, contentRes, prevCycleRes, snapshots] =
      await Promise.all([
        supabase
          .from('transactions')
          .select('client_id, total_amount, margin_amount, transaction_date')
          .gte('transaction_date', cycle.start_date)
          .lte('transaction_date', cycle.end_date)
          .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
        supabase
          .from('sales_activities')
          .select('activity_type, activity_date, value_generated, client_id'),
        supabase.from('goals').select('*').eq('cycle_id', cycle.id),
        supabase
          .from('sample_items')
          .select('status, request_id'),
        supabase
          .from('content_items')
          .select('id, channel, status, publish_date'),
        // 직전 사이클 비교
        supabase
          .from('cycles')
          .select('*')
          .lt('cycle_number', cycle.cycle_number)
          .order('cycle_number', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('cycle_weekly_snapshots')
          .select('*')
          .eq('cycle_id', cycle.id)
          .order('week_number'),
      ])

    return {
      cycle,
      transactions: txRes.data ?? [],
      activities: activitiesRes.data ?? [],
      goals: goalsRes.data ?? [],
      samples: samplesRes.data ?? [],
      content: contentRes.data ?? [],
      prevCycle: prevCycleRes.data,
      snapshots: snapshots.data ?? [],
      errors: [
        txRes.error,
        activitiesRes.error,
        goalsRes.error,
        samplesRes.error,
        contentRes.error,
      ].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      cycle: null,
      errors: [e instanceof Error ? e.message : String(e)],
    }
  }
}

export default async function IndicatorsPage() {
  const data = await loadData()

  if (!data.cycle) {
    return (
      <div className="space-y-4">
        <Link
          href="/finance/cycle"
          className="inline-flex items-center gap-1 text-xs text-slate-500"
        >
          <ChevronLeft className="h-3 w-3" />
          12주 대시보드
        </Link>
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-rose-900">
              <AlertCircle className="h-5 w-5" />
              활성 사이클이 없습니다
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const cycle = data.cycle
  const progress = calculateCycleProgress(cycle.start_date, cycle.end_date)

  // 사이클 기간 활동만 필터
  const cycleActivities = (data.activities ?? []).filter(
    (a) => a.activity_date >= cycle.start_date && a.activity_date <= cycle.end_date,
  )
  const cycleContent = (data.content ?? []).filter(
    (c) =>
      c.status === 'published' &&
      c.publish_date &&
      c.publish_date >= cycle.start_date &&
      c.publish_date <= cycle.end_date,
  )

  // === 후행지표 (결과) ===
  const totalRevenue = (data.transactions ?? []).reduce(
    (s, t) => s + Number(t.total_amount || 0),
    0,
  )
  const totalMargin = (data.transactions ?? []).reduce(
    (s, t) => s + Number(t.margin_amount || 0),
    0,
  )
  const activeClients = new Set(
    (data.transactions ?? []).map((t) => t.client_id).filter(Boolean) as number[],
  ).size

  // === 선행지표 (활동) ===
  const meetings = cycleActivities.filter(
    (a) => a.activity_type === 'meeting' || a.activity_type === 'visit',
  ).length
  const samples = cycleActivities.filter((a) => a.activity_type === 'sample_send').length
  const contacts = new Set(
    cycleActivities.map((a) => a.client_id).filter(Boolean) as number[],
  ).size
  const proposals = cycleActivities.filter((a) => a.activity_type === 'proposal_send').length
  const calls = cycleActivities.filter((a) => a.activity_type === 'call').length

  // === 12주 목표 진행 ===
  const goalsTotal = data.goals?.length ?? 0
  const goalsPassed = (data.goals ?? []).filter(
    (g) => g.target_value && Number(g.current_value || 0) >= Number(g.target_value) * 0.8,
  ).length
  const avgGoalProgress =
    goalsTotal > 0
      ? (data.goals ?? []).reduce((s, g) => {
          const t = Number(g.target_value) || 0
          if (t === 0) return s
          return s + Math.min(1, Number(g.current_value || 0) / t)
        }, 0) / goalsTotal
      : 0

  // 시간 진행 vs 목표 진행 (gap)
  const timeProgress = progress.totalProgress
  const gap = avgGoalProgress - timeProgress

  return (
    <div className="space-y-6">
      <Link
        href="/finance/cycle"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        12주 대시보드
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #1 ③ + ⑦ 선·후행 지표
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">선·후행 지표 트래커</h1>
        <p className="mt-1 text-sm text-slate-500">
          사이클 #{cycle.cycle_number} · Week {progress.weekNumber}/12 — 활동(선행) → 결과(후행)
          상관관계 추적
        </p>
      </div>

      {data.errors.length > 0 && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {data.errors.slice(0, 2).map((e, i) => (
            <div key={i}>{typeof e === 'string' ? e : e.message}</div>
          ))}
        </div>
      )}

      {/* 사이클 vs 목표 진행 격차 */}
      <Card
        className={cn(
          gap >= 0
            ? 'border-emerald-200 bg-emerald-50/30'
            : gap >= -0.1
            ? 'border-amber-200 bg-amber-50/30'
            : 'border-rose-200 bg-rose-50/30',
        )}
      >
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-slate-600">
                사이클 시간 진행 vs 평균 목표 진행률
              </div>
              <div className="mt-1 text-sm">
                시간:{' '}
                <strong className="tabular-nums text-slate-800">
                  {(timeProgress * 100).toFixed(0)}%
                </strong>
                {' · '}
                목표:{' '}
                <strong className="tabular-nums text-slate-800">
                  {(avgGoalProgress * 100).toFixed(0)}%
                </strong>
              </div>
            </div>
            <div className="text-right">
              <div
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  gap >= 0
                    ? 'text-emerald-700'
                    : gap >= -0.1
                    ? 'text-amber-700'
                    : 'text-rose-700',
                )}
              >
                {gap >= 0 ? '+' : ''}
                {(gap * 100).toFixed(0)}%p
              </div>
              <div className="text-[10px] text-slate-500">
                {gap >= 0
                  ? '목표 진행률 ≥ 시간 진행률 (양호)'
                  : gap >= -0.1
                  ? '약간 뒤처짐'
                  : '큰 격차 — 우선순위 재검토 필요'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 선행지표 (Lead) */}
      <Card className="border-blue-200 bg-blue-50/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            선행지표 (Lead) — 활동·행동량
          </CardTitle>
          <CardDescription>매주 챙기면 후행지표가 따라옴</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Indicator label="미팅·방문" value={meetings} />
            <Indicator label="샘플 발송" value={samples} />
            <Indicator label="컨택 거래처" value={contacts} />
            <Indicator label="제안서" value={proposals} />
            <Indicator label="전화 연락" value={calls} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Indicator label="콘텐츠 발행" value={cycleContent.length} subtext="모든 채널" />
            <Indicator
              label="인스타 발행"
              value={cycleContent.filter((c) => c.channel === 'instagram').length}
            />
            <Indicator
              label="블로그 발행"
              value={cycleContent.filter((c) => c.channel === 'blog').length}
            />
            <Indicator
              label="총 활동 시간"
              value={`${
                cycleActivities.reduce((s, a) => s + (Number((a as { duration_minutes?: number }).duration_minutes ?? 0)), 0) / 60 | 0
              }h`}
              subtext="approx"
            />
            <Indicator
              label="활동 발생 매출"
              value={formatKRW(
                cycleActivities.reduce((s, a) => s + Number(a.value_generated || 0), 0),
              )}
              isMoney
            />
          </div>
        </CardContent>
      </Card>

      {/* 후행지표 (Lag) */}
      <Card className="border-emerald-200 bg-emerald-50/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-emerald-600" />
            후행지표 (Lag) — 결과
          </CardTitle>
          <CardDescription>
            사이클 누적 — 선행지표가 잘 작동하면 자연히 따라옴
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicator label="누적 매출" value={formatKRW(totalRevenue)} isMoney tone="good" />
            <Indicator
              label="공헌이익"
              value={formatKRW(totalMargin)}
              isMoney
              subtext={
                totalRevenue > 0
                  ? `마진 ${((totalMargin / totalRevenue) * 100).toFixed(1)}%`
                  : '—'
              }
            />
            <Indicator label="활성 거래처" value={activeClients} />
            <Indicator
              label="샘플 전환"
              value={data.samples?.filter((s) => s.status === 'converted').length ?? 0}
              subtext={`/ ${data.samples?.length ?? 0} 발송`}
            />
          </div>
        </CardContent>
      </Card>

      {/* 12주 목표 매트릭스 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-amber-600" />
            12주 목표 매트릭스 ({goalsPassed} / {goalsTotal} 80% 통과)
          </CardTitle>
          <CardDescription>각 목표의 현재 진행 + 달성 페이스</CardDescription>
        </CardHeader>
        <CardContent>
          {goalsTotal === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              목표가 설정되지 않았습니다.{' '}
              <Link href="/finance/cycle" className="text-blue-600 hover:underline">
                12주 대시보드
              </Link>
              에서 추가하세요.
            </p>
          ) : (
            <div className="space-y-2">
              {(data.goals ?? []).map((g) => {
                const target = Number(g.target_value) || 0
                const current = Number(g.current_value) || 0
                const ratio = target > 0 ? current / target : 0
                const passed80 = current >= target * 0.8
                const onPace = ratio >= timeProgress
                return (
                  <div
                    key={g.id}
                    className={cn(
                      'rounded-md border p-3',
                      passed80
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : onPace
                        ? 'border-blue-200 bg-blue-50/20'
                        : 'border-amber-200 bg-amber-50/20',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{g.title}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                            {g.is_leading_indicator ? '선행' : '후행'}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                            {g.category}
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-sm font-bold tabular-nums',
                          passed80 ? 'text-emerald-700' : 'text-slate-700',
                        )}
                      >
                        {(ratio * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1.5 relative h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          'h-full',
                          passed80 ? 'bg-emerald-500' : onPace ? 'bg-blue-500' : 'bg-amber-500',
                        )}
                        style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                      />
                      {/* 시간 진행 마커 */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-slate-600/40"
                        style={{ left: `${timeProgress * 100}%` }}
                        title={`시간 진행 ${(timeProgress * 100).toFixed(0)}%`}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>
                        {current.toLocaleString()} / {target.toLocaleString()} {g.unit ?? ''}
                      </span>
                      <span>
                        {onPace ? '✓ 페이스 양호' : '⚠ 페이스 뒤처짐'} · 80% ={' '}
                        {(target * 0.8).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 직전 사이클 비교 */}
      {data.prevCycle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">직전 사이클 비교</CardTitle>
            <CardDescription>
              사이클 #{data.prevCycle.cycle_number} · {data.prevCycle.start_date} ~{' '}
              {data.prevCycle.end_date}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.prevCycle.what_worked && (
              <div className="mb-2 rounded-md border border-emerald-100 bg-emerald-50/40 p-2 text-xs">
                <strong className="text-emerald-700">잘 작동한 것:</strong>{' '}
                {data.prevCycle.what_worked}
              </div>
            )}
            {data.prevCycle.lessons_learned && (
              <div className="rounded-md border border-amber-100 bg-amber-50/40 p-2 text-xs">
                <strong className="text-amber-700">학습:</strong>{' '}
                {data.prevCycle.lessons_learned}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Indicator({
  label,
  value,
  subtext,
  isMoney = false,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  subtext?: string
  isMoney?: boolean
  tone?: 'good' | 'neutral'
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div
        className={cn(
          'mt-1 font-bold tabular-nums',
          isMoney ? 'text-base' : 'text-2xl',
          tone === 'good' ? 'text-emerald-700' : 'text-slate-900',
        )}
      >
        {value}
      </div>
      {subtext && <div className="text-[10px] text-slate-400">{subtext}</div>}
    </div>
  )
}
