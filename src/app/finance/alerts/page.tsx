/**
 * KPI 트리 · 이상치 알림 (Phase 5 #3 ⑨)
 * 모든 카테고리의 핵심 KPI를 한 곳에서 + 이상 신호 자동 탐지.
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
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  CheckCircle,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/formatters'
import { calculateCycleProgress } from '@/lib/v11-cycle'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Alert {
  level: 'critical' | 'warning' | 'info'
  category: string
  message: string
  link?: string
  metric?: string
}

async function loadData() {
  try {
    const supabase = await createClient()

    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split('T')[0]
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      .toISOString()
      .split('T')[0]
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      .toISOString()
      .split('T')[0]
    const past30 = new Date()
    past30.setDate(past30.getDate() - 30)
    const past30Str = past30.toISOString().split('T')[0]
    const past60 = new Date()
    past60.setDate(past60.getDate() - 60)
    const past60Str = past60.toISOString().split('T')[0]

    const [thisMonth, lastMonth, ar, samples30, samples3060, goals, cycleRes] =
      await Promise.all([
        supabase
          .from('transactions')
          .select('total_amount, margin_amount')
          .gte('transaction_date', monthStart)
          .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
        supabase
          .from('transactions')
          .select('total_amount, margin_amount')
          .gte('transaction_date', lastMonthStart)
          .lte('transaction_date', lastMonthEnd)
          .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
        supabase.from('outstanding_payments').select('outstanding, days_overdue'),
        supabase
          .from('sample_items')
          .select('status, request_id')
          .gte('request_id', 1),
        supabase.from('sample_items').select('status'),
        supabase.from('goals').select('current_value, target_value, title'),
        supabase
          .from('cycles')
          .select('start_date, end_date, cycle_number')
          .eq('status', 'active')
          .order('cycle_number', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

    const alerts: Alert[] = []

    // === 매출 이상치 ===
    const thisRevenue = (thisMonth.data ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )
    const lastRevenue = (lastMonth.data ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )
    const dayOfMonth = today.getDate()
    const daysInLastMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
    // 비율 보정 (이번 달은 진행 중)
    const lastRevenueProrated = lastRevenue * (dayOfMonth / daysInLastMonth)
    const revenueDelta =
      lastRevenueProrated > 0
        ? ((thisRevenue - lastRevenueProrated) / lastRevenueProrated) * 100
        : 0

    if (lastRevenue > 0 && revenueDelta < -20) {
      alerts.push({
        level: 'critical',
        category: '매출',
        message: `이번 달 매출이 같은 기간 대비 ${Math.abs(revenueDelta).toFixed(0)}% 감소`,
        metric: `${formatKRW(thisRevenue)} vs 지난달 ${formatKRW(lastRevenueProrated)}`,
        link: '/finance/decomposition',
      })
    } else if (revenueDelta > 30) {
      alerts.push({
        level: 'info',
        category: '매출',
        message: `이번 달 매출 ${revenueDelta.toFixed(0)}% 증가 — 무엇이 효과적이었는가?`,
        metric: `${formatKRW(thisRevenue)}`,
        link: '/finance/decomposition',
      })
    }

    // === 마진 이상치 ===
    const thisMargin = (thisMonth.data ?? []).reduce(
      (s, t) => s + Number(t.margin_amount || 0),
      0,
    )
    const thisMarginRate = thisRevenue > 0 ? (thisMargin / thisRevenue) * 100 : 0
    if (thisRevenue > 0 && thisMarginRate < 25) {
      alerts.push({
        level: 'warning',
        category: '수익성',
        message: `이번 달 마진율 ${thisMarginRate.toFixed(1)}% (25% 미만)`,
        metric: `매출 ${formatKRW(thisRevenue)} · 이익 ${formatKRW(thisMargin)}`,
        link: '/finance/decomposition',
      })
    }

    // === 미수금 위험 ===
    const arData = ar.data ?? []
    const overdue90 = arData
      .filter((o) => Number(o.days_overdue) > 90)
      .reduce((s, o) => s + Number(o.outstanding || 0), 0)
    const overdue30 = arData
      .filter((o) => Number(o.days_overdue) > 30)
      .reduce((s, o) => s + Number(o.outstanding || 0), 0)

    if (overdue90 > 0) {
      alerts.push({
        level: 'critical',
        category: '미수금',
        message: `90일 초과 연체 미수금 ${formatKRW(overdue90)}`,
        link: '/finance/ar-risk',
      })
    } else if (overdue30 > 5_000_000) {
      alerts.push({
        level: 'warning',
        category: '미수금',
        message: `30일 초과 연체 ${formatKRW(overdue30)}`,
        link: '/finance/ar-risk',
      })
    }

    // === 샘플 전환율 ===
    const samples30Items = samples30.data ?? []
    const samples3060Items = samples3060.data ?? []
    const conv30 = samples30Items.filter((s) => s.status === 'converted').length
    const sent30 = samples30Items.length
    const convRate30 = sent30 > 0 ? (conv30 / sent30) * 100 : 0
    if (sent30 > 5 && convRate30 < 15) {
      alerts.push({
        level: 'warning',
        category: '샘플',
        message: `최근 30일 샘플 전환율 ${convRate30.toFixed(0)}% (15% 미만)`,
        metric: `${conv30} 전환 / ${sent30} 발송`,
        link: '/finance/operations',
      })
    }

    // === 12주 사이클 진척 ===
    const goalsData = goals.data ?? []
    if (goalsData.length > 0 && cycleRes.data) {
      const progress = calculateCycleProgress(
        cycleRes.data.start_date,
        cycleRes.data.end_date,
      )
      const avgGoalProgress =
        goalsData.reduce((s, g) => {
          const t = Number(g.target_value) || 0
          if (t === 0) return s
          return s + Math.min(1, Number(g.current_value || 0) / t)
        }, 0) / goalsData.length

      // 시간 진행률보다 목표 진행률이 20%p 이상 늦으면 경고
      const timeProgress = progress.totalProgress
      if (timeProgress > 0.3 && avgGoalProgress < timeProgress - 0.2) {
        alerts.push({
          level: 'warning',
          category: '12주 사이클',
          message: `사이클 ${(timeProgress * 100).toFixed(0)}% 진행, 목표는 ${(avgGoalProgress * 100).toFixed(0)}% 만 진행`,
          metric: `격차 ${((timeProgress - avgGoalProgress) * 100).toFixed(0)}%p`,
          link: '/finance/cycle',
        })
      }
    }

    // === 모두 양호 ===
    if (alerts.length === 0) {
      alerts.push({
        level: 'info',
        category: '전체',
        message: '모든 핵심 지표가 정상 범위입니다 ✓',
      })
    }

    return {
      alerts,
      kpis: {
        thisRevenue,
        thisMargin,
        thisMarginRate,
        revenueDelta,
        arOutstanding: arData.reduce((s, o) => s + Number(o.outstanding || 0), 0),
        arOverdue: overdue30,
        sampleConvRate: convRate30,
        cycleWeek: cycleRes.data
          ? calculateCycleProgress(cycleRes.data.start_date, cycleRes.data.end_date).weekNumber
          : null,
        cycleNumber: cycleRes.data?.cycle_number,
      },
    }
  } catch (e) {
    return {
      alerts: [
        {
          level: 'critical' as const,
          category: '시스템',
          message: e instanceof Error ? e.message : String(e),
        } as Alert,
      ],
      kpis: null,
    }
  }
}

const ALERT_INFO = {
  critical: {
    label: '긴급',
    color: 'border-rose-300 bg-rose-50',
    text: 'text-rose-800',
    icon: AlertTriangle,
  },
  warning: {
    label: '주의',
    color: 'border-amber-300 bg-amber-50',
    text: 'text-amber-800',
    icon: AlertTriangle,
  },
  info: {
    label: '정보',
    color: 'border-blue-200 bg-blue-50',
    text: 'text-blue-800',
    icon: CheckCircle,
  },
}

export default async function AlertsPage() {
  const data = await loadData()

  const criticalCount = data.alerts.filter((a) => a.level === 'critical').length
  const warningCount = data.alerts.filter((a) => a.level === 'warning').length

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #3 ⑨ KPI 트리 · 이상치 알림
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">KPI 트리 · 이상치 알림</h1>
        <p className="mt-1 text-sm text-slate-500">
          전체 카테고리 핵심 KPI를 한 곳에서 + 자동 이상치 탐지
        </p>
      </div>

      {/* 알림 헤더 */}
      <div className="grid grid-cols-3 gap-3">
        <Card
          className={
            criticalCount > 0
              ? 'border-rose-300 bg-rose-50/50'
              : 'border-emerald-200 bg-emerald-50/30'
          }
        >
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">긴급 알림</div>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                criticalCount > 0 ? 'text-rose-700' : 'text-emerald-700',
              )}
            >
              {criticalCount}
            </div>
          </CardContent>
        </Card>
        <Card
          className={
            warningCount > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/30'
          }
        >
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">주의 알림</div>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                warningCount > 0 ? 'text-amber-700' : 'text-emerald-700',
              )}
            >
              {warningCount}
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">총 알림</div>
            <div className="text-2xl font-bold tabular-nums text-blue-700">
              {data.alerts.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 알림 리스트 */}
      <Card>
        <CardHeader>
          <CardTitle>이상치 알림</CardTitle>
          <CardDescription>실시간 자동 탐지 (페이지 진입마다 재계산)</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.alerts.map((a, i) => {
              const info = ALERT_INFO[a.level]
              const Icon = info.icon
              return (
                <li
                  key={i}
                  className={cn('rounded-md border p-3', info.color)}
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      className={cn('mt-0.5 h-4 w-4 shrink-0', info.text)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                            info.text,
                          )}
                        >
                          {info.label}
                        </span>
                        <span className={cn('text-[11px] font-semibold', info.text)}>
                          {a.category}
                        </span>
                      </div>
                      <p className={cn('mt-1 text-sm', info.text)}>{a.message}</p>
                      {a.metric && (
                        <p className="mt-0.5 text-[11px] text-slate-600">{a.metric}</p>
                      )}
                    </div>
                    {a.link && (
                      <Link
                        href={a.link}
                        className={cn(
                          'flex items-center gap-0.5 rounded px-2 py-1 text-[11px] hover:underline',
                          info.text,
                        )}
                      >
                        조치 <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      {/* KPI 트리 (요약) */}
      {data.kpis && (
        <Card>
          <CardHeader>
            <CardTitle>핵심 KPI 트리</CardTitle>
            <CardDescription>모든 카테고리 핵심 지표 한 곳에서 — 클릭 시 상세</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KPILink
                href="/finance/decomposition"
                label="이번 달 매출"
                value={formatKRW(data.kpis.thisRevenue)}
                delta={data.kpis.revenueDelta}
              />
              <KPILink
                href="/finance/decomposition"
                label="마진율"
                value={`${data.kpis.thisMarginRate.toFixed(1)}%`}
                tone={data.kpis.thisMarginRate >= 40 ? 'good' : data.kpis.thisMarginRate >= 25 ? 'neutral' : 'warn'}
              />
              <KPILink
                href="/finance/ar-risk"
                label="총 미수금"
                value={formatKRW(data.kpis.arOutstanding)}
                tone={data.kpis.arOverdue > 0 ? 'warn' : 'good'}
              />
              <KPILink
                href="/finance/operations"
                label="샘플 전환율 (30일)"
                value={`${data.kpis.sampleConvRate.toFixed(0)}%`}
                tone={data.kpis.sampleConvRate >= 30 ? 'good' : data.kpis.sampleConvRate >= 15 ? 'neutral' : 'warn'}
              />
              {data.kpis.cycleWeek && (
                <KPILink
                  href="/finance/cycle"
                  label={`사이클 #${data.kpis.cycleNumber}`}
                  value={`Week ${data.kpis.cycleWeek}/12`}
                />
              )}
              <KPILink href="/finance/bsc" label="BSC 4관점" value="대시보드" />
              <KPILink href="/finance/ltv" label="LTV·CAC" value="분석" />
              <KPILink href="/finance/sales/kpi" label="영업 KPI" value="대시보드" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function KPILink({
  href,
  label,
  value,
  delta,
  tone = 'neutral',
}: {
  href: string
  label: string
  value: string
  delta?: number
  tone?: 'good' | 'neutral' | 'warn'
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
        <CardContent className="space-y-1 py-3">
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div
            className={cn(
              'text-lg font-bold tabular-nums',
              tone === 'good'
                ? 'text-emerald-700'
                : tone === 'warn'
                ? 'text-rose-700'
                : 'text-slate-900',
            )}
          >
            {value}
          </div>
          {delta !== undefined && (
            <div
              className={cn(
                'flex items-center gap-0.5 text-[11px] font-semibold',
                delta >= 0 ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(0)}%
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
