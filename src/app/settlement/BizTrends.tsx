'use client'

/**
 * 경영 그래프 — 사업체별 매출·지출·이익 흐름 + 출고 축 분석.
 *
 * ① 추이 그래프: 통합(본체+색동+법인 예정) / 디안 본체 / 엔에이아이디 탭,
 *    주별(12주)·월별(12개월)·년도별 — 매출·지출 막대 + 이익 선
 * ② 직군별·품목별·가공별 매출 그래프 (마감 출고 데이터, 30/90/180일)
 *
 * 본체 숫자는 /api/settlement/trend, 색동·디안몰은 아임웹 공유 캐시 합성.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, BarChart, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { LineChart as LineChartIcon, Loader2 } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { fetchSharedSales, fetchSharedOffline, fetchSharedDianShop } from '@/app/saekdong/sharedFetch'
import { listSaekdongCosts } from '@/app/saekdong/actions'
import type { SaekdongPurchase, SaekdongExpense, SaekdongItemCost } from '@/app/saekdong/actions'
import { HISTORY_SALES } from './history-sales'

const LIVE_FROM = 2026 // 이 해부터 시스템 실시간 — 이전은 관리 장부 아카이브로 백필

const box: React.CSSProperties = { border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }

type Unit = 'week' | 'month' | 'quarter' | 'half' | 'year'
type Entity = 'total' | 'body' | 'naid'

interface TrendBucket {
  key: string
  label: string
  start: string
  end: string
  sales: number
  fabricCogs: number
  expenses: number
  shipping: number
  fixed: number
  interest: number
  naidCost?: number
  naidSales?: number
  naidCogs?: number
}

interface SeriesData {
  monthly: { month: string; revenue: number }[]
  thisWeek: number
  thisYear?: number
  products?: { prodName: string; revenue: number; qty: number }[]
  error?: string
}

interface AggRow { name: string; amount: number; count: number }
interface MagamData {
  byIndustry: AggRow[]
  byProduct: AggRow[]
  byProcess: AggRow[]
  error?: string
}

const UNITS: { key: Unit; label: string }[] = [
  { key: 'week', label: '주별' },
  { key: 'month', label: '월별' },
  { key: 'quarter', label: '분기별' },
  { key: 'half', label: '반기별' },
  { key: 'year', label: '년도별' },
]
const ENTITIES: { key: Entity; label: string }[] = [
  { key: 'total', label: '통합 (본체+색동)' },
  { key: 'body', label: '디안 본체' },
  { key: 'naid', label: '엔에이아이디 (법인)' },
]

function kstToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

/** 버킷이 걸친 월 목록 + 일수 (진행 중인 달은 경과 일수 기준) */
function monthOverlaps(start: string, end: string): { ym: string; days: number; daysInMonth: number }[] {
  const today = kstToday()
  const out: { ym: string; days: number; daysInMonth: number }[] = []
  const cur = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  while (cur <= e) {
    const ym = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
    const found = out.find((o) => o.ym === ym)
    if (found) found.days += 1
    else {
      const daysInMonth =
        ym === today.slice(0, 7)
          ? Number(today.slice(8, 10))
          : new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()
      out.push({ ym, days: 1, daysInMonth: Math.max(1, daysInMonth) })
    }
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

/** 월 시계열에서 버킷 매출 — 주는 일할 배분, 월/년은 월 합 */
function bucketRevenue(map: Map<string, number>, overlaps: ReturnType<typeof monthOverlaps>, unit: Unit): number {
  if (unit !== 'week') {
    const yms = new Set(overlaps.map((o) => o.ym))
    return [...yms].reduce((s, ym) => s + (map.get(ym) ?? 0), 0)
  }
  return Math.round(overlaps.reduce((s, o) => s + (map.get(o.ym) ?? 0) * (o.days / o.daysInMonth), 0))
}

export default function BizTrends() {
  const [unit, setUnit] = useState<Unit>('month')
  const [entity, setEntity] = useState<Entity>('total')
  const [trends, setTrends] = useState<Partial<Record<Unit, TrendBucket[]>>>({})
  const [saekOn, setSaekOn] = useState<SeriesData | null>(null)
  const [saekOff, setSaekOff] = useState<SeriesData | null>(null)
  const [dianShop, setDianShop] = useState<SeriesData | null>(null)
  const [saekCosts, setSaekCosts] = useState<{
    purchases: SaekdongPurchase[]
    expenses: SaekdongExpense[]
    itemCosts: SaekdongItemCost[]
  } | null>(null)

  // 마감 축 분석
  const [magamDays, setMagamDays] = useState<number>(90)
  const [magam, setMagam] = useState<MagamData | null>(null)
  const [magamLoading, setMagamLoading] = useState(true)

  // 아임웹·색동 비용 (공유 캐시 — 페이지당 1회)
  useEffect(() => {
    fetchSharedSales<SeriesData>().then(setSaekOn).catch(() => {})
    fetchSharedOffline<SeriesData>().then(setSaekOff).catch(() => {})
    fetchSharedDianShop<SeriesData>().then(setDianShop).catch(() => {})
    listSaekdongCosts()
      .then((sc) => setSaekCosts({ purchases: sc.purchases, expenses: sc.expenses, itemCosts: sc.itemCosts }))
      .catch(() => {})
  }, [])

  // 추이 (단위별 1회 캐시)
  useEffect(() => {
    if (trends[unit]) return
    fetch(`/api/settlement/trend?unit=${unit}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error && d.buckets) setTrends((prev) => ({ ...prev, [unit]: d.buckets }))
      })
      .catch(() => {})
  }, [unit, trends])

  // 마감 축 분석
  const loadMagam = useCallback(async (d: number) => {
    setMagamLoading(true)
    try {
      const r = await fetch(`/api/magam-insights?days=${d}`)
      setMagam(await r.json())
    } catch {
      setMagam(null)
    } finally {
      setMagamLoading(false)
    }
  }, [])
  useEffect(() => { loadMagam(magamDays) }, [magamDays, loadMagam])

  // ── 사업체별 시리즈 합성 ──
  const chartData = useMemo(() => {
    const buckets = trends[unit]
    if (!buckets) return null
    const onMap = new Map((saekOn?.monthly ?? []).map((x) => [x.month, x.revenue]))
    const offMap = new Map((saekOff?.monthly ?? []).map((x) => [x.month, x.revenue]))
    const shopMap = new Map((dianShop?.monthly ?? []).map((x) => [x.month, x.revenue]))

    // 색동 기준단가 원가율 (연간) — 매입 기록 없는 품목만
    const purchases = saekCosts?.purchases ?? []
    const expenses = saekCosts?.expenses ?? []
    const itemCosts = saekCosts?.itemCosts ?? []
    const norm = (s: string) => String(s || '').replace(/\[[^\]]*\]/g, '').toLowerCase().replace(/\s+/g, '')
    const purchasedKeys = new Set(purchases.map((p) => norm(p.item_name)))
    const stdMap = new Map(itemCosts.map((c) => [norm(c.item_name), c.unit_cost]))
    let yearStdCogs = 0
    for (const pr of saekOn?.products ?? []) {
      const k = norm(pr.prodName)
      if (purchasedKeys.has(k)) continue
      const uc = stdMap.get(k)
      if (uc != null) yearStdCogs += uc * pr.qty
    }
    const yearOnlineSupply = saekOn && !saekOn.error ? Math.round((saekOn.thisYear ?? 0) / 1.1) : 0
    const stdRate = yearOnlineSupply > 0 ? yearStdCogs / yearOnlineSupply : 0

    return buckets.map((b) => {
      const overlaps = monthOverlaps(b.start, b.end)
      const totalDays = overlaps.reduce((s, o) => s + o.days, 0) || 1
      const saekOnSupply = Math.round(bucketRevenue(onMap, overlaps, unit) / 1.1)
      const saekOffline = bucketRevenue(offMap, overlaps, unit)
      const shopSupply = Math.round(bucketRevenue(shopMap, overlaps, unit) / 1.1)

      // 색동 비용 (버킷 배분)
      const inBucket = (dt?: string | null) => !!dt && dt >= b.start && dt <= b.end
      const active = (e2: SaekdongExpense, ym: string) =>
        (!e2.start_month || e2.start_month <= ym) && (!e2.end_month || e2.end_month >= ym)
      const expSum = (filter: (e2: SaekdongExpense) => boolean) =>
        Math.round(
          expenses.filter(filter).reduce((s, e2) => {
            if (!e2.is_monthly) return s + (inBucket(e2.expense_date) ? e2.amount : 0)
            return (
              s +
              overlaps.reduce(
                (ms, o) =>
                  ms + (active(e2, o.ym) ? e2.amount * (unit === 'week' ? (12 / 52) * (o.days / totalDays) : 1) : 0),
                0,
              )
            )
          }, 0),
        )
      const saekPurch = purchases.filter((p) => inBucket(p.purchase_date)).reduce((s, p) => s + p.amount, 0)
      const saekSpend =
        saekPurch +
        expSum((e2) => e2.nature === '매출원가') +
        Math.round(saekOnSupply * stdRate) +
        expSum((e2) => e2.nature === '판관비') +
        expSum((e2) => e2.nature === '영업외비용')

      const bodySpend = b.fabricCogs + b.expenses + b.shipping + b.fixed + b.interest

      let rev = 0
      let spend = 0
      if (entity === 'total') {
        rev = b.sales + saekOnSupply + shopSupply + (b.naidSales ?? 0)
        spend = bodySpend + saekSpend + (b.naidCost ?? 0) + (b.naidCogs ?? 0)
      } else if (entity === 'body') {
        rev = b.sales - saekOffline + shopSupply
        spend = bodySpend
      } else if (entity === 'naid') {
        rev = b.naidSales ?? 0 // 법인 매출 (세금계산서)
        spend = (b.naidCost ?? 0) + (b.naidCogs ?? 0) // 운영비+이자+매입
      }
      return { key: b.key, label: b.label, 매출: rev, 지출: spend, 이익: rev - spend }
    })
  }, [trends, unit, entity, saekOn, saekOff, dianShop, saekCosts])

  // ── 26년 이전 관리 장부 백필 (통합·본체 공통 — 당시엔 색동·법인 없음) ──
  const finalData = useMemo(() => {
    if (!chartData) return null
    if (entity === 'naid') return chartData
    const archByYm = new Map(HISTORY_SALES.map((h) => [h.ym, h]))
    if (unit === 'month') {
      return chartData.map((row) => {
        if (Number(row.key.slice(0, 4)) >= LIVE_FROM) return row
        const h = archByYm.get(row.key)
        if (!h) return row
        const spend = h.purchase + h.expense
        return { ...row, 매출: h.sales, 지출: spend, 이익: h.sales - spend }
      })
    }
    if (unit === 'year') {
      // 아카이브 연도(16~25) + 시스템 연도(26~)
      const byYear = new Map<string, { sales: number; spend: number }>()
      for (const h of HISTORY_SALES) {
        const y = h.ym.slice(0, 4)
        const cur = byYear.get(y) ?? { sales: 0, spend: 0 }
        byYear.set(y, { sales: cur.sales + h.sales, spend: cur.spend + h.purchase + h.expense })
      }
      const arch = [...byYear.entries()].map(([y, v]) => ({
        key: y, label: `${y}년`, 매출: v.sales, 지출: v.spend, 이익: v.sales - v.spend,
      }))
      const sys = chartData.filter((row) => Number(row.key) >= LIVE_FROM)
      return [...arch, ...sys]
    }
    if (unit === 'quarter' || unit === 'half') {
      // 26년 이전 버킷은 관리 장부 월별 합으로 백필 (버킷 키 '2025-Q3' / '2025-H2')
      return chartData.map((row) => {
        const y = Number(row.key.slice(0, 4))
        if (y >= LIVE_FROM) return row
        const n = Number(row.key.slice(6)) // Q1~4 / H1~2
        const startM = unit === 'quarter' ? (n - 1) * 3 + 1 : (n - 1) * 6 + 1
        const len = unit === 'quarter' ? 3 : 6
        let sales = 0
        let spend = 0
        let found = false
        for (let i = 0; i < len; i++) {
          const h = archByYm.get(`${y}-${String(startM + i).padStart(2, '0')}`)
          if (!h) continue
          found = true
          sales += h.sales
          spend += h.purchase + h.expense
        }
        if (!found) return row
        return { ...row, 매출: sales, 지출: spend, 이익: sales - spend }
      })
    }
    return chartData // 주별은 26년 시스템 데이터부터
  }, [chartData, unit, entity])

  const magamCharts: { title: string; rows: AggRow[] }[] = useMemo(() => {
    if (!magam || magam.error) return []
    const top = (rows: AggRow[]) => rows.filter((r) => r.name !== '미표기').slice(0, 6)
    return [
      { title: '직군별', rows: top(magam.byIndustry ?? []) },
      { title: '품목별', rows: top(magam.byProduct ?? []) },
      { title: '가공·기능별', rows: top(magam.byProcess ?? []) },
    ]
  }, [magam])

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center gap-2 flex-wrap">
        <LineChartIcon className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h2 className="text-base font-semibold text-slate-900">경영 그래프 — 사업체별 흐름</h2>
        <span className="text-xs text-slate-400">· 매출·지출·이익 추이 + 출고 축 분석</span>
      </div>

      {/* ① 사업체별 추이 */}
      <div className="bg-white p-4 sm:p-5" style={box}>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="inline-flex overflow-hidden rounded-sm border border-slate-200">
            {ENTITIES.map((en) => (
              <button
                key={en.key}
                type="button"
                onClick={() => setEntity(en.key)}
                className="h-8 px-3 text-[12px] font-bold transition-colors"
                style={{
                  backgroundColor: entity === en.key ? '#000' : 'white',
                  color: entity === en.key ? '#fff' : '#64748b',
                }}
              >
                {en.label}
              </button>
            ))}
          </div>
          <div className="ml-auto inline-flex overflow-hidden rounded-sm border border-slate-200">
            {UNITS.map((u) => (
              <button
                key={u.key}
                type="button"
                onClick={() => setUnit(u.key)}
                className="h-8 px-3 text-[12px] font-bold transition-colors"
                style={{
                  backgroundColor: unit === u.key ? 'var(--nv-primary, #76b900)' : 'white',
                  color: unit === u.key ? '#000' : '#64748b',
                }}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {entity === 'naid' && !(finalData ?? []).some((r) => r.지출 > 0 || r.매출 > 0) ? (
          <div
            className="h-64 flex items-center justify-center text-[12px] text-slate-400 leading-relaxed text-center px-6"
            style={{ border: '1px dashed #cbd5e1', borderRadius: '2px' }}
          >
            이 기간 법인 비용 자료(관리회계 명세)가 없습니다 —
            <br />
            매월 관리회계 파일이 들어오면 법인 비용 추이가, 매출 자료가 연동되면 손익 전체가 표시됩니다.
          </div>
        ) : !finalData ? (
          <div className="h-64 flex items-center justify-center text-[12px] text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            추이 불러오는 중...
          </div>
        ) : (
          <div className="h-72 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={finalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#999' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#999' }}
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 100000000 ? `${(v / 100000000).toFixed(1)}억` : Math.abs(v) >= 10000 ? `${Math.round(v / 10000).toLocaleString()}만` : `${v}`
                  }
                  width={52}
                />
                <Tooltip formatter={(v) => formatKRW(Number(v))} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="매출" fill="#76b900" radius={[2, 2, 0, 0]} />
                <Bar dataKey="지출" fill="#f87171" radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="이익" stroke="#0f172a" strokeWidth={2} dot={{ r: 2.5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          공급가 기준 · 지출 = 매출원가 + 변동비 + 고정비(월 등록액 배분) + 대출이자 · 이익 = 매출 − 지출 (세금 반영 전)
          {entity === 'total' && ' · 통합 = 본체(일계표+디안몰) + 색동(온라인+오프라인·비용 포함) + 법인 비용, 이중계상 방지'}
          {entity === 'body' && ' · 본체 = 일계표 + 디안 쇼핑몰 − 색동 오프라인 (디안몰 원가 미연동)'}
          {entity === 'naid' && ' · 법인 매출·매입 = 세금계산서(공급가) · 운영비·이자 = 관리회계 명세'}
          {unit === 'week' && ' · 주별 색동·디안몰 매출은 월 매출 일할 배분 근사 (26년 시스템 데이터부터)'}
          {entity !== 'naid' && unit === 'month' && ' · 26년 이전 달은 관리 장부(매출·매입·경비) 백필'}
          {entity !== 'naid' && unit === 'year' && ' · 16~25년은 관리 장부(매출·매입·경비) 기준 — 이익 = 매출 − (매입+경비)'}
        </p>
      </div>

      {/* ② 출고 축 분석 — 직군·품목·가공 */}
      <div className="bg-white p-4 sm:p-5" style={box}>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <h3 className="text-[13px] font-bold text-slate-900">출고 기준 매출 — 직군 · 품목 · 가공</h3>
          <span className="text-[11px] text-slate-400">· 마감(출고) 데이터 · 영업·마케팅 전략용</span>
          <div className="ml-auto inline-flex overflow-hidden rounded-sm border border-slate-200">
            {[30, 90, 180].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setMagamDays(d)}
                className="h-7 px-2.5 text-[11px] font-bold transition-colors"
                style={{
                  backgroundColor: magamDays === d ? 'var(--nv-primary, #76b900)' : 'white',
                  color: magamDays === d ? '#000' : '#64748b',
                }}
              >
                {d}일
              </button>
            ))}
          </div>
        </div>
        {magamLoading ? (
          <div className="h-40 flex items-center justify-center text-[12px] text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            집계 중...
          </div>
        ) : magamCharts.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-slate-400">출고(마감) 데이터가 없습니다 — 마감 파일을 업로드하면 표시됩니다.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {magamCharts.map((c) => (
              <div key={c.title}>
                <p className="mb-1.5 text-[12px] font-bold text-slate-700">{c.title}</p>
                {c.rows.length === 0 ? (
                  <p className="h-44 flex items-center justify-center text-[11px] italic text-slate-400">
                    표기된 데이터가 없습니다.
                  </p>
                ) : (
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={c.rows} layout="vertical" margin={{ left: 8, right: 8 }}>
                        <XAxis
                          type="number"
                          tick={{ fontSize: 9, fill: '#999' }}
                          tickFormatter={(v: number) =>
                            Math.abs(v) >= 100000000 ? `${(v / 100000000).toFixed(1)}억` : `${Math.round(v / 10000).toLocaleString()}만`
                          }
                        />
                        <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: '#475569' }} />
                        <Tooltip formatter={(v) => formatKRW(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                        <Bar dataKey="amount" name="매출" fill="#76b900" radius={[0, 2, 2, 0]} barSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[10px] text-slate-400">
          미표기 건은 제외 — 자세한 미표기 추적·출고+미수는 아래 ‘출고·마감 인사이트’에서
        </p>
      </div>
    </div>
  )
}
