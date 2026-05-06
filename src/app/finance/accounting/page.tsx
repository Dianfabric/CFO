/**
 * 회계법인 연동 (Phase 9 #3)
 * 월결산 자동 송부 (placeholder + 외부 연동 안내)
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
  ChevronLeft,
  FileText,
  Mail,
  Download,
  Send,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/formatters'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()

    // 지난 달
    const today = new Date()
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      .toISOString()
      .split('T')[0]
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      .toISOString()
      .split('T')[0]

    const [tx, expenses] = await Promise.all([
      supabase
        .from('transactions')
        .select('total_amount, total_cost, margin_amount, transaction_date, stage')
        .gte('transaction_date', lastMonthStart)
        .lte('transaction_date', lastMonthEnd),
      supabase
        .from('expenses')
        .select('amount, category, variability, discretion')
        .gte('expense_date', lastMonthStart)
        .lte('expense_date', lastMonthEnd),
    ])

    return {
      lastMonthStart,
      lastMonthEnd,
      revenue: (tx.data ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0),
      cogs: (tx.data ?? []).reduce((s, t) => s + Number(t.total_cost || 0), 0),
      margin: (tx.data ?? []).reduce((s, t) => s + Number(t.margin_amount || 0), 0),
      txCount: tx.data?.length ?? 0,
      opex: (expenses.data ?? []).reduce((s, e) => s + Number(e.amount || 0), 0),
      expensesByCategory: aggregateByCategory(expenses.data ?? []),
    }
  } catch {
    return {
      lastMonthStart: '',
      lastMonthEnd: '',
      revenue: 0,
      cogs: 0,
      margin: 0,
      txCount: 0,
      opex: 0,
      expensesByCategory: [] as Array<{ category: string; amount: number }>,
    }
  }
}

function aggregateByCategory(rows: Array<{ category: string; amount: number }>) {
  const map = new Map<string, number>()
  for (const r of rows) {
    map.set(r.category, (map.get(r.category) ?? 0) + Number(r.amount || 0))
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export default async function AccountingPage() {
  const data = await loadData()
  const operatingProfit = data.margin - data.opex

  return (
    <div className="space-y-6">
      <Link
        href="/finance"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        재무 메인
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #3 회계법인 연동
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <FileText className="h-5 w-5 text-slate-500" />
          회계법인 연동 (월결산)
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          매월 1일 자동으로 회계법인에 결산 자료 송부 (현재: 수동 export)
        </p>
      </div>

      {/* 지난 달 요약 (P&L 형식) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {data.lastMonthStart} ~ {data.lastMonthEnd} 월결산 요약
          </CardTitle>
          <CardDescription>회계법인 송부 전 사전 검토</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <PLRow label="매출" value={data.revenue} />
            <PLRow label="(-) 매출원가" value={-data.cogs} />
            <PLRow label="공헌이익" value={data.margin} bold />
            <PLRow label="(-) 영업비용" value={-data.opex} />
            <PLRow label="영업이익" value={operatingProfit} bold />
          </div>

          {data.expensesByCategory.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="text-[11px] font-semibold text-slate-500 mb-2">
                영업비용 카테고리별
              </div>
              <ul className="space-y-1 text-xs">
                {data.expensesByCategory.map((c) => (
                  <li key={c.category} className="flex justify-between">
                    <span className="text-slate-600">{c.category}</span>
                    <span className="tabular-nums">{formatKRW(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 송부 액션 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">월결산 송부</CardTitle>
          <CardDescription>회계법인에게 자료 전달</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled>
              <Download className="mr-1 h-3.5 w-3.5" />
              CSV 다운로드 (예정)
            </Button>
            <Button variant="outline" size="sm" disabled>
              <FileText className="mr-1 h-3.5 w-3.5" />
              PDF 결산서 (예정)
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Mail className="mr-1 h-3.5 w-3.5" />
              이메일 송부 (예정)
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Send className="mr-1 h-3.5 w-3.5" />
              자동 cron 활성화 (예정)
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">
            ⚠ 현재는 placeholder입니다. 실제 export·송부는 다음 단계에서 추가.
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 회계법인 연동 로드맵</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="ml-4 list-decimal space-y-1 text-xs text-slate-700">
            <li>
              <strong>1단계 (현재)</strong>: Supabase에 거래·비용 데이터 누적. 수동 export로 월결산
            </li>
            <li>
              <strong>2단계</strong>: CSV/PDF 자동 생성 → 회계법인 이메일 자동 송부
            </li>
            <li>
              <strong>3단계</strong>: 회계법인의 ERP/세무 시스템과 양방향 sync (분개·세금계산서)
            </li>
            <li>
              <strong>4단계</strong>: 회계법인 검토 결과 받아서 v1.1 시스템에 자동 반영
            </li>
          </ol>
          <p className="mt-2 text-[11px] text-slate-500">
            소규모 팀 환경에서는 2단계까지가 현실적. 3·4단계는 매출 5억+ 규모 이후 검토.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function PLRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-slate-200/60 pb-1 ${bold ? 'border-slate-300 pt-1' : ''}`}>
      <span className={bold ? 'font-bold text-slate-800' : 'text-slate-600'}>{label}</span>
      <span
        className={`tabular-nums ${bold ? 'font-bold text-slate-900' : 'text-slate-700'} ${
          value < 0 ? 'text-rose-600' : ''
        }`}
      >
        {formatKRW(value)}
      </span>
    </div>
  )
}
