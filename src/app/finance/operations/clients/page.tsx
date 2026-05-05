/**
 * 디자이너별 샘플 사용 패턴 (Phase 4 #2c)
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
  TrendingUp,
  TrendingDown,
  Package,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CLIENT_TIER_COLOR, CLIENT_TIER_LABEL, SALES_STAGE_LABEL } from '@/lib/v11-labels'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface AnalyticsRow {
  client_id: number
  client_name: string
  current_stage: string | null
  tier: string | null
  total_requests: number
  total_items: number
  returned_count: number
  lost_count: number
  converted_count: number
  total_conversion_value: number
  total_sample_cost: number
  conversion_rate: number
  most_recent_request: string | null
}

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('client_sample_analytics')
      .select('*')
      .gt('total_items', 0)
      .order('total_conversion_value', { ascending: false })
      .limit(100)
    return { items: (data ?? []) as AnalyticsRow[], error: error?.message ?? null }
  } catch (e) {
    return {
      items: [] as AnalyticsRow[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function DesignerPatternsPage() {
  const { items, error } = await loadData()

  // 종합 통계
  const totals = items.reduce(
    (acc, c) => {
      acc.requests += Number(c.total_requests || 0)
      acc.items += Number(c.total_items || 0)
      acc.converted += Number(c.converted_count || 0)
      acc.value += Number(c.total_conversion_value || 0)
      acc.cost += Number(c.total_sample_cost || 0)
      return acc
    },
    { requests: 0, items: 0, converted: 0, value: 0, cost: 0 },
  )
  const overallConv = totals.items > 0 ? (totals.converted / totals.items) * 100 : 0
  const overallROI = totals.cost > 0 ? totals.value / totals.cost : 0

  return (
    <div className="space-y-6">
      <Link
        href="/finance/operations"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        운영 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2c 디자이너별 패턴
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">디자이너별 샘플 사용 패턴</h1>
        <p className="mt-1 text-sm text-slate-500">
          어느 거래처가 샘플을 잘 활용해 거래로 전환하는가? — 큐레이션 효율 분석
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* 종합 KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">활성 디자이너</div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {items.length}
            </div>
            <p className="text-[11px] text-slate-400">샘플 발송 이력 있음</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">총 샘플</div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {totals.items}
            </div>
            <p className="text-[11px] text-slate-400">{totals.requests}건 요청</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">평균 전환율</div>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                overallConv >= 30 ? 'text-emerald-700' : 'text-slate-900',
              )}
            >
              {overallConv.toFixed(1)}%
            </div>
            <p className="text-[11px] text-slate-400">
              전환 {totals.converted} / 발송 {totals.items}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">샘플 ROI</div>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                overallROI >= 5 ? 'text-emerald-700' : 'text-amber-700',
              )}
            >
              {overallROI.toFixed(1)}x
            </div>
            <p className="text-[11px] text-slate-400">
              {formatKRW(totals.value)} ÷ {formatKRW(totals.cost)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 디자이너 리스트 */}
      <Card>
        <CardHeader>
          <CardTitle>거래처별 샘플 패턴</CardTitle>
          <CardDescription>전환 매출 기준 정렬</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Package className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">
                아직 샘플 데이터가 없습니다.{' '}
                <Link href="/finance/operations/samples" className="text-blue-600 hover:underline">
                  샘플 요청
                </Link>
                을 시작하면 패턴이 누적됩니다.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="px-3 py-2 text-left">거래처</th>
                    <th className="px-3 py-2 text-left">단계 / 등급</th>
                    <th className="px-3 py-2 text-right">발송</th>
                    <th className="px-3 py-2 text-right">반환</th>
                    <th className="px-3 py-2 text-right">분실</th>
                    <th className="px-3 py-2 text-right">전환</th>
                    <th className="px-3 py-2 text-right">전환율</th>
                    <th className="px-3 py-2 text-right">전환 매출</th>
                    <th className="px-3 py-2 text-right">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => {
                    const roi =
                      Number(c.total_sample_cost) > 0
                        ? Number(c.total_conversion_value) / Number(c.total_sample_cost)
                        : 0
                    const conv = Number(c.conversion_rate)
                    return (
                      <tr
                        key={c.client_id}
                        className="border-b last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-3 py-1.5">
                          <Link
                            href={`/finance/sales/clients/${c.client_id}`}
                            className="font-semibold text-slate-700 hover:underline"
                          >
                            {c.client_name}
                          </Link>
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {c.current_stage && (
                              <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">
                                {SALES_STAGE_LABEL[c.current_stage]?.split('. ')[1] ?? c.current_stage}
                              </span>
                            )}
                            {c.tier && (
                              <span
                                className={cn(
                                  'rounded px-1 py-0.5 text-[10px] font-semibold',
                                  CLIENT_TIER_COLOR[c.tier] ?? 'bg-slate-100',
                                )}
                              >
                                {CLIENT_TIER_LABEL[c.tier] ?? c.tier}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{c.total_items}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-amber-700">
                          {c.returned_count}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-rose-600">
                          {c.lost_count}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">
                          {c.converted_count}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          <span
                            className={cn(
                              'rounded px-1 py-0.5 text-[10px] font-semibold',
                              conv >= 30
                                ? 'bg-emerald-100 text-emerald-700'
                                : conv >= 15
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {conv.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">
                          {formatKRW(Number(c.total_conversion_value))}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          <span
                            className={cn(
                              'flex items-center justify-end gap-0.5 text-[11px] font-semibold',
                              roi >= 5
                                ? 'text-emerald-700'
                                : roi >= 1
                                ? 'text-amber-700'
                                : 'text-slate-500',
                            )}
                          >
                            {roi >= 1 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {roi.toFixed(1)}x
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 디자이너 패턴 활용</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>전환율 30%+</strong>: 우수 — 큐레이션이 정확. 더 자주 보내라
            </li>
            <li>
              <strong>전환율 15-30%</strong>: 평균 — 큐레이션 컨셉 다듬기 필요
            </li>
            <li>
              <strong>전환율 15% 미만</strong>: 큐레이션 미스매치 — 선호 분석 재시작
            </li>
            <li>
              <strong>분실율 높음</strong>: 디자이너가 관심 없음 → 라이프사이클 &quot;이탈 위험&quot;
              검토
            </li>
            <li>
              <strong>ROI 5x+</strong>: 샘플 비용 1만원당 5만원 매출 — 디안 운영의 건강한 수준
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
