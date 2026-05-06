/**
 * WAM 자동 점수표 (Phase 9 #1)
 * 이번 주 자동 집계 점수표 — WAM 회의 시 즉시 사용
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
  Target,
  TrendingUp,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { calculateCycleProgress, daysUntilNextMonday } from '@/lib/v11-cycle'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()

    const today = new Date()
    const dow = today.getDay()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
    const weekStartStr = weekStart.toISOString().split('T')[0]

    const lastWeekStart = new Date(weekStart)
    lastWeekStart.setDate(weekStart.getDate() - 7)
    const lastWeekEnd = new Date(weekStart)
    lastWeekEnd.setDate(weekStart.getDate() - 1)

    const [cycle, goals, txWeek, txLastWeek, activities, lastWam] = await Promise.all([
      supabase
        .from('cycles')
        .select('*')
        .eq('status', 'active')
        .order('cycle_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('goals').select('*'),
      supabase
        .from('transactions')
        .select('total_amount, margin_amount')
        .gte('transaction_date', weekStartStr)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', lastWeekStart.toISOString().split('T')[0])
        .lte('transaction_date', lastWeekEnd.toISOString().split('T')[0])
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('sales_activities')
        .select('activity_type')
        .gte('activity_date', weekStartStr),
      supabase
        .from('weekly_action_meetings')
        .select('id, meeting_date, week_number')
        .order('meeting_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    return {
      cycle: cycle.data,
      goals: goals.data ?? [],
      weekRevenue: (txWeek.data ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0),
      weekMargin: (txWeek.data ?? []).reduce((s, t) => s + Number(t.margin_amount || 0), 0),
      lastWeekRevenue: (txLastWeek.data ?? []).reduce(
        (s, t) => s + Number(t.total_amount || 0),
        0,
      ),
      activities: activities.data ?? [],
      lastWam: lastWam.data,
      weekStartStr,
      errors: [
        cycle.error,
        goals.error,
        txWeek.error,
        txLastWeek.error,
        activities.error,
      ].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      cycle: null,
      goals: [],
      weekRevenue: 0,
      weekMargin: 0,
      lastWeekRevenue: 0,
      activities: [],
      lastWam: null,
      weekStartStr: '',
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    } as unknown as Loaded
  }
}
type Loaded = Awaited<ReturnType<typeof loadOk>>
async function loadOk() {
  return {
    cycle: null as null | { id: number; cycle_number: number; start_date: string; end_date: string },
    goals: [] as Array<{
      id: number
      title: string
      target_value: number | null
      current_value: number | null
      is_leading_indicator: boolean
    }>,
    weekRevenue: 0,
    weekMargin: 0,
    lastWeekRevenue: 0,
    activities: [] as Array<{ activity_type: string }>,
    lastWam: null as null | { id: number; meeting_date: string; week_number: number },
    weekStartStr: '',
    errors: [] as Array<{ message: string }>,
  }
}

export default async function WamScorecardPage() {
  const data = (await loadData()) as Loaded

  const wamDday = daysUntilNextMonday()
  const cycleProgress = data.cycle
    ? calculateCycleProgress(data.cycle.start_date, data.cycle.end_date)
    : null

  const meetings = data.activities.filter(
    (a) => a.activity_type === 'meeting' || a.activity_type === 'visit',
  ).length
  const samples = data.activities.filter((a) => a.activity_type === 'sample_send').length
  const calls = data.activities.filter((a) => a.activity_type === 'call').length

  const revenueDelta =
    data.lastWeekRevenue > 0
      ? ((data.weekRevenue - data.lastWeekRevenue) / data.lastWeekRevenue) * 100
      : null

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
            v1.1 · #1 WAM 자동 점수표
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">WAM 자동 점수표</h1>
        <p className="mt-1 text-sm text-slate-500">
          이번 주 (월~일) 자동 집계 — WAM 회의에 즉시 사용. 주간 회의록은 별도 작성.
        </p>
      </div>

      {data.errors.length > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>{data.errors[0].message}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* WAM D-day */}
      {wamDday <= 7 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3 flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-600" />
            <div className="text-sm text-blue-900">
              다음 WAM:{' '}
              <strong>
                {wamDday === 0 ? '오늘 (월요일)' : `D-${wamDday}`}
              </strong>
              {data.lastWam && (
                <span className="ml-2 text-[11px] text-blue-700">
                  · 마지막 WAM: Week {data.lastWam.week_number} ({data.lastWam.meeting_date})
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 사이클 정보 */}
      {cycleProgress && data.cycle && (
        <Card>
          <CardContent className="py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs text-slate-500">사이클 #{data.cycle.cycle_number}</span>
              <div className="font-semibold text-slate-800">
                Week {cycleProgress.weekNumber} / 12 · D-{cycleProgress.daysRemaining}
              </div>
            </div>
            <div className="text-xs text-slate-500">
              주 시작: {data.weekStartStr}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 이번 주 결과 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            이번 주 후행지표
          </CardTitle>
          <CardDescription>월요일~오늘까지 누적</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="이번 주 매출" value={formatKRW(data.weekRevenue)} delta={revenueDelta} />
            <Stat
              label="공헌이익"
              value={formatKRW(data.weekMargin)}
              hint={
                data.weekRevenue > 0
                  ? `마진 ${((data.weekMargin / data.weekRevenue) * 100).toFixed(1)}%`
                  : ''
              }
            />
            <Stat label="지난 주 매출" value={formatKRW(data.lastWeekRevenue)} hint="비교 기준" />
          </div>
        </CardContent>
      </Card>

      {/* 이번 주 활동 (선행지표) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-blue-500" />
            이번 주 선행지표
          </CardTitle>
          <CardDescription>활동량</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="미팅·방문" value={String(meetings)} />
            <Stat label="샘플 발송" value={String(samples)} />
            <Stat label="전화 연락" value={String(calls)} />
          </div>
        </CardContent>
      </Card>

      {/* 12주 목표 점수표 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">12주 목표 점수표 (자동 계산)</CardTitle>
          <CardDescription>
            현재 진행률 — WAM에서{' '}
            <Link href="/finance/wam" className="text-blue-600 hover:underline">
              회의록 작성
            </Link>{' '}
            시 이 값을 점수표에 기록
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.goals.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">목표 미설정</p>
          ) : (
            <div className="space-y-2">
              {data.goals.map((g) => {
                const target = Number(g.target_value) || 0
                const current = Number(g.current_value) || 0
                const ratio = target > 0 ? current / target : 0
                const passed = current >= target * 0.8
                const status = passed
                  ? 'on_track'
                  : ratio >= 0.5
                  ? 'at_risk'
                  : 'behind'
                return (
                  <div
                    key={g.id}
                    className={cn(
                      'rounded-md border p-2 flex items-center gap-3 text-xs',
                      status === 'on_track'
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : status === 'at_risk'
                        ? 'border-amber-200 bg-amber-50/30'
                        : 'border-rose-200 bg-rose-50/30',
                    )}
                  >
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-bold',
                        status === 'on_track'
                          ? 'bg-emerald-100 text-emerald-700'
                          : status === 'at_risk'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700',
                      )}
                    >
                      {status === 'on_track' ? '🟢 진행' : status === 'at_risk' ? '🟡 주의' : '🔴 지연'}
                    </span>
                    <span className="flex-1 truncate font-medium text-slate-700">
                      {g.title}
                    </span>
                    <span className="text-slate-600 tabular-nums">
                      {current.toLocaleString()} / {target.toLocaleString()} ({(ratio * 100).toFixed(0)}%)
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardContent className="py-3 text-xs text-slate-700">
          💡 이 페이지는 <strong>읽기 전용 자동 집계</strong>입니다. WAM 회의 시{' '}
          <Link href="/finance/wam" className="font-semibold text-blue-600 hover:underline">
            회의록 작성 페이지
          </Link>
          에서 실제 점수표·다음주 우선순위·블로커를 기록하세요.
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  delta,
  hint,
}: {
  label: string
  value: string
  delta?: number | null
  hint?: string
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      {delta != null && (
        <div
          className={cn(
            'text-[11px] font-semibold',
            delta >= 0 ? 'text-emerald-600' : 'text-rose-600',
          )}
        >
          {delta >= 0 ? '+' : ''}
          {delta.toFixed(0)}%
        </div>
      )}
      {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
    </div>
  )
}
