/**
 * 사이클 변경 이력 (Phase 9 #1)
 * 과거 사이클들의 결과·학습을 시계열로 비교
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
  History,
  TrendingUp,
  TrendingDown,
  CheckCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()

    const { data: cycles } = await supabase
      .from('cycles')
      .select('*')
      .order('cycle_number', { ascending: false })
      .limit(20)

    // 각 사이클별 매출 집계
    const cyclesWithStats = await Promise.all(
      (cycles ?? []).map(async (c) => {
        const { data: tx } = await supabase
          .from('transactions')
          .select('total_amount, margin_amount, client_id')
          .gte('transaction_date', c.start_date)
          .lte('transaction_date', c.end_date)
          .in('stage', ['confirmed', 'shipping', 'delivered', 'paid'])
        const revenue = (tx ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0)
        const margin = (tx ?? []).reduce((s, t) => s + Number(t.margin_amount || 0), 0)
        const clients = new Set(
          (tx ?? []).map((t) => t.client_id).filter(Boolean) as number[],
        ).size
        return { ...c, revenue, margin, clients }
      }),
    )

    return { cycles: cyclesWithStats, error: null }
  } catch (e) {
    return { cycles: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export default async function HistoryPage() {
  const { cycles, error } = await loadData()

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
            v1.1 · #1 사이클 변경 이력
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <History className="h-5 w-5 text-slate-500" />
          사이클 변경 이력
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          과거 12주 사이클들의 결과·학습 시계열 비교
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {cycles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-400">
            아직 사이클 이력이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>사이클 비교</CardTitle>
            <CardDescription>최근 20개 — 매출·마진·거래처 추이</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="px-3 py-2 text-left">사이클</th>
                    <th className="px-3 py-2 text-left">기간</th>
                    <th className="px-3 py-2 text-left">상태</th>
                    <th className="px-3 py-2 text-right">매출</th>
                    <th className="px-3 py-2 text-right">공헌이익</th>
                    <th className="px-3 py-2 text-right">마진율</th>
                    <th className="px-3 py-2 text-right">거래처</th>
                    <th className="px-3 py-2 text-center">회고</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c, i) => {
                    const next = cycles[i + 1]
                    const revDelta =
                      next && next.revenue > 0
                        ? ((c.revenue - next.revenue) / next.revenue) * 100
                        : null
                    const marginRate = c.revenue > 0 ? (c.margin / c.revenue) * 100 : 0
                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-bold text-slate-700">
                          <Link
                            href={`/finance/cycle/summary?cycle_id=${c.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            #{c.cycle_number} →
                          </Link>
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">
                          {c.start_date} ~ {c.end_date}
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              c.status === 'active'
                                ? 'bg-blue-100 text-blue-700'
                                : c.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatKRW(c.revenue)}
                          {revDelta != null && (
                            <div
                              className={cn(
                                'text-[10px] font-semibold inline-flex items-center gap-0.5 ml-1',
                                revDelta >= 0 ? 'text-emerald-600' : 'text-rose-600',
                              )}
                            >
                              {revDelta >= 0 ? (
                                <TrendingUp className="h-2.5 w-2.5" />
                              ) : (
                                <TrendingDown className="h-2.5 w-2.5" />
                              )}
                              {Math.abs(revDelta).toFixed(0)}%
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatKRW(c.margin)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {marginRate.toFixed(1)}%
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {c.clients}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {c.retro_completed ? (
                            <CheckCircle className="inline h-4 w-4 text-emerald-500" />
                          ) : (
                            <span className="text-[10px] text-slate-400">미작성</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 학습 누적 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">학습 누적 (회고된 사이클)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {cycles.filter((c) => c.lessons_learned).length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-4">
              회고가 작성된 사이클이 없습니다.{' '}
              <Link href="/finance/cycle/retro" className="text-blue-600 hover:underline">
                회고 워크북
              </Link>
              에서 작성하세요.
            </p>
          ) : (
            cycles
              .filter((c) => c.lessons_learned)
              .map((c) => (
                <div
                  key={c.id}
                  className="rounded-md border border-blue-100 bg-blue-50/30 p-3 text-xs"
                >
                  <div className="font-semibold text-blue-700">사이클 #{c.cycle_number}</div>
                  <p className="mt-1 text-slate-700">{c.lessons_learned}</p>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
