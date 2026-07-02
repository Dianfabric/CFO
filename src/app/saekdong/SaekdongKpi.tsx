'use client'

/**
 * 색동 경영 지표 계기판 — 주/월/분기/년 전환.
 *
 * 매출(온라인 공급가 환산 + 오프라인) − 매출원가(기간 매입) − 변동비 − 고정비 흐름으로
 * 매출총이익 → 공헌이익 → 영업이익 → 순이익(+이익률)을 한 줄 타이포 계기판으로 표시.
 * 아래에 제품별 이익(올해, 평균 매입단가 × 판매수량 추정 원가) 표.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Gauge, Loader2 } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import type { SaekdongPurchase, SaekdongExpense } from './actions'

type Period = 'week' | 'month' | 'quarter' | 'year'

interface MonthlyPoint { month: string; revenue: number; orders: number }
interface ProductSales { prodName: string; revenue: number; qty: number }
interface SalesData {
  today: number; thisWeek: number; thisMonth: number; thisYear: number
  monthly: MonthlyPoint[]; products: ProductSales[]; productYear: string
  error?: string
}
interface OfflineData {
  today: number; thisWeek: number; thisMonth: number
  monthly: MonthlyPoint[]; error?: string
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
  { key: 'quarter', label: '분기' },
  { key: 'year', label: '년' },
]

function kstToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

/** 기간 시작일(YYYY-MM-DD)과 고정비 월배분 계수 */
function periodInfo(period: Period): { start: string; monthMult: number; label: string } {
  const today = kstToday()
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))]
  if (period === 'week') {
    const now = new Date(today + 'T00:00:00')
    const dow = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
    return { start: monday.toLocaleDateString('sv-SE'), monthMult: 12 / 52, label: '이번 주' }
  }
  if (period === 'month') {
    return { start: `${today.slice(0, 7)}-01`, monthMult: 1, label: '이번 달' }
  }
  if (period === 'quarter') {
    const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1
    return {
      start: `${y}-${String(qStartMonth).padStart(2, '0')}-01`,
      monthMult: m - qStartMonth + 1,
      label: `${Math.floor((m - 1) / 3) + 1}분기`,
    }
  }
  return { start: `${y}-01-01`, monthMult: m, label: `${y}년` }
}

/** 매출 데이터에서 기간 매출 추출 (온라인은 부가세 포함 → 호출부에서 환산) */
function periodRevenue(
  d: { thisWeek: number; thisMonth: number; monthly: MonthlyPoint[]; thisYear?: number },
  period: Period,
): number {
  const today = kstToday()
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))]
  if (period === 'week') return d.thisWeek
  if (period === 'month') return d.thisMonth
  if (period === 'quarter') {
    const qStart = Math.floor((m - 1) / 3) * 3 + 1
    const keys = [0, 1, 2].map((i) => `${y}-${String(qStart + i).padStart(2, '0')}`)
    return d.monthly.filter((mo) => keys.includes(mo.month)).reduce((s, mo) => s + mo.revenue, 0)
  }
  if (d.thisYear != null) return d.thisYear
  return d.monthly.filter((mo) => mo.month.startsWith(String(y))).reduce((s, mo) => s + mo.revenue, 0)
}

function normName(s: string): string {
  return String(s || '').replace(/\[[^\]]*\]/g, '').toLowerCase().replace(/\s+/g, '')
}

interface Props {
  purchases: SaekdongPurchase[]
  expenses: SaekdongExpense[]
}

