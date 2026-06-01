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
import CycleDashboardSummary from '@/components/v11/cycle/CycleDashboardSummary'

/* 일일 운영 블록 — server component, 두 페이지에서 재사용
 *   /          (DIAVIS 메인) hero 직후
 *   /dashboard (단독 페이지)
 * dynamic / revalidate 설정은 호출하는 페이지가 결정 */

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
  /** 이번 달 주차별 누적 매출 [w1, w2, w3, w4] (직전 3주 + 이번 주) */
  recentFourWeeks: number[]
  /** 이번 주가 이 달의 몇째 주 (1-5) */
  weekOfMonth: number
  monthRevenue: number
  /** 지난 달 1일~오늘 같은 일자 매출 (예: 5/11 → 4/1-4/11) */
  prevMonthSameRangeRevenue: number
  /** 지난 달 전체 매출 */
  prevMonthRevenue: number
  /** 올해 YTD (1월 1일 ~ 오늘) */
  yearToDateRevenue: number
  /** 작년 같은 시점까지 (1월 1일 ~ 작년 오늘일) */
  prevYearSameRangeRevenue: number
  /** 작년 전체 */
  prevYearRevenue: number
  /** 3년 전 전체 (CAGR 계산용) */
  threeYearsAgoRevenue: number
  /** 5년 전 전체 (CAGR 계산용) */
  fiveYearsAgoRevenue: number
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

  // 지난 달 같은 시점 (예: 5/11 → 4/1-4/11)
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthSameRangeEnd = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    today.getDate(),
  )
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const prevMonthStartStr = toDateStr(prevMonthStart)
  const prevMonthSameRangeEndStr = toDateStr(prevMonthSameRangeEnd)
  const prevMonthEndStr = toDateStr(prevMonthEnd)

  // 직전 3주 + 이번 주 = 4주 (각 주의 월요일~일요일)
  const weekRanges: Array<{ start: string; end: string }> = []
  for (let i = 3; i >= 0; i--) {
    const wStart = new Date(startOfWeek(today).getTime() - i * 7 * 24 * 3600 * 1000)
    const wEnd = new Date(wStart.getTime() + 6 * 24 * 3600 * 1000)
    weekRanges.push({ start: toDateStr(wStart), end: toDateStr(wEnd) })
  }

  // 연도별 범위 (YTD / YoY / 3년·5년 CAGR)
  const currentYear = today.getFullYear()
  const monthIdx = today.getMonth()
  const dayIdx = today.getDate()
  const ytdStartStr = `${currentYear}-01-01`
  const prevYearStartStr = `${currentYear - 1}-01-01`
  const prevYearEndStr = `${currentYear - 1}-12-31`
  const prevYearSameDayStr = toDateStr(new Date(currentYear - 1, monthIdx, dayIdx))
  const threeYearsAgoStartStr = `${currentYear - 3}-01-01`
  const threeYearsAgoEndStr = `${currentYear - 3}-12-31`
  const fiveYearsAgoStartStr = `${currentYear - 5}-01-01`
  const fiveYearsAgoEndStr = `${currentYear - 5}-12-31`

  try {
    const supabase = await createClient()

    const [
      todayRes,
      yesterdayRes,
      weekRes,
      prevWeekRes,
      monthRes,
      prevMonthSameRangeRes,
      prevMonthRes,
      week1Res,
      week2Res,
      week3Res,
      week4Res,
      ytdRes,
      prevYearSameRangeRes,
      prevYearRes,
      threeYearsAgoRes,
      fiveYearsAgoRes,
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
      // 지난 달 같은 일자 범위
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', prevMonthStartStr)
        .lte('transaction_date', prevMonthSameRangeEndStr)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      // 지난 달 전체
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', prevMonthStartStr)
        .lte('transaction_date', prevMonthEndStr)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      // 직전 3주 + 이번 주 = 4 weekly aggregates
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', weekRanges[0].start)
        .lte('transaction_date', weekRanges[0].end)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', weekRanges[1].start)
        .lte('transaction_date', weekRanges[1].end)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', weekRanges[2].start)
        .lte('transaction_date', weekRanges[2].end)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', weekRanges[3].start)
        .lte('transaction_date', todayStr)   // 이번 주는 오늘까지만
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      // 올해 YTD (1월 1일 ~ 오늘)
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', ytdStartStr)
        .lte('transaction_date', todayStr)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      // 작년 같은 시점까지 (1월 1일 ~ 작년 같은 일자)
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', prevYearStartStr)
        .lte('transaction_date', prevYearSameDayStr)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      // 작년 전체
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', prevYearStartStr)
        .lte('transaction_date', prevYearEndStr)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      // 3년 전 전체 (CAGR base)
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', threeYearsAgoStartStr)
        .lte('transaction_date', threeYearsAgoEndStr)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      // 5년 전 전체 (CAGR base)
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', fiveYearsAgoStartStr)
        .lte('transaction_date', fiveYearsAgoEndStr)
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
    const prevMonthSameRangeRevenue = (prevMonthSameRangeRes.data ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )
    const prevMonthRevenue = (prevMonthRes.data ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )

    // 직전 3주 + 이번 주 [w1, w2, w3, w4]
    const sumRevenue = (res: { data: { total_amount: number | null }[] | null }) =>
      (res.data ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0)
    const recentFourWeeks = [
      sumRevenue(week1Res),
      sumRevenue(week2Res),
      sumRevenue(week3Res),
      sumRevenue(week4Res),
    ]

    // 연도별 매출 (성장률 계산용)
    const yearToDateRevenue = sumRevenue(ytdRes)
    const prevYearSameRangeRevenue = sumRevenue(prevYearSameRangeRes)
    const prevYearRevenue = sumRevenue(prevYearRes)
    const threeYearsAgoRevenue = sumRevenue(threeYearsAgoRes)
    const fiveYearsAgoRevenue = sumRevenue(fiveYearsAgoRes)

    // 이번 주가 이 달의 몇째 주인지 (이 달의 첫째 주를 1로)
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const firstMonday = startOfWeek(firstOfMonth)
    const weekOfMonth =
      Math.floor((startOfWeek(today).getTime() - firstMonday.getTime()) / (7 * 24 * 3600 * 1000)) + 1

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
      recentFourWeeks,
      weekOfMonth,
      monthRevenue,
      prevMonthSameRangeRevenue,
      prevMonthRevenue,
      yearToDateRevenue,
      prevYearSameRangeRevenue,
      prevYearRevenue,
      threeYearsAgoRevenue,
      fiveYearsAgoRevenue,
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
      recentFourWeeks: [0, 0, 0, 0],
      weekOfMonth: 1,
      monthRevenue: 0,
      prevMonthSameRangeRevenue: 0,
      prevMonthRevenue: 0,
      yearToDateRevenue: 0,
      prevYearSameRangeRevenue: 0,
      prevYearRevenue: 0,
      threeYearsAgoRevenue: 0,
      fiveYearsAgoRevenue: 0,
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

export default async function DailyOpsBlock() {
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
  // 이번 달 누적 vs 지난 달 같은 일자 범위
  const monthDelta =
    data.prevMonthSameRangeRevenue > 0
      ? ((data.monthRevenue - data.prevMonthSameRangeRevenue) / data.prevMonthSameRangeRevenue) * 100
      : null
  // 미수금 / 월 매출 비율 (월 매출 0 이면 null)
  const outstandingRatio =
    data.monthRevenue > 0 ? (data.totalOutstanding / data.monthRevenue) * 100 : null
  // 4주 미니 막대 최대값
  const maxWeek = Math.max(...data.recentFourWeeks, 1)

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

      {/* ── 그룹 제목 1: 현금의 흐름 ── */}
      <div className="pt-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--nv-primary)' }}>
          Daily Flow · 현금의 흐름
        </p>
        <h2 className="mt-1.5 text-[20px] sm:text-[22px] font-bold tracking-tight text-[#000000]">
          매출은 살아 있는가.
        </h2>
        <p className="mt-1 text-[12px] text-[#757575]">
          어제·지난 주·전월 동일 시점과 비교해 회사의 맥박을 30초 안에 확인.
        </p>
      </div>

      {/* 오늘 / 이번주 / 이번달 / 미수금 KPI — 비교 지표 강화 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4 items-stretch">

        {/* 1. 오늘 매출 — 어제와 비교 */}
        <Card className="relative h-full">
          <span aria-hidden className="absolute top-0 left-0" style={{ width: '10px', height: '10px', backgroundColor: 'var(--nv-primary)' }} />
          <CardContent className="space-y-2 py-4 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#757575]">오늘 매출</span>
              <TrendingUp className="w-4 h-4 text-[#1a1a1a]" strokeWidth={1.8} />
            </div>
            <div className="text-[24px] font-bold tabular-nums tracking-tight text-[#000000]">
              {formatKRW(data.todayRevenue)}
            </div>
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="text-[#757575]">어제 {formatKRW(data.yesterdayRevenue)}</span>
              {todayDelta !== null && (
                <span
                  className={cn(
                    'font-bold tabular-nums',
                    todayDelta >= 0 ? 'text-[#3f8500]' : 'text-[#e52020]',
                  )}
                >
                  {todayDelta >= 0 ? '↑' : '↓'} {Math.abs(todayDelta).toFixed(1)}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. 이번 주 누적 — 직전 3주와 비교 (mini bar chart) */}
        <Card className="relative h-full">
          <span aria-hidden className="absolute top-0 left-0" style={{ width: '10px', height: '10px', backgroundColor: 'var(--nv-primary)' }} />
          <CardContent className="space-y-2 py-4 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#757575]">이번 주 누적</span>
              <Calendar className="w-4 h-4 text-[#1a1a1a]" strokeWidth={1.8} />
            </div>
            <div className="text-[24px] font-bold tabular-nums tracking-tight text-[#000000]">
              {formatKRW(data.weekRevenue)}
            </div>
            {/* 직전 3주 + 이번 주 mini 막대 */}
            <div className="flex items-end justify-between gap-1 h-7 pt-1">
              {data.recentFourWeeks.map((w, i) => {
                const isCurrent = i === 3
                const heightPct = maxWeek > 0 ? (w / maxWeek) * 100 : 0
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full transition-all"
                      style={{
                        height: `${Math.max(heightPct, 6)}%`,
                        backgroundColor: isCurrent ? 'var(--nv-primary)' : '#cccccc',
                      }}
                    />
                    <span className={cn('text-[9px] tabular-nums', isCurrent ? 'text-[#000] font-bold' : 'text-[#757575]')}>
                      {i + 1}주
                    </span>
                  </div>
                )
              })}
            </div>
            {weekDelta !== null && (
              <div className="flex items-center gap-1.5 text-[12px] pt-1">
                <span className="text-[#757575]">지난주 대비</span>
                <span className={cn('font-bold tabular-nums', weekDelta >= 0 ? 'text-[#3f8500]' : 'text-[#e52020]')}>
                  {weekDelta >= 0 ? '↑' : '↓'} {Math.abs(weekDelta).toFixed(1)}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. 이번 달 누적 — 지난 달 같은 일자 대비 */}
        <Card className="relative h-full">
          <span aria-hidden className="absolute top-0 left-0" style={{ width: '10px', height: '10px', backgroundColor: 'var(--nv-primary)' }} />
          <CardContent className="space-y-2 py-4 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#757575]">이번 달 누적</span>
              <Receipt className="w-4 h-4 text-[#1a1a1a]" strokeWidth={1.8} />
            </div>
            <div className="text-[24px] font-bold tabular-nums tracking-tight text-[#000000]">
              {formatKRW(data.monthRevenue)}
            </div>
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="text-[#757575]">전월 동일</span>
              {monthDelta !== null ? (
                <span className={cn('font-bold tabular-nums', monthDelta >= 0 ? 'text-[#3f8500]' : 'text-[#e52020]')}>
                  {monthDelta >= 0 ? '↑' : '↓'} {Math.abs(monthDelta).toFixed(1)}%
                </span>
              ) : (
                <span className="text-[#757575]">—</span>
              )}
            </div>
            {/* 지난 달 진척 비교 progress */}
            {data.prevMonthRevenue > 0 && (
              <div className="pt-1.5">
                <div className="h-1 bg-[#eeeeee]">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min(100, (data.monthRevenue / data.prevMonthRevenue) * 100)}%`,
                      backgroundColor: 'var(--nv-primary)',
                    }}
                  />
                </div>
                <p className="text-[10px] text-[#757575] mt-1 tabular-nums">
                  지난 달 전체 {formatKRW(data.prevMonthRevenue)} 의{' '}
                  {((data.monthRevenue / data.prevMonthRevenue) * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. 미수금 — 클릭 시 /receivables 로 이동 */}
        <Link href="/receivables" className="block group h-full">
        <Card className={cn('relative h-full cursor-pointer transition hover:shadow-md hover:border-[#76b900]', data.overdueAmount > 0 ? 'border-[#e52020]' : '')}>
          <span aria-hidden className="absolute top-0 left-0" style={{ width: '10px', height: '10px', backgroundColor: data.overdueAmount > 0 ? '#e52020' : 'var(--nv-primary)' }} />
          <CardContent className="space-y-2 py-4 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#757575]">미수금</span>
              <Wallet
                className={cn('w-4 h-4', data.overdueAmount > 0 ? 'text-[#e52020]' : 'text-[#1a1a1a]')}
                strokeWidth={1.8}
              />
            </div>
            <div
              className={cn(
                'text-[24px] font-bold tabular-nums tracking-tight',
                data.overdueAmount > 0 ? 'text-[#e52020]' : 'text-[#000000]',
              )}
            >
              {formatKRW(data.totalOutstanding)}
            </div>
            {/* 월 매출 대비 미수금 비율 progress */}
            {outstandingRatio !== null ? (
              <>
                <div className="pt-1.5">
                  <div className="h-2 bg-[#eeeeee] flex">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${Math.min(100, outstandingRatio)}%`,
                        backgroundColor:
                          outstandingRatio > 50
                            ? '#e52020'
                            : outstandingRatio > 25
                              ? '#df6500'
                              : 'var(--nv-primary)',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px] tabular-nums">
                    <span className="text-[#757575]">월 매출 대비</span>
                    <span
                      className={cn(
                        'font-bold',
                        outstandingRatio > 50
                          ? 'text-[#e52020]'
                          : outstandingRatio > 25
                            ? 'text-[#df6500]'
                            : 'text-[#3f8500]',
                      )}
                    >
                      {outstandingRatio.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-[#757575] tabular-nums">
                  연체 {formatKRW(data.overdueAmount)} · 총 {data.outstandingCount}건
                </p>
              </>
            ) : (
              <p className="text-[10px] text-[#757575]">
                총 {data.outstandingCount}건
              </p>
            )}
          </CardContent>
        </Card>
        </Link>
      </div>

      {/* ── 4 KPI 한 줄 설명 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-1 -mt-2">
        <p className="text-[10px] text-[#757575] leading-snug">
          오늘 매출 = <span className="text-[#1a1a1a] font-medium">어제 매출 대비</span> 변화
        </p>
        <p className="text-[10px] text-[#757575] leading-snug">
          이번 주 누적 = <span className="text-[#1a1a1a] font-medium">최근 4주</span> 흐름 비교
        </p>
        <p className="text-[10px] text-[#757575] leading-snug">
          이번 달 누적 = <span className="text-[#1a1a1a] font-medium">전월 동일 시점</span> 대비
        </p>
        <p className="text-[10px] text-[#757575] leading-snug">
          미수금 = <span className="text-[#1a1a1a] font-medium">월 매출 대비</span> 비율
        </p>
      </div>

      {/* ── 매출 성장률 추세 (올해 / YoY / 3년 CAGR / 5년 CAGR) ── */}
      <GrowthCards data={data} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-1 -mt-2">
        <p className="text-[10px] text-[#757575] leading-snug">
          올해 YTD = <span className="text-[#1a1a1a] font-medium">1월 1일부터 오늘까지</span>
        </p>
        <p className="text-[10px] text-[#757575] leading-snug">
          전년 대비 = <span className="text-[#1a1a1a] font-medium">작년 같은 시점</span> 대비
        </p>
        <p className="text-[10px] text-[#757575] leading-snug">
          3년 CAGR = <span className="text-[#1a1a1a] font-medium">최근 3년</span> 연평균 성장률
        </p>
        <p className="text-[10px] text-[#757575] leading-snug">
          5년 CAGR = <span className="text-[#1a1a1a] font-medium">최근 5년</span> 연평균 성장률
        </p>
      </div>

      {/* ── 그룹 제목 2: 이익의 깊이 ── */}
      <div className="pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--nv-primary)' }}>
          Profit Depth · 이익의 깊이
        </p>
        <h2 className="mt-1.5 text-[20px] sm:text-[22px] font-bold tracking-tight text-[#000000]">
          매출은 이익이 되고 있는가.
        </h2>
        <p className="mt-1 text-[12px] text-[#757575]">
          단계별 마진으로 사업의 진짜 체력을 본다 — 매출 1원이 어디서 새고, 어디서 남는지.
        </p>
      </div>

      {/* ── 손익 4개 카드 (매출총이익 / 공헌이익 / 영업이익 / 당기순이익) ── */}
      <ProfitCards monthRevenue={data.monthRevenue} />

      {/* ── 손익 4 카드 한 줄 설명 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-1 -mt-2">
        <p className="text-[10px] text-[#757575] leading-snug">
          매출 총이익률 = <span className="text-[#1a1a1a] font-medium">제품 자체</span>의 수익성
        </p>
        <p className="text-[10px] text-[#757575] leading-snug">
          공헌이익률 = <span className="text-[#1a1a1a] font-medium">가격 전략</span>의 여지
        </p>
        <p className="text-[10px] text-[#757575] leading-snug">
          영업이익률 = <span className="text-[#1a1a1a] font-medium">본업의 체력</span>
        </p>
        <p className="text-[10px] text-[#757575] leading-snug">
          당기 순이익률 = <span className="text-[#1a1a1a] font-medium">최종 손에 남는</span> 비율
        </p>
      </div>

      {/* 12주 사이클 — 직원별 진행률 + 큰 목표/사이클 정보 인라인 편집 */}
      <CycleDashboardSummary />

      {/* 긴급 미수금 — 연체 있을 때만 표시 (없으면 위 KPI 카드만으로 충분) */}
      {data.topOverdue.length > 0 && (
      <Card className="border-rose-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            긴급 미수금 — 즉시 조치
          </CardTitle>
          <CardDescription>
            연체 거래 {data.topOverdue.length}건. 오래된 순으로 표시
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
      )}

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

// ============================================================
// ProfitCards — 매출총이익 / 공헌이익 / 영업이익 / 당기순이익
// 이번 달 손익 4단계. 실 데이터 연동은 추후 (현재 placeholder 0)
// ============================================================

interface ProfitCardItem {
  label: string
  rateLabel: string           // "매출 총이익률" 같은 비율 라벨
  formula: string
  value: number
  rate: number | null         // % vs 매출
  color: string               // 카드 corner-square + 강조
}

function ProfitCards({ monthRevenue }: { monthRevenue: number }) {
  // TODO: 실 데이터 연동 (expenses, cogs, taxes 등 fetch)
  // 현재는 placeholder (0). UI 만 구축.
  const items: ProfitCardItem[] = [
    {
      label: '매출 총이익',
      rateLabel: '매출 총이익률',
      formula: '매출 − 매출원가',
      value: 0,
      rate: monthRevenue > 0 ? 0 : null,
      color: 'var(--nv-primary)',
    },
    {
      label: '공헌이익',
      rateLabel: '공헌이익률',
      formula: '매출 − 변동비',
      value: 0,
      rate: monthRevenue > 0 ? 0 : null,
      color: '#0046a4',
    },
    {
      label: '영업이익',
      rateLabel: '영업이익률',
      formula: '매출총이익 − 판매관리비',
      value: 0,
      rate: monthRevenue > 0 ? 0 : null,
      color: '#df6500',
    },
    {
      label: '당기 순이익',
      rateLabel: '당기 순이익률',
      formula: '영업이익 − 세금·이자',
      value: 0,
      rate: monthRevenue > 0 ? 0 : null,
      color: '#3f8500',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4 items-stretch">
      {items.map((item) => (
        <Card key={item.label} className="relative h-full">
          <span
            aria-hidden
            className="absolute top-0 left-0"
            style={{ width: '10px', height: '10px', backgroundColor: item.color }}
          />
          <CardContent className="space-y-2 py-4 pt-5">
            <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#757575]">
              {item.label}
            </span>
            <div className="text-[24px] font-bold tabular-nums tracking-tight text-[#000000]">
              {formatKRW(item.value)}
            </div>
            {/* 비율 — 큰 숫자 바로 밑 */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] text-[#757575]">{item.rateLabel}</span>
              <span
                className="text-[14px] font-bold tabular-nums"
                style={{ color: item.color }}
              >
                {item.rate !== null ? `${item.rate.toFixed(1)}%` : '—'}
              </span>
            </div>
            <p className="text-[10px] text-[#757575] leading-snug">
              {item.formula}
            </p>
            {/* 매출 대비 비율 progress */}
            <div className="pt-1">
              <div className="h-1 bg-[#eeeeee]">
                <div
                  className="h-full transition-all"
                  style={{
                    width: item.rate !== null ? `${Math.max(0, Math.min(100, item.rate))}%` : '0%',
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================================
// GrowthCards — 매출 성장률 추세 (올해 YTD / YoY / 3년 CAGR / 5년 CAGR)
// ============================================================

interface GrowthCardItem {
  label: string                  // 카드 라벨
  value: string                  // 매출 또는 비율 표시값
  rate: number | null            // % (양수=성장, 음수=감소)
  hint: string                   // 작은 보조 텍스트
  color: string                  // 강조 색
}

function GrowthCards({ data }: { data: DailyOpsData }) {
  // YoY (전년 동일 시점 대비)
  const yoyRate =
    data.prevYearSameRangeRevenue > 0
      ? ((data.yearToDateRevenue - data.prevYearSameRangeRevenue) /
          data.prevYearSameRangeRevenue) *
        100
      : null

  // 3년 CAGR (3년 전 전체 매출 → 작년 전체 매출 — 2년 사이 변화의 연평균)
  // 공식: (현재/시작)^(1/n) - 1 — n=2년 (3년 전 → 작년 = 2 step)
  const threeYearCAGR =
    data.threeYearsAgoRevenue > 0 && data.prevYearRevenue > 0
      ? (Math.pow(data.prevYearRevenue / data.threeYearsAgoRevenue, 1 / 2) - 1) * 100
      : null

  // 5년 CAGR (5년 전 전체 → 작년 전체, n=4)
  const fiveYearCAGR =
    data.fiveYearsAgoRevenue > 0 && data.prevYearRevenue > 0
      ? (Math.pow(data.prevYearRevenue / data.fiveYearsAgoRevenue, 1 / 4) - 1) * 100
      : null

  const items: GrowthCardItem[] = [
    {
      label: '올해 YTD',
      value: formatKRW(data.yearToDateRevenue),
      rate: null,    // YTD 자체는 절대값 표시
      hint: '1월 1일부터 현재까지 누적',
      color: 'var(--nv-primary)',
    },
    {
      label: '전년 대비',
      value: yoyRate !== null ? `${yoyRate >= 0 ? '+' : ''}${yoyRate.toFixed(1)}%` : '—',
      rate: yoyRate,
      hint: `작년 ${formatKRW(data.prevYearSameRangeRevenue)}`,
      color: '#0046a4',
    },
    {
      label: '3년 CAGR',
      value: threeYearCAGR !== null ? `${threeYearCAGR >= 0 ? '+' : ''}${threeYearCAGR.toFixed(1)}%` : '—',
      rate: threeYearCAGR,
      hint: '연평균 성장률 (3년)',
      color: '#df6500',
    },
    {
      label: '5년 CAGR',
      value: fiveYearCAGR !== null ? `${fiveYearCAGR >= 0 ? '+' : ''}${fiveYearCAGR.toFixed(1)}%` : '—',
      rate: fiveYearCAGR,
      hint: '연평균 성장률 (5년)',
      color: '#3f8500',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-stretch">
      {items.map((item) => {
        const isPositive = item.rate !== null && item.rate >= 0
        const valueColor =
          item.rate === null
            ? '#000000'
            : isPositive
              ? '#3f8500'
              : '#e52020'

        return (
          <Card key={item.label} className="relative h-full">
            <span
              aria-hidden
              className="absolute top-0 left-0"
              style={{ width: '10px', height: '10px', backgroundColor: item.color }}
            />
            <CardContent className="space-y-1.5 py-4 pt-5">
              <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#757575]">
                {item.label}
              </span>
              <div
                className="text-[22px] font-bold tabular-nums tracking-tight"
                style={{ color: item.rate === null ? '#000000' : valueColor }}
              >
                {item.rate !== null && (
                  <span className="mr-1">{isPositive ? '↑' : '↓'}</span>
                )}
                {item.value}
              </div>
              <p className="text-[10px] text-[#757575] leading-snug">{item.hint}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
