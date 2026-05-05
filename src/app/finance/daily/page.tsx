/**
 * 일일 운영 대시보드 (Phase 1 ③, PRD #2c ①)
 *
 * 매일 아침 진입 화면. 30초 안에 회사 상태를 파악할 수 있게.
 * - 오늘 vs 어제 매출
 * - 이번 주 누적
 * - 긴급 미수금 (overdue 우선)
 * - 12주 사이클 위치
 * - Quick Actions
 *
 * 모닝 브리핑(#7 AI)과 다르게, 이 페이지는 100% 데이터 기반.
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  TrendingUp,
  AlertCircle,
  Upload,
  Plus,
  Clock,
  ArrowRight,
  Calendar,
  Receipt,
  Wallet,
  Users,
  Target,
  AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { calculateCycleProgress, daysUntilNextMonday } from '@/lib/v11-cycle'
import { formatKRW } from '@/lib/formatters'
import { CLIENT_TIER_COLOR, CLIENT_TIER_LABEL } from '@/lib/v11-labels'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek(d: Date): Date {
  const dow = d.getDay() // 0=Sun, 1=Mon
  const diff = dow === 0 ? -6 : 1 - dow
  const r = new Date(d)
  r.setDate(d.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '늦은 밤이네요'
  if (h < 11) return '좋은 아침입니다'
  if (h < 14) return '점심 잘 챙기세요'
  if (h < 18) return '오후 화이팅'
  return '하루 마무리 수고하셨습니다'
}

interface DailyOpsData {
  todayRevenue: number
  todayCount: number
  yesterdayRevenue: number
  yesterdayCount: number
  weekRevenue: number
  weekCount: number
  prevWeekRevenue: number
  monthRevenue: number
  totalOutstanding: number
  outstandingCount: number
  overdueAmount: number
  topOverdue: OverdueRow[]
  cycle: { id: number; cycle_number: number; start_date: string; end_date: string } | null
  goalProgress: number
  totalGoals: number
  passedGoals: number
  recentUploadDate: string | null
  errors: string[]
}

interface OverdueRow {
  client_id: number
  client_name: string
  tier: string | null
  transaction_id: number
  transaction_date: string
  outstanding: number
  days_overdue: number | null
  aging_bucket: string
}

async function loadData(): Promise<DailyOpsData> {
  const errors: string[] = []
  const today = new Date()
  const todayStr = toDateStr(today)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toDateStr(yesterday)
  const weekStart = toDateStr(startOfWeek(today))
  const prevWeekStart = toDateStr(new Date(startOfWeek(today).getTime() - 7 * 24 * 3600 * 1000))
  const prevWeekEnd = toDateStr(new Date(startOfWeek(today).getTime() - 1 * 24 * 3600 * 1000))
  const monthStart = toDateStr(startOfMonth(today))

  try {
    const supabase = await createClient()

    const [
      todayRes,
      yesterdayRes,
      weekRes,
      prevWeekRes,
      monthRes,
      outstandingRes,
      cycleRes,
      goalsRes,
      lastTxRes,
    ] = await Promise.all([
      supabase
        .from('transactions')
        .select('total_amount')
        .eq('transaction_date', todayStr)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('transactions')
        .select('total_amount')
        .eq('transaction_date', yesterdayStr)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', weekStart)
        .lte('transaction_date', todayStr)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', prevWeekStart)
        .lte('transaction_date', prevWeekEnd)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', todayStr)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase.from('outstanding_payments').select('*').limit(50),
      supabase
        .from('cycles')
        .select('id, cycle_number, start_date, end_date')
        .eq('status', 'active')
        .order('cycle_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('goals').select('current_value, target_value').not('target_value', 'is', null),
      supabase
        .from('transactions')
        .select('transaction_date')
        .order('transaction_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const todayRevenue = (todayRes.data ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )
    const yesterdayRevenue = (yesterdayRes.data ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )
    const weekRevenue = (weekRes.data ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )
    const prevWeekRevenue = (prevWeekRes.data ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )
    const monthRevenue = (monthRes.data ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )

    const outstanding = (outstandingRes.data ?? []) as OverdueRow[]
    const totalOutstanding = outstanding.reduce(
      (s, o) => s + Number(o.outstanding || 0),
      0,
    )
    const overdueAmount = outstanding
      .filter((o) => o.aging_bucket && o.aging_bucket.startsWith('overdue'))
      .reduce((s, o) => s + Number(o.outstanding || 0), 0)
    const topOverdue = outstanding
      .filter((o) => o.aging_bucket && o.aging_bucket.startsWith('overdue'))
      .sort((a, b) => (Number(b.days_overdue) || 0) - (Number(a.days_overdue) || 0))
      .slice(0, 5)

    const goals = goalsRes.data ?? []
    const totalGoals = goals.length
    const passedGoals = goals.filter(
      (g) =>
        g.target_value &&
        Number(g.current_value || 0) >= Number(g.target_value) * 0.8,
    ).length
    const goalProgress = totalGoals > 0
      ? goals.reduce((s, g) => {
          const t = Number(g.target_value) || 0
          if (t === 0) return s
          return s + Math.min(1, Number(g.current_value || 0) / t)
        }, 0) / totalGoals
      : 0

    if (todayRes.error) errors.push(todayRes.error.message)
    if (outstandingRes.error) errors.push(outstandingRes.error.message)

    return {
      todayRevenue,
      todayCount: (todayRes.data ?? []).length,
      yesterdayRevenue,
      yesterdayCount: (yesterdayRes.data ?? []).length,
      weekRevenue,
      weekCount: (weekRes.data ?? []).length,
      prevWeekRevenue,
      monthRevenue,
      totalOutstanding,
      outstandingCount: outstanding.length,
      overdueAmount,
      topOverdue,
      cycle: cycleRes.data,
      goalProgress,
      totalGoals,
      passedGoals,
      recentUploadDate: lastTxRes.data?.transaction_date ?? null,
      errors,
    }
  } catch (e) {
    return {
      todayRevenue: 0,
      todayCount: 0,
      yesterdayRevenue: 0,
      yesterdayCount: 0,
      weekRevenue: 0,
      weekCount: 0,
      prevWeekRevenue: 0,
      monthRevenue: 0,
      totalOutstanding: 0,
      outstandingCount: 0,
      overdueAmount: 0,
      topOverdue: [],
      cycle: null,
      goalProgress: 0,
      totalGoals: 0,
      passedGoals: 0,
      recentUploadDate: null,
      errors: [e instanceof Error ? e.message : String(e)],
    }
  }
}

const AGING_LABEL: Record<string, string> = {
  on_time: '정상',
  overdue_30: '~30일 연체',
  overdue_60: '30~60일 연체',
  overdue_90: '60~90일 연체',
  overdue_90_plus: '90일+ 연체',
  no_due_date: '기한 미설정',
}
const AGING_COLOR: Record<string, string> = {
  on_time: 'bg-emerald-100 text-emerald-700',
  overdue_30: 'bg-amber-100 text-amber-800',
  overdue_60: 'bg-orange-100 text-orange-800',
  overdue_90: 'bg-rose-100 text-rose-800',
  overdue_90_plus: 'bg-rose-200 text-rose-900',
  no_due_date: 'bg-slate-100 text-slate-600',
}

export default async function DailyOpsPage() {
  const data = await loadData()
  const today = new Date()
  const todayLabel = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const todayDelta =
    data.yesterdayRevenue > 0
      ? ((data.todayRevenue - data.yesterdayRevenue) / data.yesterdayRevenue) * 100
      : null
  const weekDelta =
    data.prevWeekRevenue > 0
      ? ((data.weekRevenue - data.prevWeekRevenue) / data.prevWeekRevenue) * 100
      : null

  const cycleProgress = data.cycle
    ? calculateCycleProgress(data.cycle.start_date, data.cycle.end_date)
    : null
  const wamDday = daysUntilNextMonday()

  return (
    <div className="space-y-6">
      {/* 인사 + 날짜 */}
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · Phase 1 ③
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          {getGreeting()}, 오늘은 {todayLabel}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          매일 아침 30초 안에 회사 상태를 파악할 수 있도록 설계된 대시보드입니다.
        </p>
      </div>

      {data.errors.length > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">데이터 일부 오류:</p>
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {data.errors.slice(0, 3).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 오늘 / 어제 / 이번주 / 이번달 KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">오늘 매출</span>
              <TrendingUp
                className={cn(
                  'h-4 w-4',
                  data.todayRevenue > 0 ? 'text-emerald-500' : 'text-slate-300',
                )}
              />
            </div>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                data.todayRevenue > 0 ? 'text-emerald-700' : 'text-slate-900',
              )}
            >
              {formatKRW(data.todayRevenue)}
            </div>
            <p className="text-[11px] text-slate-400">
              {data.todayCount}건 · 어제 {formatKRW(data.yesterdayRevenue)}
              {todayDelta !== null && (
                <span
                  className={cn(
                    'ml-1 font-semibold',
                    todayDelta >= 0 ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  ({todayDelta >= 0 ? '+' : ''}
                  {todayDelta.toFixed(0)}%)
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">이번 주 누적</span>
              <Calendar className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {formatKRW(data.weekRevenue)}
            </div>
            <p className="text-[11px] text-slate-400">
              {data.weekCount}건
              {weekDelta !== null && (
                <span
                  className={cn(
                    'ml-1 font-semibold',
                    weekDelta >= 0 ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  지난주 대비 {weekDelta >= 0 ? '+' : ''}
                  {weekDelta.toFixed(0)}%
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">이번 달 누적</span>
              <Receipt className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {formatKRW(data.monthRevenue)}
            </div>
            <p className="text-[11px] text-slate-400">월간 진행</p>
          </CardContent>
        </Card>

        <Card className={data.overdueAmount > 0 ? 'border-rose-300' : ''}>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">미수금 (연체)</span>
              <Wallet
                className={cn(
                  'h-4 w-4',
                  data.overdueAmount > 0 ? 'text-rose-500' : 'text-slate-300',
                )}
              />
            </div>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                data.overdueAmount > 0 ? 'text-rose-700' : 'text-slate-900',
              )}
            >
              {formatKRW(data.overdueAmount)}
            </div>
            <p className="text-[11px] text-slate-400">
              총 미수금 {formatKRW(data.totalOutstanding)} ({data.outstandingCount}건)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 12주 사이클 미니 + 목표 진행 */}
      {cycleProgress && (
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="text-xs text-slate-500">
                    사이클 #{data.cycle?.cycle_number}
                  </div>
                  <div className="font-semibold text-slate-800">
                    Week {cycleProgress.weekNumber} / 12{' '}
                    <span className="text-xs font-normal text-slate-400">
                      · D-{cycleProgress.daysRemaining}
                    </span>
                  </div>
                </div>
              </div>

              {data.totalGoals > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">
                    12주 목표 진행:{' '}
                    <strong className="text-slate-800">
                      {data.passedGoals}/{data.totalGoals}
                    </strong>{' '}
                    (80% 통과) ·{' '}
                    <strong className="text-slate-800">
                      평균 {(data.goalProgress * 100).toFixed(0)}%
                    </strong>
                  </span>
                  <Link href="/finance/cycle">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                      상세 <ArrowRight className="ml-0.5 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              )}

              {data.totalGoals === 0 && (
                <Link href="/finance/cycle">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                    <Plus className="mr-1 h-3 w-3" />
                    12주 목표 설정
                  </Button>
                </Link>
              )}

              {wamDday <= 7 && (
                <span className="rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                  <Clock className="mr-0.5 inline h-3 w-3" />
                  WAM: {wamDday === 0 ? '오늘' : `D-${wamDday}`}
                </span>
              )}
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
                style={{ width: `${cycleProgress.totalProgress * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 긴급 미수금 */}
      <Card className={data.topOverdue.length > 0 ? 'border-rose-200' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {data.topOverdue.length > 0 ? (
              <>
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                긴급 미수금 — 즉시 조치
              </>
            ) : (
              <>
                <Users className="h-4 w-4 text-emerald-500" />
                미수금 상태
              </>
            )}
          </CardTitle>
          <CardDescription>
            {data.topOverdue.length > 0
              ? `연체 거래 ${data.topOverdue.length}건. 오래된 순으로 표시`
              : '연체된 미수금이 없습니다 ✓'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.topOverdue.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">모든 미수금이 정상입니다</p>
          ) : (
            <div className="space-y-2">
              {data.topOverdue.map((o) => (
                <div
                  key={o.transaction_id}
                  className="flex items-center gap-3 rounded-md border border-rose-100 bg-rose-50/50 p-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        {o.client_name}
                      </span>
                      {o.tier && (
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                            CLIENT_TIER_COLOR[o.tier] ?? 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {CLIENT_TIER_LABEL[o.tier] ?? o.tier}
                        </span>
                      )}
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                          AGING_COLOR[o.aging_bucket] ?? 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {AGING_LABEL[o.aging_bucket] ?? o.aging_bucket}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      거래일 {o.transaction_date} · {o.days_overdue}일 연체
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="text-sm font-bold text-rose-700">
                      {formatKRW(Number(o.outstanding))}
                    </div>
                    <div className="text-[10px] text-slate-500">미수</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          ⚡ 빠른 실행
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link href="/finance/upload">
            <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
              <CardContent className="space-y-1 py-3">
                <Upload className="h-5 w-5 text-blue-500" />
                <div className="text-sm font-semibold text-slate-800">일계표 업로드</div>
                <div className="text-[11px] text-slate-500">
                  마지막: {data.recentUploadDate ?? '없음'}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/finance/decomposition">
            <Card className="cursor-pointer transition hover:border-purple-300 hover:bg-purple-50/30">
              <CardContent className="space-y-1 py-3">
                <Receipt className="h-5 w-5 text-purple-500" />
                <div className="text-sm font-semibold text-slate-800">매출 인수분해</div>
                <div className="text-[11px] text-slate-500">24셀 / 4티어 분석</div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/finance/pricing">
            <Card className="cursor-pointer transition hover:border-amber-300 hover:bg-amber-50/30">
              <CardContent className="space-y-1 py-3">
                <Target className="h-5 w-5 text-amber-500" />
                <div className="text-sm font-semibold text-slate-800">가격 결정 시작</div>
                <div className="text-[11px] text-slate-500">4단계 워크플로우</div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/finance/clients">
            <Card className="cursor-pointer transition hover:border-emerald-300 hover:bg-emerald-50/30">
              <CardContent className="space-y-1 py-3">
                <Users className="h-5 w-5 text-emerald-500" />
                <div className="text-sm font-semibold text-slate-800">거래처 관리</div>
                <div className="text-[11px] text-slate-500">24셀 매핑·등급</div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* 안내 */}
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="py-3">
          <p className="text-[11px] text-slate-500">
            💡 이 페이지는 데이터 기반 운영 대시보드입니다. AI 코칭과 드러커 질문 등 분석은{' '}
            <strong>모닝 브리핑(예정)</strong>에서 자동 생성됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
