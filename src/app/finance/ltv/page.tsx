/**
 * 거래처 LTV·CAC 분석 (Phase 5 #3 ⑤)
 * Lifetime Value (누적 매출) vs Customer Acquisition Cost (영업·샘플 비용)
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
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CLIENT_TIER_COLOR, CLIENT_TIER_LABEL, segmentLabel } from '@/lib/v11-labels'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface LTVRow {
  id: number
  name: string
  tier: string | null
  occupation: string | null
  primary_division: string | null
  ltv: number
  margin: number
  txCount: number
  firstTx: string | null
  lastTx: string | null
  daysActive: number
  // CAC components
  sampleCost: number
  activityHours: number
  cac: number // estimated total acquisition cost
  ltvToCacRatio: number
}

async function loadData() {
  try {
    const supabase = await createClient()

    const [clientsRes, txRes, samplesRes, activitiesRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, tier, occupation, primary_division, created_at')
        .eq('active', true),
      supabase
        .from('transactions')
        .select('client_id, total_amount, margin_amount, transaction_date')
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase.from('sample_items').select('unit_cost, quantity, request_id'),
      supabase
        .from('sales_activities')
        .select('client_id, duration_minutes, value_generated'),
    ])

    // Aggregate per client
    type TxLite = {
      client_id: number | null
      total_amount: number | null
      margin_amount: number | null
      transaction_date: string | null
    }
    const txByClient = new Map<number, TxLite[]>()
    for (const t of (txRes.data ?? []) as TxLite[]) {
      if (!t.client_id) continue
      const list = txByClient.get(t.client_id) ?? []
      list.push(t)
      txByClient.set(t.client_id, list)
    }

    // Sample costs need client_id via request_id, but sample_items.request_id → sample_requests.client_id
    // For simplicity, fetch sample_requests and join
    const { data: requestsMap } = await supabase
      .from('sample_requests')
      .select('id, client_id')
    const reqToClient = new Map<number, number>()
    for (const r of requestsMap ?? []) {
      if (r.client_id) reqToClient.set(r.id, r.client_id)
    }
    const sampleByClient = new Map<number, number>()
    for (const s of samplesRes.data ?? []) {
      const cid = reqToClient.get(s.request_id)
      if (!cid) continue
      const cost = Number(s.unit_cost ?? 0) * Number(s.quantity ?? 1)
      sampleByClient.set(cid, (sampleByClient.get(cid) ?? 0) + cost)
    }

    const activityByClient = new Map<number, number>()
    for (const a of activitiesRes.data ?? []) {
      if (!a.client_id) continue
      const minutes = Number(a.duration_minutes ?? 0)
      activityByClient.set(a.client_id, (activityByClient.get(a.client_id) ?? 0) + minutes)
    }

    // Hourly cost assumption (CAC calculation): 5만원/시간 (대표 기회 비용 가정)
    const HOURLY_RATE = 50000

    const rows: LTVRow[] = []
    for (const c of clientsRes.data ?? []) {
      const txs = txByClient.get(c.id) ?? []
      const ltv = txs.reduce((s, t) => s + Number(t.total_amount || 0), 0)
      const margin = txs.reduce((s, t) => s + Number(t.margin_amount || 0), 0)
      const sortedDates = txs
        .map((t) => t.transaction_date)
        .filter(Boolean)
        .sort()
      const firstTx = sortedDates[0] ?? null
      const lastTx = sortedDates[sortedDates.length - 1] ?? null
      const daysActive =
        firstTx && lastTx
          ? Math.max(
              1,
              Math.ceil(
                (new Date(lastTx).getTime() - new Date(firstTx).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 0
      const sampleCost = sampleByClient.get(c.id) ?? 0
      const activityHours = (activityByClient.get(c.id) ?? 0) / 60
      const cac = sampleCost + activityHours * HOURLY_RATE
      const ltvToCacRatio = cac > 0 ? ltv / cac : 0

      rows.push({
        id: c.id,
        name: c.name,
        tier: c.tier,
        occupation: c.occupation,
        primary_division: c.primary_division,
        ltv,
        margin,
        txCount: txs.length,
        firstTx,
        lastTx,
        daysActive,
        sampleCost,
        activityHours,
        cac,
        ltvToCacRatio,
      })
    }

    // 정렬 및 Top 50
    rows.sort((a, b) => b.ltv - a.ltv)

    return {
      rows: rows.filter((r) => r.ltv > 0 || r.cac > 0).slice(0, 50),
      errors: [
        clientsRes.error,
        txRes.error,
        samplesRes.error,
        activitiesRes.error,
      ].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      rows: [] as LTVRow[],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function LTVPage() {
  const { rows, errors } = await loadData()

  const totalLTV = rows.reduce((s, r) => s + r.ltv, 0)
  const totalCAC = rows.reduce((s, r) => s + r.cac, 0)
  const totalMargin = rows.reduce((s, r) => s + r.margin, 0)
  const avgLTVCAC = totalCAC > 0 ? totalLTV / totalCAC : 0

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #3 ⑤ LTV·CAC
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">거래처 LTV·CAC 분석</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lifetime Value (누적 매출) ÷ CAC (샘플 + 영업 시간 비용) — 거래처 수익성 진단
        </p>
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

      {/* 종합 KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">총 LTV (Top 50)</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700">
              {formatKRW(totalLTV)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">총 CAC (추정)</div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {formatKRW(totalCAC)}
            </div>
            <p className="text-[10px] text-slate-400">
              샘플 + 영업 시간 (시간당 5만)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">평균 LTV/CAC</div>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                avgLTVCAC >= 5 ? 'text-emerald-700' : avgLTVCAC >= 3 ? 'text-amber-700' : 'text-rose-700',
              )}
            >
              {avgLTVCAC.toFixed(1)}x
            </div>
            <p className="text-[10px] text-slate-400">3x+ 권장 · 5x+ 우수</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">총 공헌이익</div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {formatKRW(totalMargin)}
            </div>
            <p className="text-[10px] text-slate-400">
              마진율 {totalLTV > 0 ? ((totalMargin / totalLTV) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 거래처 리스트 */}
      <Card>
        <CardHeader>
          <CardTitle>거래처 LTV·CAC 랭킹 (Top 50)</CardTitle>
          <CardDescription>LTV 기준 정렬 · CAC = 샘플 비용 + (영업 시간 × ₩50,000/h)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">
              아직 LTV 분석 데이터가 없습니다
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="px-3 py-2 text-left">거래처</th>
                    <th className="px-3 py-2 text-left">24셀 / 등급</th>
                    <th className="px-3 py-2 text-right">LTV</th>
                    <th className="px-3 py-2 text-right">공헌이익</th>
                    <th className="px-3 py-2 text-right">거래 횟수</th>
                    <th className="px-3 py-2 text-right">활동 기간</th>
                    <th className="px-3 py-2 text-right">CAC</th>
                    <th className="px-3 py-2 text-right">LTV/CAC</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/finance/sales/clients/${r.id}`}
                          className="font-semibold text-slate-700 hover:underline"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-600">
                            {segmentLabel(r.occupation, r.primary_division)}
                          </span>
                          {r.tier && (
                            <span
                              className={cn(
                                'rounded px-1 py-0.5 text-[10px] font-semibold',
                                CLIENT_TIER_COLOR[r.tier] ?? 'bg-slate-100',
                              )}
                            >
                              {CLIENT_TIER_LABEL[r.tier] ?? r.tier}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-emerald-700">
                        {formatKRW(r.ltv)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                        {formatKRW(r.margin)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.txCount}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                        {r.daysActive > 0 ? `${r.daysActive}일` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                        {r.cac > 0 ? formatKRW(r.cac) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {r.ltvToCacRatio > 0 ? (
                          <span
                            className={cn(
                              'flex items-center justify-end gap-0.5 font-semibold',
                              r.ltvToCacRatio >= 5
                                ? 'text-emerald-700'
                                : r.ltvToCacRatio >= 3
                                ? 'text-amber-700'
                                : 'text-rose-700',
                            )}
                          >
                            {r.ltvToCacRatio >= 1 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {r.ltvToCacRatio.toFixed(1)}x
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 LTV·CAC 활용</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>LTV/CAC 5x+</strong>: 매우 효율적 — 더 투자해도 됨
            </li>
            <li>
              <strong>3x ~ 5x</strong>: 양호 — 현 수준 유지
            </li>
            <li>
              <strong>1x ~ 3x</strong>: 손익분기 근처 — 활동 줄이거나 단가 인상 검토
            </li>
            <li>
              <strong>1x 미만</strong>: 손해 — 거래 정리 or 큐레이션 재시작
            </li>
            <li>
              <strong>CAC 가정</strong>: 시간당 5만원 (대표 기회 비용). 실제로는 회사 운영비 대비
              조정 가능
            </li>
            <li>
              <strong>긴 활동 기간 + 낮은 LTV</strong>: 시간만 잡아먹는 거래처 — 우선순위 조정
              필요
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
