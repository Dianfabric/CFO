/**
 * 자기자본 분석 (Phase 9 #3)
 * 매출 누적 vs 누적 비용 → 추정 자기자본 (placeholder + 외부 회계 데이터 안내)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, Wallet, TrendingUp, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const ytdStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const lastYearStart = new Date(new Date().getFullYear() - 1, 0, 1).toISOString().split('T')[0]
    const lastYearEnd = new Date(new Date().getFullYear() - 1, 11, 31).toISOString().split('T')[0]

    const [tx, expenses, txLastYear, expensesLastYear, ar] = await Promise.all([
      supabase
        .from('transactions')
        .select('total_amount, total_cost, margin_amount')
        .gte('transaction_date', ytdStart)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('expenses')
        .select('amount, variability, discretion')
        .gte('expense_date', ytdStart),
      supabase
        .from('transactions')
        .select('total_amount, margin_amount')
        .gte('transaction_date', lastYearStart)
        .lte('transaction_date', lastYearEnd)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', lastYearStart)
        .lte('expense_date', lastYearEnd),
      supabase.from('outstanding_payments').select('outstanding'),
    ])

    return {
      ytdRevenue: (tx.data ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0),
      ytdMargin: (tx.data ?? []).reduce((s, t) => s + Number(t.margin_amount || 0), 0),
      ytdCogs: (tx.data ?? []).reduce((s, t) => s + Number(t.total_cost || 0), 0),
      ytdOpex: (expenses.data ?? []).reduce((s, e) => s + Number(e.amount || 0), 0),
      lastYearRevenue: (txLastYear.data ?? []).reduce(
        (s, t) => s + Number(t.total_amount || 0),
        0,
      ),
      lastYearMargin: (txLastYear.data ?? []).reduce(
        (s, t) => s + Number(t.margin_amount || 0),
        0,
      ),
      lastYearOpex: (expensesLastYear.data ?? []).reduce((s, e) => s + Number(e.amount || 0), 0),
      ar: (ar.data ?? []).reduce((s, o) => s + Number(o.outstanding || 0), 0),
    }
  } catch {
    return {
      ytdRevenue: 0,
      ytdMargin: 0,
      ytdCogs: 0,
      ytdOpex: 0,
      lastYearRevenue: 0,
      lastYearMargin: 0,
      lastYearOpex: 0,
      ar: 0,
    }
  }
}

export default async function EquityPage() {
  const data = await loadData()

  const ytdOperatingProfit = data.ytdMargin - data.ytdOpex
  const lastYearOperatingProfit = data.lastYearMargin - data.lastYearOpex
  const ytdMarginRate = data.ytdRevenue > 0 ? (data.ytdMargin / data.ytdRevenue) * 100 : 0

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
            v1.1 · #3 자기자본 분석
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Wallet className="h-5 w-5 text-emerald-600" />
          자기자본 분석
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          올해 누적 손익 + 미수금 — 외부 회계 데이터 없이 운영 데이터로 추정
        </p>
      </div>

      {/* 올해 누적 손익 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">올해 누적 손익 (YTD)</CardTitle>
          <CardDescription>운영 매출·비용만 기반 — 정식 재무제표 아님</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="누적 매출 (YTD)" value={data.ytdRevenue} />
          <Row label="(-) 매출원가" value={-data.ytdCogs} />
          <Row label="공헌이익" value={data.ytdMargin} bold />
          <Row
            label={`(공헌이익률 ${ytdMarginRate.toFixed(1)}%)`}
            value={null}
            small
          />
          <Row label="(-) 영업비용" value={-data.ytdOpex} />
          <Row label="영업이익 (추정)" value={ytdOperatingProfit} bold />
        </CardContent>
      </Card>

      {/* 작년 비교 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">작년 동 기간 비교</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Comparison
              label="매출"
              current={data.ytdRevenue}
              prev={data.lastYearRevenue}
            />
            <Comparison
              label="공헌이익"
              current={data.ytdMargin}
              prev={data.lastYearMargin}
            />
            <Comparison
              label="영업이익"
              current={ytdOperatingProfit}
              prev={lastYearOperatingProfit}
            />
          </div>
        </CardContent>
      </Card>

      {/* 자산 현황 (단순) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">유동 자산·부채 추정</CardTitle>
          <CardDescription>운영 데이터로 추정 — 정확한 자기자본은 회계법인 결산 필요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="미수금 (받을 돈)" value={data.ar} />
          <Row label="누적 운영이익 (자본 증가분)" value={ytdOperatingProfit} bold />
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
            ⚠ 이 추정은 운영 데이터만 기반입니다. <strong>정확한 자기자본</strong>은 회계법인의
            대차대조표(재고·고정자산·차입금·자본금 포함) 필요.
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 자기자본 분석 가이드</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>운영이익 추세</strong>: 작년 대비 증감 — 회사 가치 변화의 가장 빠른 신호
            </li>
            <li>
              <strong>미수금</strong>: 받을 돈 — 회수 못하면 손실
            </li>
            <li>
              <strong>재고 자산</strong>: 인벤토리 페이지 데이터로 평가 (현재 수동)
            </li>
            <li>
              <strong>월별 결산 외부 자료</strong>: 회계법인 연동 페이지 통해 누적
            </li>
          </ul>
          <p className="mt-3 text-[11px] text-slate-500">
            <strong>다음 단계 (선택)</strong>: 회계법인 결산 데이터를 import해서 정확한 BS·IS·CF 표시 가능. 외부 시스템 연동 단계.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  small,
}: {
  label: string
  value: number | null
  bold?: boolean
  small?: boolean
}) {
  return (
    <div
      className={cn(
        'flex justify-between border-b border-slate-200/60 pb-1',
        bold && 'border-slate-300 pt-1',
        small && 'text-[11px] text-slate-500',
      )}
    >
      <span className={bold ? 'font-bold text-slate-800' : 'text-slate-600'}>{label}</span>
      {value != null && (
        <span
          className={cn(
            'tabular-nums',
            bold ? 'font-bold text-slate-900' : 'text-slate-700',
            value < 0 && 'text-rose-600',
          )}
        >
          {formatKRW(value)}
        </span>
      )}
    </div>
  )
}

function Comparison({
  label,
  current,
  prev,
}: {
  label: string
  current: number
  prev: number
}) {
  const delta = prev > 0 ? ((current - prev) / prev) * 100 : null
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-base font-bold tabular-nums text-slate-900">
        {formatKRW(current)}
      </div>
      <div className="text-[10px] text-slate-400">
        작년: {formatKRW(prev)}
      </div>
      {delta != null && (
        <div
          className={cn(
            'mt-1 flex items-center gap-0.5 text-[11px] font-semibold',
            delta >= 0 ? 'text-emerald-600' : 'text-rose-600',
          )}
        >
          <TrendingUp className="h-3 w-3" />
          {delta >= 0 ? '+' : ''}
          {delta.toFixed(0)}%
        </div>
      )}
    </div>
  )
}
