/**
 * 매출 인수분해 (Phase 1 ④, PRD #3 ②)
 *
 * 매출을 다양한 차원으로 분해:
 * - 객수 × 객단가 (이번 기간 vs 직전 동일 길이 기간)
 * - 24셀 매트릭스 (full size)
 * - 4티어 분포
 * - Top 거래처 (매출 기여)
 * - 일별 매출/이익 트렌드
 *
 * URL: /finance/decomposition?period=this_month|last_month|90d|ytd
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  TrendingUp,
  Users,
  Receipt,
  Wallet,
  ArrowUp,
  ArrowDown,
  AlertCircle,
} from 'lucide-react'
import KPICard from '@/components/v11/finance/KPICard'
import SegmentMatrix from '@/components/v11/finance/SegmentMatrix'
import TierBreakdown from '@/components/v11/finance/TierBreakdown'
import RevenueDailyChart from '@/components/v11/finance/RevenueDailyChart'
import PeriodSelector, { type Period } from '@/components/v11/finance/PeriodSelector'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/formatters'
import { resolvePeriod, isValidPeriod, pctChange } from '@/lib/v11-period'
import { CLIENT_TIER_COLOR, CLIENT_TIER_LABEL, segmentLabel } from '@/lib/v11-labels'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface TxLite {
  client_id: number | null
  total_amount: number
  margin_amount: number
  transaction_date: string
  segment_id: number | null
  tier: string | null
}

interface ClientLite {
  id: number
  name: string
  occupation: string | null
  primary_division: string | null
  tier: string | null
}

async function loadData(period: Period) {
  const range = resolvePeriod(period)

  try {
    const supabase = await createClient()

    // 현재 기간 거래
    const { data: txCurrent, error: e1 } = await supabase
      .from('transactions')
      .select('client_id, total_amount, margin_amount, transaction_date, segment_id, tier')
      .gte('transaction_date', range.start)
      .lte('transaction_date', range.end)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid'])

    // 비교 기간 거래
    const { data: txPrev, error: e2 } = await supabase
      .from('transactions')
      .select('client_id, total_amount, margin_amount')
      .gte('transaction_date', range.prevStart)
      .lte('transaction_date', range.prevEnd)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid'])

    // 24셀 (현재 기간으로 직접 집계 — view는 전체 기간이라 대신 raw 집계)
    const { data: segments, error: e3 } = await supabase
      .from('revenue_by_segment')
      .select('*')

    // 4티어
    const { data: tiers, error: e4 } = await supabase.from('revenue_by_tier').select('*')

    // 거래처 (이름 매핑용)
    const { data: clients, error: e5 } = await supabase
      .from('clients')
      .select('id, name, occupation, primary_division, tier')

    return {
      range,
      txCurrent: (txCurrent ?? []) as TxLite[],
      txPrev: (txPrev ?? []) as Array<{ client_id: number | null; total_amount: number; margin_amount: number }>,
      segments: segments ?? [],
      tiers: tiers ?? [],
      clients: (clients ?? []) as ClientLite[],
      errors: [e1, e2, e3, e4, e5].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      range,
      txCurrent: [] as TxLite[],
      txPrev: [],
      segments: [],
      tiers: [],
      clients: [] as ClientLite[],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[10px] text-slate-400">— 비교 기준 없음</span>
  }
  const isUp = value >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-semibold',
        isUp ? 'text-emerald-600' : 'text-rose-600',
      )}
    >
      {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function DecompositionPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const period: Period = isValidPeriod(sp.period) ? sp.period : 'this_month'
  const { range, txCurrent, txPrev, segments, tiers, clients, errors } = await loadData(period)

  // ── 현재 기간 KPI ──
  const revenue = txCurrent.reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const margin = txCurrent.reduce((s, t) => s + Number(t.margin_amount || 0), 0)
  const txCount = txCurrent.length
  const activeClients = new Set(txCurrent.map((t) => t.client_id).filter(Boolean)).size
  const avgTicket = activeClients > 0 ? revenue / activeClients : 0

  // ── 이전 기간 KPI (비교용) ──
  const prevRevenue = txPrev.reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const prevMargin = txPrev.reduce((s, t) => s + Number(t.margin_amount || 0), 0)
  const prevActiveClients = new Set(txPrev.map((t) => t.client_id).filter(Boolean)).size
  const prevAvgTicket = prevActiveClients > 0 ? prevRevenue / prevActiveClients : 0

  // ── Top 거래처 (현재 기간 매출 기준) ──
  const clientMap = new Map<number, ClientLite>()
  clients.forEach((c) => clientMap.set(c.id, c))
  const byClient = new Map<number, { revenue: number; margin: number; count: number }>()
  for (const t of txCurrent) {
    if (!t.client_id) continue
    const cur = byClient.get(t.client_id) ?? { revenue: 0, margin: 0, count: 0 }
    cur.revenue += Number(t.total_amount || 0)
    cur.margin += Number(t.margin_amount || 0)
    cur.count++
    byClient.set(t.client_id, cur)
  }
  const topClients = Array.from(byClient.entries())
    .map(([id, agg]) => ({ ...agg, client: clientMap.get(id) }))
    .filter((r) => r.client)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // ── 일별 매출 트렌드 ──
  const dailyMap = new Map<string, { revenue: number; margin: number; count: number }>()
  for (const t of txCurrent) {
    const d = t.transaction_date
    const cur = dailyMap.get(d) ?? { revenue: 0, margin: 0, count: 0 }
    cur.revenue += Number(t.total_amount || 0)
    cur.margin += Number(t.margin_amount || 0)
    cur.count++
    dailyMap.set(d, cur)
  }
  const daily = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · Phase 1 ④
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">매출 인수분해</h1>
          <p className="mt-1 text-sm text-slate-500">
            {range.label} · 매출 = 객수 × 객단가, 24셀 분해, 티어별 분포, 일별 추이
          </p>
        </div>
        <PeriodSelector current={period} />
      </div>

      {/* 에러 배너 */}
      {errors.length > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">데이터 일부 오류:</p>
                <ul className="mt-1 list-disc pl-4 text-xs text-rose-800">
                  {errors.slice(0, 3).map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI 4개 (객수 × 객단가 = 매출 + 공헌이익) */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card>
            <CardContent className="space-y-1 py-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">객수 (활성 거래처)</span>
                <Users className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-slate-900">
                {activeClients.toLocaleString()}
              </div>
              <DeltaBadge value={pctChange(activeClients, prevActiveClients)} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 py-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">객단가 (평균)</span>
                <Receipt className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-slate-900">
                {formatKRW(avgTicket)}
              </div>
              <DeltaBadge value={pctChange(avgTicket, prevAvgTicket)} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 py-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">매출</span>
                <TrendingUp
                  className={cn(
                    'h-4 w-4',
                    revenue > 0 ? 'text-emerald-500' : 'text-slate-400',
                  )}
                />
              </div>
              <div
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  revenue > 0 ? 'text-emerald-700' : 'text-slate-900',
                )}
              >
                {formatKRW(revenue)}
              </div>
              <DeltaBadge value={pctChange(revenue, prevRevenue)} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 py-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">공헌이익</span>
                <Wallet className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-slate-900">
                {formatKRW(margin)}
              </div>
              <DeltaBadge value={pctChange(margin, prevMargin)} />
            </CardContent>
          </Card>
        </div>

        <p className="text-[11px] text-slate-400">
          매출 = 객수 × 객단가 ·{' '}
          <span className="text-slate-500">
            {activeClients} × {formatKRW(avgTicket)} = {formatKRW(revenue)}
          </span>
          {' · '}
          {txCount.toLocaleString()}건 거래 ·{' '}
          비교: {range.prevStart} ~ {range.prevEnd}
        </p>
      </div>

      {/* 일별 매출 트렌드 */}
      <Card>
        <CardHeader>
          <CardTitle>일별 매출 · 공헌이익 추이</CardTitle>
          <CardDescription>{range.label} 동안 일별 누적 매출 (점선: 공헌이익)</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueDailyChart data={daily} />
        </CardContent>
      </Card>

      {/* 24셀 + 4티어 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>24셀 매출 분해</CardTitle>
            <CardDescription>
              누적 기준 (전체 기간) — 셀 색상 강도가 매출 비중을 나타냅니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            {segments.length > 0 ? (
              <SegmentMatrix data={segments} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">데이터를 불러올 수 없습니다</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4티어 분포</CardTitle>
            <CardDescription>저가 → 럭셔리</CardDescription>
          </CardHeader>
          <CardContent>
            {tiers.length > 0 ? (
              <TierBreakdown data={tiers} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">데이터 없음</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 거래처 */}
      <Card>
        <CardHeader>
          <CardTitle>매출 상위 거래처 (Top 10)</CardTitle>
          <CardDescription>{range.label} 매출 기준</CardDescription>
        </CardHeader>
        <CardContent>
          {topClients.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              기간 내 거래가 없습니다
            </p>
          ) : (
            <div className="space-y-2">
              {topClients.map((row, idx) => {
                const share = revenue > 0 ? (row.revenue / revenue) * 100 : 0
                const c = row.client!
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50/50 p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-slate-800">{c.name}</span>
                        {c.tier && (
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              CLIENT_TIER_COLOR[c.tier] ?? 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {CLIENT_TIER_LABEL[c.tier] ?? c.tier}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {segmentLabel(c.occupation, c.primary_division)} · {row.count}건 거래
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.min(share, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-sm font-bold text-slate-900">{formatKRW(row.revenue)}</div>
                      <div className="text-[11px] text-slate-500">{share.toFixed(1)}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
