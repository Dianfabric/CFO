'use client'

/**
 * 색동 쇼핑몰 매출 섹션 — 아임웹 API 실시간 집계 표시.
 * 오늘/이번주/이번달 카드 + 일별 추이 차트 + 제품별 매출 표.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { ShoppingBag, RefreshCw, Loader2, Banknote, CheckCircle2 } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { fetchSharedSales } from './sharedFetch'
import type { SaekdongPurchase } from './actions'

interface MonthlyPoint {
  month: string // YYYY-MM
  revenue: number
  orders: number
}
interface ProductSales {
  prodName: string
  revenue: number
  qty: number
}
interface CategorySales {
  code: string
  name: string
  thisYearTotal: number
  monthly: MonthlyPoint[]
  products: ProductSales[]
}
interface SalesData {
  today: number
  thisWeek: number
  thisMonth: number
  thisYear: number
  monthly: MonthlyPoint[]
  products: ProductSales[]
  productYear: string
  categories: CategorySales[]
  orderCount: number
  fetchedAt: string
  error?: string
}

const ALL = '__all__'

// 아임웹 카테고리명 → 화면 표시명 (사장님 용어에 맞춤)
const CAT_LABEL: Record<string, string> = { saekdong: 'Fabric' }
const catLabel = (name: string) => CAT_LABEL[name] ?? name

// 결제수단 표시명
const PAY_LABEL: Record<string, string> = {
  npay: '네이버페이',
  card: '카드',
  trans: '계좌이체',
  vbank: '가상계좌',
  deposit: '무통장입금',
  phone: '휴대폰',
  kakaopay: '카카오페이',
}
const payLabel = (t: string) => PAY_LABEL[t] ?? (t || '기타')

interface UnconfirmedSale {
  orderNo: string
  date: string
  time: number
  amount: number
  payType: string
  imwebPaid: boolean
}
interface PgDeposit {
  date: string
  name: string
  amount: number
}
interface PayCheckData {
  since: string
  totalSales: number
  imwebPaidCount: number
  confirmedCount: number
  pgConfirmedCount: number
  pgDeposits: PgDeposit[]
  unconfirmed: UnconfirmedSale[]
  fetchedAt: string
  error?: string
}

// 품목명 정규화 — 매입 품목 ↔ 쇼핑몰 상품명 매칭용
function normName(s: string): string {
  return String(s || '').replace(/\[[^\]]*\]/g, '').toLowerCase().replace(/\s+/g, '')
}

export default function SaekdongSales({ purchases = [] }: { purchases?: SaekdongPurchase[] }) {
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeCat, setActiveCat] = useState<string>(ALL)
  const [payCheck, setPayCheck] = useState<PayCheckData | null>(null)
  const [payCheckLoading, setPayCheckLoading] = useState(true)

  const fetchData = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    try {
      const j = await fetchSharedSales<SalesData>(force)
      setData(j)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // 입금 확인 대사 — 매출 조회와 별도(가벼움), 새로고침 시 함께 갱신
  const fetchPayCheck = useCallback(async () => {
    setPayCheckLoading(true)
    try {
      const r = await fetch('/api/saekdong/payment-check', { cache: 'no-store' })
      const j = (await r.json()) as PayCheckData
      setPayCheck(j)
    } catch {
      setPayCheck(null)
    } finally {
      setPayCheckLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    fetchPayCheck()
  }, [fetchData, fetchPayCheck])

  // 품목별 평균 매입단가 (제품별 이익 계산용)
  const costMap = useMemo(() => {
    const map = new Map<string, { amt: number; qty: number }>()
    for (const p of purchases) {
      const k = normName(p.item_name)
      const cur = map.get(k) ?? { amt: 0, qty: 0 }
      cur.amt += p.amount
      cur.qty += Number(p.qty) || 0
      map.set(k, cur)
    }
    return map
  }, [purchases])

  if (loading) {
    return (
      <div
        className="bg-white p-6 text-center text-[12px]"
        style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px', color: 'var(--nv-mute)' }}
      >
        <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
        색동 쇼핑몰 매출 불러오는 중...
      </div>
    )
  }

  if (!data || data.error) {
    return (
      <div
        className="p-4 text-[12px]"
        style={{
          border: '1px solid var(--nv-error)',
          backgroundColor: '#fef2f2',
          color: 'var(--nv-error)',
          borderRadius: '2px',
        }}
      >
        ⚠ 매출 조회 실패{data?.error ? `: ${data.error}` : ''}
      </div>
    )
  }

  // 활성 카테고리 선택 (전체 vs 특정 카테고리)
  const cats = data.categories ?? []
  const activeCatObj = activeCat === ALL ? null : cats.find((c) => c.code === activeCat)
  const activeMonthly = activeCatObj ? activeCatObj.monthly : data.monthly
  const activeProducts = activeCatObj ? activeCatObj.products : data.products
  const monthlyLabel = activeCatObj ? `· ${data.productYear} 월별` : '· 최근 12개월'

  // 월 라벨: YYYY-MM → "26.6" (연도 2자리 + 월)
  const chartData = activeMonthly.map((m) => {
    const [y, mo] = m.month.split('-')
    return { label: `${y.slice(2)}.${Number(mo)}`, 매출: m.revenue }
  })
  const maxProdRevenue = Math.max(1, ...activeProducts.map((p) => p.revenue))

  return (
    <div className="space-y-4">
      {/* 헤더 + 새로고침 */}
      <div className="flex items-center gap-2">
        <ShoppingBag className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />
        <h2 className="text-base font-semibold" style={{ color: 'var(--nv-ink)' }}>
          색동 쇼핑몰 매출
        </h2>
        <span className="text-xs" style={{ color: 'var(--nv-stone)' }}>
          · 아임웹 실시간
        </span>
        <button
          type="button"
          onClick={() => {
            fetchData(true)
            fetchPayCheck()
          }}
          disabled={refreshing}
          className="ml-auto h-7 px-2 text-[11px] font-bold inline-flex items-center gap-1 bg-white transition-colors"
          style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px', color: 'var(--nv-mute)' }}
          title="지금 다시 불러오기"
        >
          {refreshing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          새로고침
        </button>
      </div>

      {/* 오늘 / 이번주 / 이번달 / 이번년 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SalesCard label="오늘 매출" value={data.today} accent />
        <SalesCard label="이번 주 매출" value={data.thisWeek} />
        <SalesCard label="이번 달 매출" value={data.thisMonth} />
        <SalesCard label={`${data.productYear}년 매출`} value={data.thisYear} accent />
      </div>

      {/* 카테고리 탭 — 전체 + 매출 있는 카테고리 (월별 추이·제품 그래프에 적용) */}
      {cats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[{ code: ALL, name: '전체' }, ...cats].map((c) => {
            const active = activeCat === c.code
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => setActiveCat(c.code)}
                className="h-7 px-3 text-[12px] font-bold transition-colors"
                style={{
                  borderRadius: '2px',
                  border: `1px solid ${active ? 'var(--nv-primary)' : 'var(--nv-hairline)'}`,
                  backgroundColor: active ? 'var(--nv-primary)' : 'white',
                  color: active ? '#000' : 'var(--nv-mute)',
                }}
              >
                {c.code === ALL ? c.name : catLabel(c.name)}
              </button>
            )
          })}
        </div>
      )}

      {/* 월별 추이 + 제품별 — 한 줄 (2열) — 카테고리 탭 반영 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 연도별 월별 매출 추이 */}
        <div
          className="bg-white p-4"
          style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}
        >
          <h3 className="text-[13px] font-bold mb-3" style={{ color: 'var(--nv-ink)' }}>
            월별 매출 추이{' '}
            <span className="text-[11px] font-normal" style={{ color: 'var(--nv-stone)' }}>
              {monthlyLabel}
            </span>
          </h3>
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#999' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#999' }}
                  tickFormatter={(v: number) =>
                    v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`
                  }
                  width={44}
                />
                <Tooltip
                  formatter={(v) => formatKRW(Number(v))}
                  labelStyle={{ fontSize: 11 }}
                  contentStyle={{ fontSize: 12, borderRadius: 2 }}
                />
                <Bar dataKey="매출" fill="#76b900" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 올해 제품별 매출 */}
        <div
          className="bg-white p-4"
          style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}
        >
          <h3 className="text-[13px] font-bold mb-3" style={{ color: 'var(--nv-ink)' }}>
            {data.productYear}년 제품 매출{' '}
            <span className="text-[11px] font-normal" style={{ color: 'var(--nv-stone)' }}>
              · 올해 주문 총합
            </span>
          </h3>
          {activeProducts.length === 0 ? (
            <p className="text-[12px] italic" style={{ color: 'var(--nv-stone)' }}>
              {data.productYear}년 제품 매출 데이터가 없습니다.
            </p>
          ) : (
            <div className="space-y-1.5">
              {activeProducts.map((p) => {
                const rate = (p.revenue / maxProdRevenue) * 100
                // 이익 = 공급가(÷1.1) − 평균 매입단가 × 판매수량
                const supply = Math.round(p.revenue / 1.1)
                const c = costMap.get(normName(p.prodName))
                const avgUnit = c && c.qty > 0 ? c.amt / c.qty : null
                const profit = avgUnit != null ? supply - Math.round(avgUnit * p.qty) : null
                const margin = profit != null && supply > 0 ? (profit / supply) * 100 : null
                return (
                  <div key={p.prodName} className="flex items-center gap-2 text-[12px]">
                    <span
                      className="w-24 shrink-0 truncate font-medium"
                      style={{ color: 'var(--nv-ink)' }}
                      title={p.prodName}
                    >
                      {p.prodName}
                    </span>
                    <div
                      className="flex-1 h-4 relative overflow-hidden"
                      style={{ backgroundColor: 'var(--nv-surface-soft)', borderRadius: '2px' }}
                    >
                      <div
                        className="h-full"
                        style={{ width: `${rate}%`, backgroundColor: 'var(--nv-primary)' }}
                      />
                    </div>
                    <span
                      className="w-20 shrink-0 text-right tabular-nums font-bold"
                      style={{ color: 'var(--nv-ink)' }}
                    >
                      {formatKRW(p.revenue)}
                    </span>
                    <span
                      className="w-10 shrink-0 text-right tabular-nums"
                      style={{ color: 'var(--nv-stone)' }}
                    >
                      {p.qty}개
                    </span>
                    {/* 이익 · 이익률 (매입 입력 시 자동) */}
                    <span
                      className="w-28 shrink-0 text-right tabular-nums text-[11px] font-bold"
                      title={
                        profit != null
                          ? `이익 ${formatKRW(profit)} · 이익률 ${margin!.toFixed(1)}% (공급가 기준)`
                          : '매입(원가) 미입력'
                      }
                      style={{
                        color:
                          profit == null
                            ? 'var(--nv-stone)'
                            : profit >= 0
                              ? 'var(--nv-success-deep, #4a7c00)'
                              : 'var(--nv-error)',
                      }}
                    >
                      {profit != null ? (
                        <>
                          {formatKRW(profit)}{' '}
                          <span className="font-normal">· {margin!.toFixed(0)}%</span>
                        </>
                      ) : (
                        '원가 미입력'
                      )}
                    </span>
                  </div>
                )
              })}
              <p className="pt-1 text-[10px]" style={{ color: 'var(--nv-stone)' }}>
                이익 = 공급가(÷1.1) − 평균 매입단가 × 수량 · 매입·비용에서 매입을 입력하면
                자동 계산됩니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 입금 확인 — 아임웹 매출 ↔ 통장 내역 자동 대사 (7월 시행) */}
      <div
        className="bg-white p-4"
        style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}
      >
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <Banknote className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />
          <h3 className="text-[13px] font-bold" style={{ color: 'var(--nv-ink)' }}>
            입금 확인
          </h3>
          <span className="text-[11px]" style={{ color: 'var(--nv-stone)' }}>
            · {payCheck?.since ?? '2026-07-01'}부터 · 통장 내역 업로드와 자동 대사
          </span>
          {payCheck && !payCheck.error && (
            <span
              className="ml-auto text-[11px] font-bold tabular-nums"
              style={{ color: 'var(--nv-mute)' }}
            >
              매출 {payCheck.totalSales}건 · 아임웹 결제 {payCheck.imwebPaidCount}건 · 통장 확인{' '}
              {payCheck.confirmedCount + payCheck.pgConfirmedCount}건
              {payCheck.pgConfirmedCount > 0 && ` (PG 정산 ${payCheck.pgConfirmedCount}건 포함)`}
            </span>
          )}
        </div>
        {payCheckLoading ? (
          <p className="text-[12px] py-2" style={{ color: 'var(--nv-mute)' }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />
            입금 대사 중...
          </p>
        ) : !payCheck || payCheck.error ? (
          <p className="text-[12px] py-1" style={{ color: 'var(--nv-error)' }}>
            ⚠ 입금 대사 실패{payCheck?.error ? `: ${payCheck.error}` : ''}
          </p>
        ) : payCheck.totalSales === 0 ? (
          <p className="text-[12px] py-1" style={{ color: 'var(--nv-stone)' }}>
            {payCheck.since} 이후 매출이 아직 없습니다.
          </p>
        ) : payCheck.unconfirmed.length === 0 ? (
          <p
            className="text-[12px] py-1 inline-flex items-center gap-1.5 font-medium"
            style={{ color: 'var(--nv-success-deep, #4a7c00)' }}
          >
            <CheckCircle2 className="w-4 h-4" />
            모든 매출의 통장 입금이 확인되었습니다.
          </p>
        ) : (
          <>
            <p className="text-[11px] mb-2" style={{ color: 'var(--nv-error)' }}>
              통장 입금 미확인 {payCheck.unconfirmed.length}건 · 합계{' '}
              {formatKRW(payCheck.unconfirmed.reduce((s, u) => s + u.amount, 0))}
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {payCheck.unconfirmed.map((u) => (
                <div key={u.orderNo} className="flex items-center gap-2 text-[12px]">
                  <span className="w-12 shrink-0 tabular-nums" style={{ color: 'var(--nv-stone)' }}>
                    {u.date.slice(5).replace('-', '.')}
                  </span>
                  <span
                    className="w-20 shrink-0 truncate"
                    style={{ color: 'var(--nv-mute)' }}
                  >
                    {payLabel(u.payType)}
                  </span>
                  {/* 아임웹 결제 상태 */}
                  <span
                    className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold"
                    style={
                      u.imwebPaid
                        ? {
                            backgroundColor: 'rgba(118, 185, 0, 0.12)',
                            color: 'var(--nv-success-deep, #4a7c00)',
                            borderRadius: '2px',
                          }
                        : {
                            backgroundColor: '#fff7ed',
                            color: '#c2410c',
                            borderRadius: '2px',
                          }
                    }
                  >
                    {u.imwebPaid ? '아임웹 결제 ✓' : '아임웹 입금대기'}
                  </span>
                  <span
                    className="flex-1 truncate text-[11px]"
                    style={{ color: 'var(--nv-stone)' }}
                    title={`주문번호 ${u.orderNo}`}
                  >
                    주문 …{u.orderNo.slice(-7)}
                  </span>
                  <span
                    className="shrink-0 text-right tabular-nums font-bold"
                    style={{ color: 'var(--nv-error)' }}
                  >
                    {formatKRW(u.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {payCheck && !payCheck.error && payCheck.pgDeposits.length > 0 && (
          <div
            className="mt-3 pt-2"
            style={{ borderTop: '1px solid var(--nv-hairline)' }}
          >
            <p className="text-[11px] font-bold mb-1" style={{ color: 'var(--nv-mute)' }}>
              최근 PG 정산 입금 (통장)
            </p>
            <div className="space-y-1">
              {payCheck.pgDeposits.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="w-12 shrink-0 tabular-nums" style={{ color: 'var(--nv-stone)' }}>
                    {d.date.slice(5).replace('-', '.')}
                  </span>
                  <span className="flex-1 truncate" style={{ color: 'var(--nv-mute)' }}>
                    {d.name}
                  </span>
                  <span
                    className="shrink-0 tabular-nums font-bold"
                    style={{ color: 'var(--nv-ink)' }}
                  >
                    {formatKRW(d.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="mt-2 text-[10px]" style={{ color: 'var(--nv-stone)' }}>
          <b>아임웹 결제 ✓</b> = 쇼핑몰에서 고객 결제 완료 · <b>통장 확인</b> = 실제 계좌 입금
          확인(정확 일치 + PG 묶음 정산). 네이버파이낸셜 등 PG 정산 입금은 수수료가 차감돼도
          주문 조합과 자동 대사합니다. 경영 계기판에 통장 내역을 업로드하면 확인된 매출은
          자동으로 사라집니다.
        </p>
      </div>

      <p className="text-[10px] text-right" style={{ color: 'var(--nv-stone)' }}>
        갱신: {new Date(data.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · 총{' '}
        {data.orderCount}건
      </p>
    </div>
  )
}

function SalesCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className="bg-white p-4"
      style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--nv-mute)' }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-[24px] font-bold tabular-nums leading-none"
        style={{ color: accent ? 'var(--nv-primary)' : 'var(--nv-ink)' }}
      >
        {formatKRW(value)}
      </p>
    </div>
  )
}
