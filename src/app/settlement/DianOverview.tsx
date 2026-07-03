'use client'

/**
 * 디안 전체 경영지표 (통합) — 경영 계기판 상단 골격.
 *
 * 밴드 1: 총매출 = 디안 본체(일계표) + 색동 온라인(공급가 환산 ÷1.1).
 *         구성: 디안 원단(본체 − 색동 오프라인) · 색동(온+오프) · 엔에이아이디(연동 예정)
 *         ※ 색동 오프라인은 일계표에 이미 포함 — 이중계상 방지 구조.
 * 밴드 2: DIAN PULSE — 월 총매출 카운트업 + 12개월 스파크라인 + 색동 비중.
 *
 * V1 골격 — 세부 지표(이익·비용 통합 등)는 단계적으로 확장.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Gauge, Loader2 } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { fetchSharedSales, fetchSharedOffline } from '@/app/saekdong/sharedFetch'
import { listSaekdongCosts } from '@/app/saekdong/actions'
import type { SaekdongPurchase, SaekdongExpense, SaekdongItemCost } from '@/app/saekdong/actions'
import ProfitFlow from './ProfitFlow'

type Period = 'week' | 'month' | 'quarter' | 'year'

interface MonthlyPoint { month: string; revenue: number }
interface SeriesData {
  monthly: MonthlyPoint[]
  today: number
  thisWeek: number
  thisMonth: number
  thisYear?: number
  products?: { prodName: string; revenue: number; qty: number }[]
  error?: string
}

function normName(s: string): string {
  return String(s || '').replace(/\[[^\]]*\]/g, '').toLowerCase().replace(/\s+/g, '')
}

/** 확정월(전월) 범위 — KST */
function prevMonthRange(): { key: string; start: string; end: string } {
  const today = kstToday()
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))]
  const first = new Date(y, m - 2, 1) // 전월 1일
  const last = new Date(y, m - 1, 0) // 전월 말일
  const ymd = (d: Date) => d.toLocaleDateString('sv-SE')
  return { key: ymd(first).slice(0, 7), start: ymd(first), end: ymd(last) }
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

/** 기간 시작일 + 고정비 월 등록액 배분 계수 (색동 계기판과 동일 규칙) */
function periodInfo(period: Period): { start: string; monthMult: number } {
  const today = kstToday()
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))]
  if (period === 'week') {
    const now = new Date(today + 'T00:00:00')
    const dow = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
    return { start: monday.toLocaleDateString('sv-SE'), monthMult: 12 / 52 }
  }
  if (period === 'month') return { start: `${today.slice(0, 7)}-01`, monthMult: 1 }
  if (period === 'quarter') {
    const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1
    return { start: `${y}-${String(qStartMonth).padStart(2, '0')}-01`, monthMult: m - qStartMonth + 1 }
  }
  return { start: `${y}-01-01`, monthMult: m }
}

/** 본체(일계표) 기간 손익 재료 — /api/settlement/pnl 응답 */
interface BodyPnl {
  sales: number
  fabricCogs: number
  expenses: number
  shipping: number
  fixed: number
  interest: number
  interestMissing?: boolean
  error?: string
}

function periodLabel(period: Period): string {
  const [y, m] = [Number(kstToday().slice(0, 4)), Number(kstToday().slice(5, 7))]
  if (period === 'week') return '이번 주'
  if (period === 'month') return '이번 달'
  if (period === 'quarter') return `${Math.floor((m - 1) / 3) + 1}분기`
  return `${y}년`
}

/** 시계열에서 기간 매출 (to-date) */
function periodRevenue(d: SeriesData | null, period: Period): number {
  if (!d || d.error) return 0
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

// 카운트업
function useCountUp(target: number, durationMs = 1400): number {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setVal(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, durationMs])
  return val
}