export default function SaekdongKpi({ purchases, expenses }: Props) {
  const [period, setPeriod] = useState<Period>('month')
  const [sales, setSales] = useState<SalesData | null>(null)
  const [offline, setOffline] = useState<OfflineData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, o] = await Promise.all([
        fetch('/api/saekdong/sales').then((r) => r.json()),
        fetch('/api/saekdong/offline-sales').then((r) => r.json()),
      ])
      setSales(s)
      setOffline(o)
    } catch {
      // 지표는 부가 표시 — 실패 시 0 처리
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const m = useMemo(() => {
    const info = periodInfo(period)
    const curMonth = kstToday().slice(0, 7)

    // 매출 (공급가): 온라인 ÷1.1 + 오프라인
    const onlineRaw = sales && !sales.error ? periodRevenue(sales, period) : 0
    const offlineRaw = offline && !offline.error ? periodRevenue(offline, period) : 0
    const revenue = Math.round(onlineRaw / 1.1) + offlineRaw

    // 매출원가: 기간 매입 + 성격=매출원가 비용
    const inPeriod = (dt: string | null | undefined) => !!dt && dt >= info.start
    const monthlyActive = (e: SaekdongExpense) =>
      (!e.start_month || e.start_month <= curMonth) && (!e.end_month || e.end_month >= curMonth)
    const expSum = (filter: (e: SaekdongExpense) => boolean) =>
      Math.round(
        expenses
          .filter(filter)
          .reduce(
            (s, e) =>
              s + (e.is_monthly ? (monthlyActive(e) ? e.amount * info.monthMult : 0) : inPeriod(e.expense_date) ? e.amount : 0),
            0,
          ),
      )

    const cogs =
      purchases.filter((p) => inPeriod(p.purchase_date)).reduce((s, p) => s + p.amount, 0) +
      expSum((e) => e.nature === '매출원가')
    const variable = expSum((e) => e.cost_type === 'variable' && e.nature === '판관비')
    const fixed = expSum((e) => e.cost_type === 'fixed' && e.nature === '판관비')
    const nonOp = expSum((e) => e.nature === '영업외비용')

    const gross = revenue - cogs // 매출총이익
    const contribution = gross - variable // 공헌이익
    const operating = contribution - fixed // 영업이익
    const net = operating - nonOp // 순이익(근사)
    const rate = (v: number) => (revenue > 0 ? (v / revenue) * 100 : 0)

    return { info, revenue, cogs, variable, fixed, nonOp, gross, contribution, operating, net, rate }
  }, [period, sales, offline, purchases, expenses])

  // 제품별 이익 (올해) — 평균 매입단가 × 판매수량 추정
  const productProfit = useMemo(() => {
    if (!sales?.products) return []
    const costMap = new Map<string, { amt: number; qty: number }>()
    for (const p of purchases) {
      const k = normName(p.item_name)
      const cur = costMap.get(k) ?? { amt: 0, qty: 0 }
      cur.amt += p.amount
      cur.qty += Number(p.qty) || 0
      costMap.set(k, cur)
    }
    return sales.products.slice(0, 10).map((pr) => {
      const supply = Math.round(pr.revenue / 1.1)
      const c = costMap.get(normName(pr.prodName))
      const avgUnit = c && c.qty > 0 ? c.amt / c.qty : null
      const cost = avgUnit != null ? Math.round(avgUnit * pr.qty) : null
      const profit = cost != null ? supply - cost : null
      return {
        name: pr.prodName,
        supply,
        cost,
        profit,
        margin: profit != null && supply > 0 ? (profit / supply) * 100 : null,
      }
    })
  }, [sales, purchases])

  return (
    <div className="space-y-3">
      {/* 헤더 + 기간 버튼 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Gauge className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />
        <h2 className="text-base font-semibold" style={{ color: 'var(--nv-ink)' }}>
          색동 경영 지표
        </h2>
        <span className="text-xs" style={{ color: 'var(--nv-stone)' }}>
          · {m.info.label} · 공급가 기준
        </span>
        <div className="ml-auto inline-flex" style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px', overflow: 'hidden' }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className="h-8 px-3.5 text-[12px] font-bold transition-colors"
              style={{
                backgroundColor: period === p.key ? 'var(--nv-primary)' : 'white',
                color: period === p.key ? '#000' : 'var(--nv-mute)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 계기판 — 한 줄 타이포 스트립 */}
      <div
        className="px-4 py-5 sm:px-6"
        style={{ backgroundColor: '#000', borderRadius: '2px' }}
      >
        {loading ? (
          <p className="text-[13px] text-white/60 py-3">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            매출 데이터 불러오는 중... (첫 조회는 1분 정도 걸릴 수 있어요)
          </p>
        ) : (
          <div className="flex flex-wrap items-stretch gap-y-5">
            <Metric label="매출" value={m.revenue} big first />
            <Metric label="매출원가" value={m.cogs} negative dim />
            <Metric label="매출총이익" value={m.gross} rate={m.rate(m.gross)} />
            <Metric label="변동비" value={m.variable} negative dim />
            <Metric label="공헌이익" value={m.contribution} rate={m.rate(m.contribution)} />
            <Metric label="고정비" value={m.fixed} negative dim />
            <Metric label="영업이익" value={m.operating} rate={m.rate(m.operating)} big />
            <Metric label="순이익" value={m.net} rate={m.rate(m.net)} big />
          </div>
        )}
      </div>

      {/* 제품별 이익 (올해) */}
      <div className="bg-white p-4" style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}>
        <p className="text-[12px] font-bold mb-2" style={{ color: 'var(--nv-ink)' }}>
          제품별 이익{' '}
          <span className="font-normal text-[11px]" style={{ color: 'var(--nv-stone)' }}>
            · {sales?.productYear ?? ''}년 온라인 판매 기준 · 원가 = 평균 매입단가 × 판매수량 추정
          </span>
        </p>
        {loading ? (
          <p className="text-[12px] py-2" style={{ color: 'var(--nv-mute)' }}>불러오는 중...</p>
        ) : productProfit.length === 0 ? (
          <p className="text-[12px] italic" style={{ color: 'var(--nv-stone)' }}>판매 데이터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]" style={{ minWidth: 560 }}>
              <thead>
                <tr className="text-left" style={{ color: 'var(--nv-stone)', borderBottom: '1px solid var(--nv-hairline)' }}>
                  <th className="py-1.5 pr-2 font-medium">제품</th>
                  <th className="pr-2 font-medium text-right">매출(공급가)</th>
                  <th className="pr-2 font-medium text-right">추정 원가</th>
                  <th className="pr-2 font-medium text-right">이익</th>
                  <th className="font-medium text-right">이익률</th>
                </tr>
              </thead>
              <tbody>
                {productProfit.map((p) => (
                  <tr key={p.name} style={{ borderBottom: '1px solid var(--nv-hairline)' }}>
                    <td className="py-1.5 pr-2 font-medium" style={{ color: 'var(--nv-ink)' }}>{p.name}</td>
                    <td className="pr-2 text-right tabular-nums">{formatKRW(p.supply)}</td>
                    <td className="pr-2 text-right tabular-nums" style={{ color: 'var(--nv-mute)' }}>
                      {p.cost != null ? formatKRW(p.cost) : <span style={{ color: 'var(--nv-stone)' }}>원가 미입력</span>}
                    </td>
                    <td className="pr-2 text-right tabular-nums font-bold"
                      style={{ color: p.profit == null ? 'var(--nv-stone)' : p.profit >= 0 ? 'var(--nv-success-deep, #4a7c00)' : 'var(--nv-error)' }}>
                      {p.profit != null ? formatKRW(p.profit) : '-'}
                    </td>
                    <td className="text-right tabular-nums font-bold"
                      style={{ color: p.margin == null ? 'var(--nv-stone)' : p.margin >= 0 ? 'var(--nv-success-deep, #4a7c00)' : 'var(--nv-error)' }}>
                      {p.margin != null ? `${p.margin.toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[10px]" style={{ color: 'var(--nv-stone)' }}>
          온라인 매출은 부가세 제외 환산(÷1.1) · 매출원가는 기간 매입액 기준(재고 미반영) ·
          고정비는 월 등록액을 기간에 비례 배분 · 순이익은 이자·세금 반영 전 근사치입니다.
        </p>
      </div>
    </div>
  )
}

function Metric({
  label, value, rate, big, dim, negative, first,
}: {
  label: string
  value: number
  rate?: number
  big?: boolean
  dim?: boolean
  negative?: boolean
  first?: boolean
}) {
  const color = dim
    ? 'rgba(255,255,255,0.55)'
    : value >= 0
      ? big
        ? '#76b900'
        : '#ffffff'
      : '#f87171'
  return (
    <div
      className="px-4 sm:px-5 first:pl-0"
      style={{ borderLeft: first ? 'none' : '1px solid rgba(255,255,255,0.14)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {negative ? `(-) ${label}` : label}
      </p>
      <p
        className={`mt-1 font-bold tabular-nums leading-none ${big ? 'text-[24px] sm:text-[28px]' : 'text-[19px] sm:text-[22px]'}`}
        style={{ color }}
      >
        {formatKRW(Math.abs(value))}
      </p>
      {rate != null && (
        <p className="mt-1 text-[11px] font-bold tabular-nums" style={{ color: value >= 0 ? 'rgba(118,185,0,0.9)' : '#f87171' }}>
          {rate.toFixed(1)}%
        </p>
      )}
    </div>
  )
}
