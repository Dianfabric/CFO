/**
 * 자원 인수분해 (Phase 1 ⑪, PRD #3 ③)
 *
 * 비용을 4사분면으로 분해 — 변동/고정 × 재량/비재량.
 * 매출 위기 시 어디부터 줄여야 하는지 의사결정 가이드.
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, Wallet, AlertCircle, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/formatters'
import { resolvePeriod, isValidPeriod } from '@/lib/v11-period'
import {
  EXPENSE_VARIABILITY_LABEL,
  EXPENSE_DISCRETION_LABEL,
} from '@/lib/v11-labels'
import PeriodSelector, { type Period } from '@/components/v11/finance/PeriodSelector'
import QuadrantMatrix, {
  type QuadrantData,
} from '@/components/v11/expenses/QuadrantMatrix'
import ExpenseTrendChart, {
  type MonthlyExpense,
} from '@/components/v11/expenses/ExpenseTrendChart'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ExpenseRow {
  id: number
  expense_date: string
  category: string
  amount: number
  variability: string
  discretion: string
  team: string | null
  description: string | null
}

async function loadData(period: Period) {
  const range = resolvePeriod(period)

  try {
    const supabase = await createClient()

    // 현재 기간 비용
    const { data: expenses, error: e1 } = await supabase
      .from('expenses')
      .select('*')
      .gte('expense_date', range.start)
      .lte('expense_date', range.end)
      .order('expense_date', { ascending: false })

    // 월별 트렌드 (최근 12개월)
    const trendStart = new Date()
    trendStart.setMonth(trendStart.getMonth() - 11)
    trendStart.setDate(1)
    const trendStartStr = trendStart.toISOString().split('T')[0]

    const { data: trendData, error: e2 } = await supabase
      .from('expenses')
      .select('expense_date, amount, variability, discretion')
      .gte('expense_date', trendStartStr)

    return {
      range,
      expenses: (expenses ?? []) as ExpenseRow[],
      trendRaw: trendData ?? [],
      errors: [e1, e2].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      range,
      expenses: [] as ExpenseRow[],
      trendRaw: [],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function ExpensesPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const period: Period = isValidPeriod(sp.period) ? sp.period : 'this_month'
  const { range, expenses, trendRaw, errors } = await loadData(period)

  // 4사분면 집계
  const quadMap = new Map<string, QuadrantData>()
  for (const e of expenses) {
    const key = `${e.variability}|${e.discretion}`
    const cur = quadMap.get(key) ?? {
      variability: e.variability,
      discretion: e.discretion,
      amount: 0,
      count: 0,
    }
    cur.amount += Number(e.amount) || 0
    cur.count++
    quadMap.set(key, cur)
  }
  const quadData = Array.from(quadMap.values())

  // 카테고리별 합계 (Top 8)
  const catMap = new Map<string, { amount: number; count: number }>()
  for (const e of expenses) {
    const cur = catMap.get(e.category) ?? { amount: 0, count: 0 }
    cur.amount += Number(e.amount) || 0
    cur.count++
    catMap.set(e.category, cur)
  }
  const topCategories = Array.from(catMap.entries())
    .map(([category, agg]) => ({ category, ...agg }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)

  // 월별 트렌드 집계
  const monthMap = new Map<string, MonthlyExpense>()
  for (const t of trendRaw as Array<{
    expense_date: string
    amount: number
    variability: string
    discretion: string
  }>) {
    const monthKey = t.expense_date.slice(0, 7) + '-01' // YYYY-MM-01
    const cur = monthMap.get(monthKey) ?? {
      month: monthKey,
      variable: 0,
      fixed: 0,
      discretionary: 0,
      non_discretionary: 0,
    }
    const amt = Number(t.amount) || 0
    if (t.variability === 'variable') cur.variable += amt
    else if (t.variability === 'fixed') cur.fixed += amt
    if (t.discretion === 'discretionary') cur.discretionary += amt
    else if (t.discretion === 'non_discretionary') cur.non_discretionary += amt
    monthMap.set(monthKey, cur)
  }
  const monthlyTrend = Array.from(monthMap.values()).sort((a, b) =>
    b.month.localeCompare(a.month),
  )

  // KPI
  const total = quadData.reduce((s, q) => s + q.amount, 0)
  const variableTotal =
    quadData.find((q) => q.variability === 'variable')?.amount ??
    quadData
      .filter((q) => q.variability === 'variable')
      .reduce((s, q) => s + q.amount, 0)
  const fixedTotal = total - variableTotal
  const discretionaryTotal = quadData
    .filter((q) => q.discretion === 'discretionary')
    .reduce((s, q) => s + q.amount, 0)
  const nonDiscretionaryTotal = total - discretionaryTotal

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · Phase 1 ⑪
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">자원 인수분해</h1>
          <p className="mt-1 text-sm text-slate-500">
            {range.label} · 비용을 변동/고정 × 재량/비재량 4사분면으로 분해
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
                <p className="font-semibold">데이터 일부 오류:</p>
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {errors.slice(0, 3).map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI 4개 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">총 지출</span>
              <Wallet className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {formatKRW(total)}
            </div>
            <p className="text-[11px] text-slate-400">{expenses.length}건 거래</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">변동비</span>
              <Receipt className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-amber-700">
              {formatKRW(variableTotal)}
            </div>
            <p className="text-[11px] text-slate-400">
              {total > 0 ? ((variableTotal / total) * 100).toFixed(1) : '0'}% · 매출 비례
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">고정비</span>
              <Receipt className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-700">
              {formatKRW(fixedTotal)}
            </div>
            <p className="text-[11px] text-slate-400">
              {total > 0 ? ((fixedTotal / total) * 100).toFixed(1) : '0'}% · 손익분기 부담
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">재량 비용 (줄일 수 있는)</span>
              <Receipt className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-blue-700">
              {formatKRW(discretionaryTotal)}
            </div>
            <p className="text-[11px] text-slate-400">
              {total > 0 ? ((discretionaryTotal / total) * 100).toFixed(1) : '0'}% · 위기 시 우선
              조정
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4사분면 매트릭스 */}
      <Card>
        <CardHeader>
          <CardTitle>4사분면 분해</CardTitle>
          <CardDescription>
            변동(매출 비례) × 고정(매월 일정) · 재량(줄일 수 있음) × 비재량(필수)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {total > 0 ? (
            <QuadrantMatrix data={quadData} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              {range.label} 동안 비용 데이터가 없습니다
            </p>
          )}
        </CardContent>
      </Card>

      {/* 카테고리별 + 월별 트렌드 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 카테고리 Top 8 */}
        <Card>
          <CardHeader>
            <CardTitle>카테고리별 비중 (Top 8)</CardTitle>
            <CardDescription>{range.label} 비용 합계</CardDescription>
          </CardHeader>
          <CardContent>
            {topCategories.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">데이터 없음</p>
            ) : (
              <div className="space-y-2.5">
                {topCategories.map((c) => {
                  const ratio = total > 0 ? (c.amount / total) * 100 : 0
                  return (
                    <div key={c.category}>
                      <div className="mb-1 flex items-baseline justify-between text-xs">
                        <span className="font-medium text-slate-700">{c.category}</span>
                        <span className="tabular-nums text-slate-600">
                          {formatKRW(c.amount)}{' '}
                          <span className="text-[10px] text-slate-400">({ratio.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.min(ratio, 100)}%` }}
                        />
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{c.count}건</div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 월별 트렌드 */}
        <Card>
          <CardHeader>
            <CardTitle>월별 비용 트렌드</CardTitle>
            <CardDescription>최근 12개월 (변동/고정 누적)</CardDescription>
          </CardHeader>
          <CardContent>
            <ExpenseTrendChart data={monthlyTrend} />
          </CardContent>
        </Card>
      </div>

      {/* 상세 거래 (최근 50건) */}
      <Card>
        <CardHeader>
          <CardTitle>비용 상세</CardTitle>
          <CardDescription>{range.label} 최근 50건</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="px-4 py-2 text-left">날짜</th>
                  <th className="px-4 py-2 text-left">카테고리</th>
                  <th className="px-4 py-2 text-left">분류</th>
                  <th className="px-4 py-2 text-left">설명</th>
                  <th className="px-4 py-2 text-right">금액</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      비용 거래가 없습니다
                    </td>
                  </tr>
                ) : (
                  expenses.slice(0, 50).map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-1.5 text-slate-600">{e.expense_date}</td>
                      <td className="px-4 py-1.5 font-medium text-slate-700">{e.category}</td>
                      <td className="px-4 py-1.5 text-slate-500">
                        {EXPENSE_VARIABILITY_LABEL[e.variability]}·{' '}
                        {EXPENSE_DISCRETION_LABEL[e.discretion]}
                      </td>
                      <td className="px-4 py-1.5 max-w-xs truncate text-slate-600">
                        {e.description ?? '—'}
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums font-medium text-slate-700">
                        {formatKRW(Number(e.amount))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {expenses.length > 50 && (
            <p className="border-t px-4 py-2 text-center text-[11px] text-slate-400">
              +{expenses.length - 50}건 더 있음 (필터·검색 기능은 추후 추가)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