function Sparkline({ values, width = 130, height = 36 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * (width - 4) + 2,
    y: height - 4 - ((v - min) / range) * (height - 10),
  }))
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${d} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z`
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={area} fill="#76b900" opacity={0.14} className="ov-fade" />
      <path d={d} fill="none" stroke="#76b900" strokeWidth="1.8" strokeLinecap="round" pathLength={100} className="ov-draw" />
      <circle cx={last.x} cy={last.y} r="2.6" fill="#76b900" className="ov-dot" />
    </svg>
  )
}

export default function DianOverview() {
  const [period, setPeriod] = useState<Period>('month')
  const [dian, setDian] = useState<SeriesData | null>(null)
  const [saekOn, setSaekOn] = useState<SeriesData | null>(null)
  const [saekOff, setSaekOff] = useState<SeriesData | null>(null)
  const [bodyOpPrev, setBodyOpPrev] = useState<number | null>(null) // 본체 확정월 영업이익
  const [saekCosts, setSaekCosts] = useState<{
    purchases: SaekdongPurchase[]
    expenses: SaekdongExpense[]
    itemCosts: SaekdongItemCost[]
  } | null>(null)
  const [bodyPnl, setBodyPnl] = useState<Partial<Record<Period, BodyPnl>>>({})
  const [loading, setLoading] = useState(true)

  // 기간 변경 시 본체 손익 재료 조회 (기간별 1회 캐시)
  useEffect(() => {
    if (bodyPnl[period]) return
    const info = periodInfo(period)
    fetch(`/api/settlement/pnl?start=${info.start}&end=${kstToday()}`)
      .then((r) => r.json())
      .then((d: BodyPnl) => {
        if (!d.error) setBodyPnl((prev) => ({ ...prev, [period]: d }))
      })
      .catch(() => {})
  }, [period, bodyPnl])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const pm = prevMonthRange()
      const [d, s, o, st, sc] = await Promise.all([
        fetch('/api/settlement/monthly').then((r) => r.json()),
        fetchSharedSales<SeriesData>().catch(() => null),
        fetchSharedOffline<SeriesData>().catch(() => null),
        // 확정월 본체 영업이익 (결산 API — 매입원가·비용·고정비 반영)
        fetch(`/api/settlement/daily?startDate=${pm.start}&endDate=${pm.end}`)
          .then((r) => r.json())
          .catch(() => null),
        listSaekdongCosts().catch(() => null),
      ])
      setDian(d)
      setSaekOn(s)
      setSaekOff(o)
      setBodyOpPrev(
        st && typeof st.dailyOperatingProfit === 'number' ? st.dailyOperatingProfit : null,
      )
      if (sc) setSaekCosts({ purchases: sc.purchases, expenses: sc.expenses, itemCosts: sc.itemCosts })
    } catch {
      // 부가 표시 — 실패 시 0
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const m = useMemo(() => {
    // 기간 매출 (공급가 기준)
    const dianBody = periodRevenue(dian, period) // 일계표 전체 (색동 오프라인 포함)
    const saekOnline = Math.round(periodRevenue(saekOn, period) / 1.1)
    const saekOffline = periodRevenue(saekOff, period)
    const total = dianBody + saekOnline // 색동 오프라인은 dianBody 에 포함 — 이중계상 방지
    const saekTotal = saekOnline + saekOffline
    const dianFabric = dianBody - saekOffline

    // 12개월 통합 시계열 (본체 + 색동 온라인 공급가)
    const onMap = new Map((saekOn?.monthly ?? []).map((x) => [x.month, x.revenue]))
    const series = (dian?.monthly ?? []).map(
      (x) => x.revenue + Math.round((onMap.get(x.month) ?? 0) / 1.1),
    )
    const months = (dian?.monthly ?? []).map((x) => x.month)

    // 마지막 완료월 성장률 (진행 중인 달 제외)
    const nowMonth = kstToday().slice(0, 7)
    let lastIdx = months.length - 1
    if (months[lastIdx] === nowMonth) lastIdx -= 1
    const lastRev = lastIdx >= 0 ? series[lastIdx] : 0
    const prevRev = lastIdx - 1 >= 0 ? series[lastIdx - 1] : 0
    const growth = prevRev > 0 ? ((lastRev - prevRev) / prevRev) * 100 : null
    const lastLabel = lastIdx >= 0 ? `${Number(months[lastIdx].slice(5))}월` : '—'
    // 마지막 완료월 색동 비중
    const lastSaekOn = lastIdx >= 0 ? Math.round((onMap.get(months[lastIdx]) ?? 0) / 1.1) : 0
    const offMap = new Map((saekOff?.monthly ?? []).map((x) => [x.month, x.revenue]))
    const lastSaekOff = lastIdx >= 0 ? (offMap.get(months[lastIdx]) ?? 0) : 0
    const saekShare = lastRev > 0 ? ((lastSaekOn + lastSaekOff) / lastRev) * 100 : null

    // ── 확정월 통합 영업이익 (근사) ──
    // = 본체 영업이익(결산 API) + 색동 영업이익 − 색동 오프라인 매출(이중계상 제거)
    let profit: number | null = null
    let profitRate: number | null = null
    if (bodyOpPrev != null && lastIdx >= 0) {
      const pmKey = months[lastIdx]
      const exps = saekCosts?.expenses ?? []
      const monthlyActive = (e: SaekdongExpense) =>
        (!e.start_month || e.start_month <= pmKey) && (!e.end_month || e.end_month >= pmKey)
      const expSum = (filter: (e: SaekdongExpense) => boolean) =>
        exps.reduce(
          (s, e) =>
            s +
            (e.is_monthly
              ? monthlyActive(e) && filter(e) ? e.amount : 0
              : (e.expense_date ?? '').startsWith(pmKey) && filter(e) ? e.amount : 0),
          0,
        )
      // 색동 매출원가: 확정월 매입 + 성격=매출원가 비용 + 기준단가 추정(올해 원가율 × 확정월 온라인)
      const purch = (saekCosts?.purchases ?? [])
        .filter((p) => p.purchase_date.startsWith(pmKey))
        .reduce((s, p) => s + p.amount, 0)
      const purchasedKeys = new Set((saekCosts?.purchases ?? []).map((p) => normName(p.item_name)))
      const stdMap = new Map((saekCosts?.itemCosts ?? []).map((c) => [normName(c.item_name), c.unit_cost]))
      let yearStdCogs = 0
      for (const pr of saekOn?.products ?? []) {
        const k = normName(pr.prodName)
        if (purchasedKeys.has(k)) continue
        const uc = stdMap.get(k)
        if (uc != null) yearStdCogs += uc * pr.qty
      }
      const yearOnlineSupply = Math.round((saekOn?.thisYear ?? 0) / 1.1)
      const stdRate = yearOnlineSupply > 0 ? yearStdCogs / yearOnlineSupply : 0
      const saekCogs = purch + expSum((e) => e.nature === '매출원가') + Math.round(lastSaekOn * stdRate)
      const saekVar = expSum((e) => e.cost_type === 'variable' && e.nature === '판관비')
      const saekFixed = expSum((e) => e.cost_type === 'fixed' && e.nature === '판관비')
      const saekOp = lastSaekOn + lastSaekOff - saekCogs - saekVar - saekFixed
      profit = bodyOpPrev + saekOp - lastSaekOff // 오프라인 매출 이중계상 제거
      profitRate = lastRev > 0 ? (profit / lastRev) * 100 : null
    }

    return {
      dianBody, saekOnline, saekOffline, total, saekTotal, dianFabric,
      series, lastRev, growth, lastLabel, saekShare, profit, profitRate,
    }
  }, [dian, saekOn, saekOff, period, bodyOpPrev, saekCosts])

  // ── 색동 기간 손익 사슬 (색동 계기판과 동일 규칙) ──
  const saekChain = useMemo(() => {
    const info = periodInfo(period)
    const curMonth = kstToday().slice(0, 7)
    const purchases = saekCosts?.purchases ?? []
    const expenses = saekCosts?.expenses ?? []
    const itemCosts = saekCosts?.itemCosts ?? []
    const onlineRaw = saekOn && !saekOn.error ? periodRevenue(saekOn, period) : 0
    const onlineSupply = Math.round(onlineRaw / 1.1)
    const inPeriod = (dt?: string | null) => !!dt && dt >= info.start
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
    // 기준단가 추정 원가 — 매입 기록 없는 품목만, 올해 원가율을 기간 온라인 매출에 비례 배분
    const purchasedKeys = new Set(purchases.map((p) => normName(p.item_name)))
    const stdMap = new Map(itemCosts.map((c) => [normName(c.item_name), c.unit_cost]))
    let yearStdCogs = 0
    for (const pr of saekOn?.products ?? []) {
      const k = normName(pr.prodName)
      if (purchasedKeys.has(k)) continue
      const uc = stdMap.get(k)
      if (uc != null) yearStdCogs += uc * pr.qty
    }
    const yearOnlineSupply = saekOn && !saekOn.error ? Math.round((saekOn.thisYear ?? 0) / 1.1) : 0
    const stdRate = yearOnlineSupply > 0 ? yearStdCogs / yearOnlineSupply : 0
    const cogs =
      purchases.filter((pu) => inPeriod(pu.purchase_date)).reduce((s, pu) => s + pu.amount, 0) +
      expSum((e) => e.nature === '매출원가') +
      Math.round(onlineSupply * stdRate)
    return {
      onlineSupply,
      cogs,
      variable: expSum((e) => e.cost_type === 'variable' && e.nature === '판관비'),
      fixed: expSum((e) => e.cost_type === 'fixed' && e.nature === '판관비'),
      nonOp: expSum((e) => e.nature === '영업외비용'),
    }
  }, [saekCosts, saekOn, period])

  // ── 회사 전체 손익 사슬 = 본체(일계표) + 색동 (오프라인은 본체에 포함 — 이중계상 없음) ──
  const chain = useMemo(() => {
    const body = bodyPnl[period]
    if (!body) return null
    const revenue = body.sales + saekChain.onlineSupply
    const cogs = body.fabricCogs + saekChain.cogs
    const gross = revenue - cogs
    const variable = body.expenses + body.shipping + saekChain.variable
    const contribution = gross - variable
    const fixed = body.fixed + saekChain.fixed
    const operating = contribution - fixed
    const nonOp = saekChain.nonOp + (body.interest ?? 0)
    const net = operating - nonOp
    return {
      revenue, cogs, gross, variable, contribution, fixed, operating, nonOp, net,
      interestMissing: !!body.interestMissing,
    }
  }, [bodyPnl, period, saekChain])

  const lastRevCount = useCountUp(m.lastRev)

  return (
    <div className="space-y-3">
      <style>{`
        .ov-draw { stroke-dasharray: 100; stroke-dashoffset: 100; animation: ovDraw 1.6s ease-out forwards; }
        @keyframes ovDraw { to { stroke-dashoffset: 0; } }
        .ov-fade { opacity: 0; animation: ovFade 1s ease-out 0.9s forwards; }
        @keyframes ovFade { to { opacity: 0.14; } }
        .ov-dot { animation: ovDot 2s ease-in-out 1.4s infinite; transform-origin: center; transform-box: fill-box; }
        @keyframes ovDot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(1.6); } }
      `}</style>

      {/* 헤더 + 기간 버튼 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Gauge className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />
        <h2 className="text-base font-semibold text-slate-900">디안 전체 경영지표</h2>
        <span className="text-xs text-slate-400">
          · {periodLabel(period)} · 공급가 기준 · 디안 본체 + 색동 (엔에이아이디 연동 예정)
        </span>
        <div className="ml-auto inline-flex overflow-hidden rounded-sm border border-slate-200">
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

      {/* 손익 흐름 생키 — 디안은 이렇게 벌고 쓴다 */}
      <div
        className="bg-white p-4 sm:p-5"
        style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}
      >
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <h3 className="text-[14px] font-bold text-slate-900">
            디안은 이렇게 벌고 쓴다
          </h3>
          <span className="text-[11px] text-slate-400">
            · {periodLabel(period)} · 본체 + 색동 통합 (엔에이아이디 연동 예정)
          </span>
        </div>
        {loading || !chain ? (
          <p className="py-8 text-center text-[12px] text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            손익 흐름 계산 중...
          </p>
        ) : (
          <>
            <ProfitFlow
              revenue={chain.revenue}
              cogs={chain.cogs}
              gross={chain.gross}
              variable={chain.variable}
              contribution={chain.contribution}
              fixed={chain.fixed}
              operating={chain.operating}
              nonOp={chain.nonOp}
              net={chain.net}
              periodKey={period}
            />
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
              공급가 기준 · 매출원가 = 본체 원단 매입원가 + 색동 매입·기준단가 추정 · 변동비 =
              본체 당일지출·해외운송비 + 색동 변동 판관비 · 고정비 = 월 등록액 기간 배분 ·
              순이익 = 영업이익 − 영업외비용(색동 등록분 + 대출이자) — 종소세·법인세 반영 전
              {chain.interestMissing && ' · ⚠ 대출 이자 미연동 (loan_payments SQL 실행 대기)'}
            </p>
          </>
        )}
      </div>

      {/* 밴드 1 — 통합 매출 스트립 */}
      <div className="px-4 py-5 sm:px-6" style={{ backgroundColor: '#000', borderRadius: '2px' }}>
        {loading ? (
          <p className="text-[13px] text-white/60 py-3">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            통합 매출 불러오는 중... (색동 온라인 첫 조회는 오래 걸릴 수 있어요)
          </p>
        ) : (
          <div className="flex flex-wrap items-stretch gap-y-5">
            <Cell first label={`총매출 · ${periodLabel(period)}`} big>
              <span style={{ color: '#76b900' }}>{formatKRW(m.total)}</span>
            </Cell>
            <Cell label="디안 원단 (본체)">
              <span className="text-white">{formatKRW(m.dianFabric)}</span>
            </Cell>
            <Cell label="색동 (온라인+오프라인)">
              <span className="text-white">{formatKRW(m.saekTotal)}</span>
            </Cell>
            <Cell label="엔에이아이디 (법인)" dim>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>연동 예정</span>
            </Cell>
          </div>
        )}
        {!loading && (saekOn?.error || dian?.error) && (
          <p className="mt-3 text-[11px] font-medium" style={{ color: '#fbbf24' }}>
            ⚠ 일부 매출 조회 실패 — 위 지표는 일부가 빠진 값입니다. 잠시 후 새로고침 해주세요.
          </p>
        )}
      </div>

      {/* 밴드 2 — DIAN PULSE 타이포 */}
      <div className="px-4 py-4 sm:px-6" style={{ backgroundColor: '#000', borderRadius: '2px' }}>
        <div className="flex items-center gap-1.5 mb-3">
          <span className="inline-block w-1.5 h-1.5 rounded-full ov-dot" style={{ backgroundColor: '#76b900' }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Dian Pulse
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            · {m.lastLabel} 확정 기준 (본체 + 색동 온라인)
          </span>
        </div>
        {loading ? (
          <p className="text-[12px] text-white/50">준비 중...</p>
        ) : (
          <div className="flex flex-wrap items-stretch gap-y-5">
            <Cell first label={`${m.lastLabel} 총매출`} big>
              <div className="flex items-end gap-3">
                <div>
                  <span style={{ color: '#76b900' }}>{formatKRW(Math.round(lastRevCount))}</span>
                  <p
                    className="mt-1 text-[11px] font-bold tabular-nums"
                    style={{ color: m.growth == null ? 'rgba(255,255,255,0.4)' : m.growth >= 0 ? '#76b900' : '#f87171' }}
                  >
                    {m.growth == null ? '전월 데이터 없음' : `${m.growth >= 0 ? '▲' : '▼'} ${Math.abs(m.growth).toFixed(1)}% 전월 대비`}
                  </p>
                </div>
                <Sparkline values={m.series} />
              </div>
            </Cell>
            <Cell label="색동 비중">
              <span className="text-white">
                {m.saekShare == null ? '—' : `${m.saekShare.toFixed(1)}%`}
              </span>
              <p className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {m.lastLabel} 총매출 중 색동
              </p>
            </Cell>
            <Cell label={`${m.lastLabel} 통합 영업이익`}>
              {m.profit == null ? (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span>
                  <p className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    결산 데이터 없음
                  </p>
                </>
              ) : (
                <>
                  <span style={{ color: m.profit >= 0 ? '#76b900' : '#f87171' }}>
                    {formatKRW(m.profit)}
                  </span>
                  <p
                    className="mt-1 text-[11px] font-bold tabular-nums"
                    style={{ color: m.profit >= 0 ? 'rgba(118,185,0,0.9)' : '#f87171' }}
                  >
                    영업이익률 {m.profitRate == null ? '—' : `${m.profitRate.toFixed(1)}%`}
                  </p>
                  <p className="mt-0.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    본체 + 색동 (근사)
                  </p>
                </>
              )}
            </Cell>
            <Cell label="엔에이아이디" dim>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>연동 예정</span>
            </Cell>
          </div>
        )}
      </div>
    </div>
  )
}

function Cell({
  label, big, dim, first, children,
}: {
  label: string
  big?: boolean
  dim?: boolean
  first?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="px-4 sm:px-6 first:pl-0" style={{ borderLeft: first ? 'none' : '1px solid rgba(255,255,255,0.14)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: dim ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.45)' }}>
        {label}
      </p>
      <div className={`mt-1 font-bold tabular-nums leading-none ${big ? 'text-[26px] sm:text-[30px]' : 'text-[19px] sm:text-[22px]'}`}>
        {children}
      </div>
    </div>
  )
}
