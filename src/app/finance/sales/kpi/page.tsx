/**
 * 영업 KPI 대시보드 (Phase 2 #2a ⑥)
 *
 * 선행지표(활동) → 후행지표(매출) 흐름.
 * 키엔스/트레이시 핵심 영업 지표.
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
  Activity as ActivityIcon,
  Target,
  Trophy,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/formatters'
import { resolvePeriod, isValidPeriod, pctChange } from '@/lib/v11-period'
import PeriodSelector, { type Period } from '@/components/v11/finance/PeriodSelector'
import { SALES_ACTIVITY_LABEL, SALES_STAGE_LABEL } from '@/lib/v11-labels'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ActivityAgg {
  activity_type: string
  duration_minutes: number | null
  value_generated: number | null
}

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

async function loadData(period: Period) {
  const range = resolvePeriod(period)

  try {
    const supabase = await createClient()

    const [actsCurrent, actsPrev, txCurrent, txPrev, funnel] = await Promise.all([
      supabase
        .from('sales_activities')
        .select('activity_type, duration_minutes, value_generated, client_id')
        .gte('activity_date', range.start)
        .lte('activity_date', range.end),
      supabase
        .from('sales_activities')
        .select('activity_type, duration_minutes, value_generated, client_id')
        .gte('activity_date', range.prevStart)
        .lte('activity_date', range.prevEnd),
      supabase
        .from('transactions')
        .select('total_amount, client_id')
        .gte('transaction_date', range.start)
        .lte('transaction_date', range.end)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('transactions')
        .select('total_amount, client_id')
        .gte('transaction_date', range.prevStart)
        .lte('transaction_date', range.prevEnd)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase.from('sales_funnel').select('*'),
    ])

    return {
      range,
      actsCurrent: ((actsCurrent.data ?? []) as unknown) as Array<
        ActivityAgg & { client_id: number | null }
      >,
      actsPrev: ((actsPrev.data ?? []) as unknown) as Array<
        ActivityAgg & { client_id: number | null }
      >,
      txCurrent: txCurrent.data ?? [],
      txPrev: txPrev.data ?? [],
      funnel: funnel.data ?? [],
      errors: [actsCurrent.error, actsPrev.error, txCurrent.error, txPrev.error, funnel.error]
        .filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      range,
      actsCurrent: [] as Array<ActivityAgg & { client_id: number | null }>,
      actsPrev: [] as Array<ActivityAgg & { client_id: number | null }>,
      txCurrent: [],
      txPrev: [],
      funnel: [],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

function aggActivities(rows: Array<ActivityAgg & { client_id: number | null }>) {
  const byType = new Map<string, number>()
  let totalDuration = 0
  let totalValue = 0
  const distinctClients = new Set<number>()
  for (const r of rows) {
    byType.set(r.activity_type, (byType.get(r.activity_type) ?? 0) + 1)
    totalDuration += Number(r.duration_minutes ?? 0)
    totalValue += Number(r.value_generated ?? 0)
    if (r.client_id) distinctClients.add(r.client_id)
  }
  return { byType, totalDuration, totalValue, contacts: distinctClients.size }
}

export default async function SalesKPIPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const period: Period = isValidPeriod(sp.period) ? sp.period : 'this_month'
  const { range, actsCurrent, actsPrev, txCurrent, txPrev, funnel, errors } =
    await loadData(period)

  const cur = aggActivities(actsCurrent)
  const prev = aggActivities(actsPrev)

  const meetingsCur = (cur.byType.get('meeting') ?? 0) + (cur.byType.get('visit') ?? 0)
  const meetingsPrev =
    (prev.byType.get('meeting') ?? 0) + (prev.byType.get('visit') ?? 0)
  const samplesCur = cur.byType.get('sample_send') ?? 0
  const samplesPrev = prev.byType.get('sample_send') ?? 0
  const proposalsCur = cur.byType.get('proposal_send') ?? 0
  const proposalsPrev = prev.byType.get('proposal_send') ?? 0

  const revenueCur = txCurrent.reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const revenuePrev = txPrev.reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const newClients = new Set(
    txCurrent.map((t) => t.client_id).filter(Boolean) as number[],
  ).size

  // 시간당 매출 환산
  const hoursTotal = cur.totalDuration / 60
  const timeCharge = hoursTotal > 0 ? revenueCur / hoursTotal : 0

  return (
    <div className="space-y-6">
      <Link
        href="/finance/sales"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        영업 허브
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · #2a ⑥ 영업 KPI
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">영업 KPI 대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">
            {range.label} · 선행지표(활동) → 후행지표(매출) 흐름. 시간당 매출 환산.
          </p>
        </div>
        <PeriodSelector current={period} />
      </div>

      {errors.length > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                {errors.slice(0, 2).map((e, i) => (
                  <div key={i}>{e.message}</div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 선행지표 4개 */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <ActivityIcon className="h-4 w-4 text-blue-500" />
          선행지표 (활동) — 매주 챙겨야 후행이 따라옴
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPICard
            label="미팅·방문"
            value={String(meetingsCur)}
            delta={pctChange(meetingsCur, meetingsPrev)}
            hint="대면 + 방문"
          />
          <KPICard
            label="샘플 발송"
            value={String(samplesCur)}
            delta={pctChange(samplesCur, samplesPrev)}
            hint="디안 영업 핵심"
          />
          <KPICard
            label="제안서 발송"
            value={String(proposalsCur)}
            delta={pctChange(proposalsCur, proposalsPrev)}
            hint="견적/제안"
          />
          <KPICard
            label="컨택 거래처"
            value={String(cur.contacts)}
            delta={pctChange(cur.contacts, prev.contacts)}
            hint="활동 발생 거래처 수"
          />
        </div>
      </div>

      {/* 후행지표 4개 */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Trophy className="h-4 w-4 text-emerald-500" />
          후행지표 (결과)
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPICard
            label="매출"
            value={formatKRW(revenueCur)}
            delta={pctChange(revenueCur, revenuePrev)}
            hint={`${txCurrent.length}건 거래`}
            tone="emerald"
          />
          <KPICard
            label="활동 발생 매출"
            value={formatKRW(cur.totalValue)}
            delta={pctChange(cur.totalValue, prev.totalValue)}
            hint="활동 시 직접 발생"
          />
          <KPICard
            label="신규 거래 거래처"
            value={String(newClients)}
            delta={null}
            hint="기간 내 거래 발생"
          />
          <KPICard
            label="시간당 매출"
            value={formatKRW(timeCharge)}
            delta={null}
            hint={`${hoursTotal.toFixed(0)}시간 활동`}
            tone="amber"
            icon={<Clock className="h-4 w-4 text-amber-500" />}
          />
        </div>
      </div>

      {/* 활동 유형별 분포 */}
      <Card>
        <CardHeader>
          <CardTitle>활동 유형별 분포</CardTitle>
          <CardDescription>{range.label} 동안 {actsCurrent.length}건</CardDescription>
        </CardHeader>
        <CardContent>
          {cur.byType.size === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">활동 없음</p>
          ) : (
            <div className="space-y-2">
              {Array.from(cur.byType.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => {
                  const ratio =
                    actsCurrent.length > 0 ? (count / actsCurrent.length) * 100 : 0
                  return (
                    <div key={type}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-slate-700">
                          {SALES_ACTIVITY_LABEL[type] ?? type}
                        </span>
                        <span className="tabular-nums text-slate-600">
                          <strong>{count}</strong>건 ({ratio.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-blue-400"
                          style={{ width: `${Math.min(ratio, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 7단계 깔때기 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-500" />
            7단계 깔때기 — 거래처 분포
          </CardTitle>
        </CardHeader>
        <CardContent>
          {funnel.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              거래처가 없거나 단계가 미설정
            </p>
          ) : (
            <div className="space-y-2">
              {funnel.map((row) => (
                <div key={row.current_stage} className="flex items-center gap-3 text-xs">
                  <span className="w-32 shrink-0 font-medium text-slate-700">
                    {SALES_STAGE_LABEL[row.current_stage] ?? row.current_stage}
                  </span>
                  <span className="tabular-nums text-slate-600">
                    <strong>{row.client_count}</strong> 곳
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KPICard({
  label,
  value,
  delta,
  hint,
  tone,
  icon,
}: {
  label: string
  value: string
  delta: number | null
  hint?: string
  tone?: 'default' | 'emerald' | 'amber'
  icon?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">{label}</span>
          {icon ?? <ActivityIcon className="h-4 w-4 text-slate-400" />}
        </div>
        <div
          className={cn(
            'text-2xl font-bold tabular-nums',
            tone === 'emerald' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-900',
          )}
        >
          {value}
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">{hint}</span>
          {delta !== null && (
            <span
              className={cn(
                'font-semibold',
                delta >= 0 ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(0)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
