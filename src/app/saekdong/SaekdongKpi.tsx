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
import { fetchSharedSales, fetchSharedOffline } from './sharedFetch'
import type { SaekdongPurchase, SaekdongExpense, SaekdongItemCost } from './actions'

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
  itemCosts?: SaekdongItemCost[]
}

export default function SaekdongKpi({ purchases, expenses, itemCosts = [] }: Props) {
  const [period, setPeriod] = useState<Period>('month')
  const [sales, setSales] = useState<SalesData | null>(null)
  const [offline, setOffline] = useState<OfflineData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      // 매출 섹션과 같은 요청을 공유 (아임웹 호출 제한 보호 — 페이지당 1회)
      const [s, o] = await Promise.all([
        fetchSharedSales<SalesData>(),
        fetchSharedOffline<OfflineData>(),
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

    // 기준단가 기반 추정 매출원가 — 매입 기록이 없는 품목만.
    // 올해 (판매수량 × 기준단가) 로 원가율을 구해 기간 온라인 매출에 비례 배분
    // (년 선택 시 = 올해 추정 원가 그대로).
    const purchasedKeys = new Set(purchases.map((p) => normName(p.item_name)))
    const stdMap = new Map(itemCosts.map((c) => [normName(c.item_name), c.unit_cost]))
    let yearStdCogs = 0
    if (sales && !sales.error) {
      for (const pr of sales.products ?? []) {
        const k = normName(pr.prodName)
        if (purchasedKeys.has(k)) continue
        const uc = stdMap.get(k)
        if (uc != null) yearStdCogs += uc * pr.qty
      }
    }
    const yearOnlineSupply =
      sales && !sales.error ? Math.round((sales.thisYear ?? 0) / 1.1) : 0
    const stdRate = yearOnlineSupply > 0 ? yearStdCogs / yearOnlineSupply : 0
    const stdCogs = Math.round((onlineRaw / 1.1) * stdRate)

    const cogs =
      purchases.filter((p) => inPeriod(p.purchase_date)).reduce((s, p) => s + p.amount, 0) +
      expSum((e) => e.nature === '매출원가') +
      stdCogs
    const variable = expSum((e) => e.cost_type === 'variable' && e.nature === '판관비')
    const fixed = expSum((e) => e.cost_type === 'fixed' && e.nature === '판관비')
    const nonOp = expSum((e) => e.nature === '영업외비용')

    const gross = revenue - cogs // 매출총이익
    const contribution = gross - variable // 공헌이익
    const operating = contribution - fixed // 영업이익
    // 세전이익 = 영업이익 − 영업외비용 (영업외수익·법인세는 법인 단위 — 사업부 지표에선 제외)
    const pretax = operating - nonOp
    const rate = (v: number) => (revenue > 0 ? (v / revenue) * 100 : 0)

    return { info, revenue, cogs, variable, fixed, nonOp, gross, contribution, operating, pretax, rate }
  }, [period, sales, offline, purchases, expenses, itemCosts])

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
          <>
            <div className="flex flex-wrap items-stretch gap-y-5">
              <Metric label="매출" value={m.revenue} big first />
              <Metric label="매출원가" value={m.cogs} negative dim />
              <Metric label="매출총이익" value={m.gross} rate={m.rate(m.gross)} />
              <Metric label="변동비" value={m.variable} negative dim />
              <Metric label="공헌이익" value={m.contribution} rate={m.rate(m.contribution)} />
              <Metric label="고정비" value={m.fixed} negative dim />
              <Metric label="영업이익" value={m.operating} rate={m.rate(m.operating)} big />
              {/* 영업외비용이 실제 등록된 경우에만 세전이익까지 표시 */}
              {m.nonOp > 0 && (
                <>
                  <Metric label="영업외비용" value={m.nonOp} negative dim />
                  <Metric label="세전이익" value={m.pretax} rate={m.rate(m.pretax)} big />
                </>
              )}
            </div>
            {(sales?.error || offline?.error) && (
              <p className="mt-3 text-[11px] font-medium" style={{ color: '#fbbf24' }}>
                ⚠ {sales?.error ? '온라인' : '오프라인'} 매출 조회 실패 — 위 지표는 일부 매출이
                빠진 값입니다. 잠시 후 새로고침 해주세요.
              </p>
            )}
          </>
        )}
      </div>

      <p className="text-[10px] text-right" style={{ color: 'var(--nv-stone)' }}>
        온라인 매출 부가세 제외 환산(÷1.1) · 매출원가 = 기간 매입액 + 기준단가×판매수량
        추정(재고 미반영) · 고정비 월 등록액 기간 비례 배분 · 영업외비용 등록 시 세전이익
        표시 (영업외수익·법인세는 법인 단위라 사업부 지표에서 제외) · 제품별 이익은 아래 ‘
        {sales?.productYear ?? '올해'}년 제품 매출’에 표시
      </p>
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
