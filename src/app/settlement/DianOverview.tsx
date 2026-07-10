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
import { fetchSharedSales, fetchSharedOffline, fetchSharedDianShop } from '@/app/saekdong/sharedFetch'
import { listSaekdongCosts } from '@/app/saekdong/actions'
import type { SaekdongPurchase, SaekdongExpense, SaekdongItemCost } from '@/app/saekdong/actions'
import ProfitFlow from './ProfitFlow'
import { rangeFor, seriesRevenue, kstToday, type Period } from '@/lib/period-range'

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

/** 본체(일계표) 기간 손익 재료 — /api/settlement/pnl 응답 */
interface BodyPnl {
  sales: number
  fabricCogs: number // = soldCogs + freightCogs (판매 기준 원가 + 해외운임·관세)
  soldCogs?: number
  freightCogs?: number
  cogsCoverage?: number // 단가표 매칭 커버리지 %
  invPurchase?: number // 재고 취득 매입 (손익 미반영, 참고)
  expenses: number
  shipping: number
  fixed: number
  fixedBreakdown?: { label: string; amount: number }[]
  naid?: { fixed: number; interest: number } // 엔에이아이디(법인) — 관리회계 명세 자동 분류
  interest: number
  interestMissing?: boolean
  error?: string
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

/** 기간 선택 상태 묶음 — 블록마다 독립 선택 (통합·본체·추후 법인) */
function usePeriodSel() {
  const nowM = Number(kstToday().slice(5, 7))
  const curQ = Math.floor((nowM - 1) / 3) + 1
  const [period, setPeriod] = useState<Period>('month')
  const [selMonth, setSelMonth] = useState(nowM)
  const [selQuarter, setSelQuarter] = useState(curQ)
  const [weekOffset, setWeekOffset] = useState(0)
  const range = useMemo(
    () => rangeFor(period, selMonth, selQuarter, weekOffset),
    [period, selMonth, selQuarter, weekOffset],
  )
  return {
    period, setPeriod, selMonth, setSelMonth, selQuarter, setSelQuarter,
    weekOffset, setWeekOffset, nowM, curQ, range,
    rangeKey: `${range.start}_${range.end}`,
  }
}
type PeriodSel = ReturnType<typeof usePeriodSel>

export default function DianOverview() {
  const main = usePeriodSel()
  const { period, range, rangeKey } = main
  const bodySel = usePeriodSel() // 본체 블록 독립 선택
  const [dian, setDian] = useState<SeriesData | null>(null)
  const [saekOn, setSaekOn] = useState<SeriesData | null>(null)
  const [saekOff, setSaekOff] = useState<SeriesData | null>(null)
  const [dianShop, setDianShop] = useState<SeriesData | null>(null) // 디안 원단몰 — 본체 매출에 편입
  const [bodyOpPrev, setBodyOpPrev] = useState<number | null>(null) // 본체 확정월 영업이익
  const [saekCosts, setSaekCosts] = useState<{
    purchases: SaekdongPurchase[]
    expenses: SaekdongExpense[]
    itemCosts: SaekdongItemCost[]
  } | null>(null)
  const [bodyPnl, setBodyPnl] = useState<Record<string, BodyPnl>>({})
  const [pulsePnl, setPulsePnl] = useState<BodyPnl | null>(null) // 확정월(전월) 본체 손익 재료
  const [loading, setLoading] = useState(true)

  // 기간(과거 포함) 변경 시 본체 손익 재료 조회 (범위별 1회 캐시 — 통합·본체 선택기 공유)
  const pnlInflight = useRef(new Set<string>())
  const fetchPnlFor = useCallback(
    (key: string, start: string, end: string) => {
      if (bodyPnl[key] || pnlInflight.current.has(key)) return
      pnlInflight.current.add(key)
      fetch(`/api/settlement/pnl?start=${start}&end=${end}`)
        .then((r) => r.json())
        .then((d: BodyPnl) => {
          if (!d.error) setBodyPnl((prev) => ({ ...prev, [key]: d }))
        })
        .catch(() => {})
        .finally(() => pnlInflight.current.delete(key))
    },
    [bodyPnl],
  )
  useEffect(() => {
    fetchPnlFor(rangeKey, range.start, range.end)
  }, [rangeKey, range.start, range.end, fetchPnlFor])
  useEffect(() => {
    fetchPnlFor(bodySel.rangeKey, bodySel.range.start, bodySel.range.end)
  }, [bodySel.rangeKey, bodySel.range.start, bodySel.range.end, fetchPnlFor])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const pm = prevMonthRange()
      const [d, s, o, st, sc, pp, ds] = await Promise.all([
        fetch('/api/settlement/monthly').then((r) => r.json()),
        fetchSharedSales<SeriesData>().catch(() => null),
        fetchSharedOffline<SeriesData>().catch(() => null),
        // 확정월 본체 영업이익 (결산 API — 매입원가·비용·고정비 반영)
        fetch(`/api/settlement/daily?startDate=${pm.start}&endDate=${pm.end}`)
          .then((r) => r.json())
          .catch(() => null),
        listSaekdongCosts().catch(() => null),
        // 확정월 본체 비용 구조 (PULSE 비용 표시용)
        fetch(`/api/settlement/pnl?start=${pm.start}&end=${pm.end}`)
          .then((r) => r.json())
          .catch(() => null),
        // 디안 원단몰 (아임웹 2호점) — 본체 매출에 편입
        fetchSharedDianShop<SeriesData>().catch(() => null),
      ])
      setDian(d)
      setSaekOn(s)
      setSaekOff(o)
      setDianShop(ds)
      setBodyOpPrev(
        st && typeof st.dailyOperatingProfit === 'number' ? st.dailyOperatingProfit : null,
      )
      if (sc) setSaekCosts({ purchases: sc.purchases, expenses: sc.expenses, itemCosts: sc.itemCosts })
      if (pp && !pp.error) setPulsePnl(pp as BodyPnl)
    } catch {
      // 부가 표시 — 실패 시 0
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const m = useMemo(() => {
    // 기간 매출 (공급가 기준) — 본체는 DB 집계(pnl) 우선, 없으면 월 시계열
    const bodyForRange = bodyPnl[rangeKey]
    const dianBody = bodyForRange ? bodyForRange.sales : seriesRevenue(dian, range) // 일계표 전체 (색동 오프라인 포함)
    const saekOnline = Math.round(seriesRevenue(saekOn, range) / 1.1)
    const saekOffline = seriesRevenue(saekOff, range)
    const shopSupply = Math.round(seriesRevenue(dianShop, range) / 1.1) // 디안 원단몰 — 본체 소속
    const total = dianBody + saekOnline + shopSupply // 색동 오프라인은 dianBody 에 포함 — 이중계상 방지
    const saekTotal = saekOnline + saekOffline
    const dianFabric = dianBody - saekOffline + shopSupply

    // 12개월 통합 시계열 (본체 + 색동 온라인 + 디안몰 공급가)
    const onMap = new Map((saekOn?.monthly ?? []).map((x) => [x.month, x.revenue]))
    const shopMap = new Map((dianShop?.monthly ?? []).map((x) => [x.month, x.revenue]))
    const series = (dian?.monthly ?? []).map(
      (x) =>
        x.revenue +
        Math.round((onMap.get(x.month) ?? 0) / 1.1) +
        Math.round((shopMap.get(x.month) ?? 0) / 1.1),
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

    // ── 확정월 색동 비용 (매출원가·변동·고정) — 통합 영업이익과 PULSE 비용 구조가 공유 ──
    let saekPm = { cogs: 0, variable: 0, fixed: 0 }
    if (lastIdx >= 0 && saekCosts) {
      const pmKey = months[lastIdx]
      const exps = saekCosts.expenses
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
      const purch = saekCosts.purchases
        .filter((p) => p.purchase_date.startsWith(pmKey))
        .reduce((s, p) => s + p.amount, 0)
      const purchasedKeys = new Set(saekCosts.purchases.map((p) => normName(p.item_name)))
      const stdMap = new Map(saekCosts.itemCosts.map((c) => [normName(c.item_name), c.unit_cost]))
      let yearStdCogs = 0
      for (const pr of saekOn?.products ?? []) {
        const k = normName(pr.prodName)
        if (purchasedKeys.has(k)) continue
        const uc = stdMap.get(k)
        if (uc != null) yearStdCogs += uc * pr.qty
      }
      const yearOnlineSupply = Math.round((saekOn?.thisYear ?? 0) / 1.1)
      const stdRate = yearOnlineSupply > 0 ? yearStdCogs / yearOnlineSupply : 0
      saekPm = {
        cogs: purch + expSum((e) => e.nature === '매출원가') + Math.round(lastSaekOn * stdRate),
        variable: expSum((e) => e.cost_type === 'variable' && e.nature === '판관비'),
        fixed: expSum((e) => e.cost_type === 'fixed' && e.nature === '판관비'),
      }
    }

    // ── 확정월 통합 영업이익 (근사) ──
    // = 본체 영업이익(결산 API) + 색동 영업이익 − 색동 오프라인 매출(이중계상 제거)
    let profit: number | null = null
    let profitRate: number | null = null
    if (bodyOpPrev != null && lastIdx >= 0) {
      const saekOp = lastSaekOn + lastSaekOff - saekPm.cogs - saekPm.variable - saekPm.fixed
      profit = bodyOpPrev + saekOp - lastSaekOff // 오프라인 매출 이중계상 제거
      profitRate = lastRev > 0 ? (profit / lastRev) * 100 : null
    }

    // ── 확정월 통합 비용 구조 (본체 pnl + 색동) — PULSE 표시용 ──
    let pulseCosts: { cogs: number; variable: number; fixed: number; total: number; rate: number | null } | null = null
    if (pulsePnl && lastIdx >= 0) {
      const cogs = pulsePnl.fabricCogs + saekPm.cogs
      const variable = pulsePnl.expenses + pulsePnl.shipping + saekPm.variable
      const fixed = pulsePnl.fixed + saekPm.fixed
      const totalCost = cogs + variable + fixed
      pulseCosts = {
        cogs, variable, fixed, total: totalCost,
        rate: lastRev > 0 ? (totalCost / lastRev) * 100 : null,
      }
    }

    return {
      dianBody, saekOnline, saekOffline, total, saekTotal, dianFabric,
      series, lastRev, growth, lastLabel, saekShare, profit, profitRate, pulseCosts,
    }
  }, [dian, saekOn, saekOff, dianShop, range, rangeKey, bodyPnl, bodyOpPrev, saekCosts, pulsePnl])

  // ── 색동 기간 손익 사슬 (색동 계기판과 동일 규칙, 과거 기간 지원) ──
  const saekChain = useMemo(() => {
    const purchases = saekCosts?.purchases ?? []
    const expenses = saekCosts?.expenses ?? []
    const itemCosts = saekCosts?.itemCosts ?? []
    const onlineRaw = saekOn && !saekOn.error ? seriesRevenue(saekOn, range) : 0
    const onlineSupply = Math.round(onlineRaw / 1.1)
    const inPeriod = (dt?: string | null) => !!dt && dt >= range.start && dt <= range.end
    // 월 등록 비용: 기간에 걸친 달마다 (그 달에 활성일 때) 가중치만큼 배분
    const monthlyActive = (e: SaekdongExpense, ym: string) =>
      (!e.start_month || e.start_month <= ym) && (!e.end_month || e.end_month >= ym)
    const expSum = (filter: (e: SaekdongExpense) => boolean) =>
      Math.round(
        expenses.filter(filter).reduce((s, e) => {
          if (!e.is_monthly) return s + (inPeriod(e.expense_date) ? e.amount : 0)
          return s + range.months.reduce((ms, mw) => ms + (monthlyActive(e, mw.ym) ? e.amount * mw.w : 0), 0)
        }, 0),
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
  }, [saekCosts, saekOn, range])

  // ── 회사 전체 손익 사슬 = 본체(일계표 + 디안몰) + 색동 (오프라인은 본체에 포함 — 이중계상 없음) ──
  const chain = useMemo(() => {
    const body = bodyPnl[rangeKey]
    if (!body) return null
    const shopSupply = Math.round(seriesRevenue(dianShop, range) / 1.1) // 디안 원단몰 — 본체 소속 (원가 미연동)
    const revenue = body.sales + saekChain.onlineSupply + shopSupply
    const cogs = body.fabricCogs + saekChain.cogs
    const gross = revenue - cogs
    const variable = body.expenses + body.shipping + saekChain.variable
    const contribution = gross - variable
    // 디안 전체 = 본체 + 색동 + 법인 비용 (법인 매출은 자료 연동 시 합산 — 대표 결정 2026-07-10)
    const naidFixed = body.naid?.fixed ?? 0
    const naidInterest = body.naid?.interest ?? 0
    const fixed = body.fixed + saekChain.fixed + naidFixed
    const operating = contribution - fixed
    const nonOp = saekChain.nonOp + (body.interest ?? 0) + naidInterest
    const net = operating - nonOp
    // BEP — 공헌이익 관점: BEP 매출 = 고정비 ÷ 공헌이익률, 달성률 = 공헌이익 ÷ 고정비
    const bepRate = fixed > 0 ? (contribution / fixed) * 100 : null
    const bep = fixed > 0 && contribution > 0 ? Math.round((fixed * revenue) / contribution) : null
    // 비용 세부 구성 — 자료가 등록된 만큼 막대 아래 표시 (자료 늘면 자동 세분화)
    const breakdowns = {
      cogs: [
        { label: '본체 판매원가(단가표)', amount: body.soldCogs ?? body.fabricCogs },
        { label: '해외운임·관세', amount: body.freightCogs ?? 0 },
        { label: '색동 매입·원가', amount: saekChain.cogs },
      ],
      variable: [
        { label: '본체 당일지출', amount: body.expenses },
        { label: '해외운송비', amount: body.shipping },
        { label: '색동 변동비', amount: saekChain.variable },
      ],
      fixed: [
        ...(body.fixedBreakdown ?? []).map((x) => ({ label: `본체 ${x.label}`, amount: x.amount })),
        { label: '엔에이아이디(법인)', amount: naidFixed },
        { label: '색동 고정비', amount: saekChain.fixed },
      ],
      nonOp: [
        { label: '대출 이자', amount: body.interest ?? 0 },
        { label: '법인 이자', amount: naidInterest },
        { label: '색동 영업외', amount: saekChain.nonOp },
      ],
    }
    return {
      revenue, cogs, gross, variable, contribution, fixed, operating, nonOp, net,
      bep, bepRate, breakdowns,
      interestMissing: !!body.interestMissing,
    }
  }, [bodyPnl, rangeKey, saekChain, dianShop, range])

  // ── 디안 본체(원단 + 디안몰) 단독 손익 사슬 — 색동 오프라인 매출 제외 (원가는 색동에서 관리) ──
  // 자체 기간 선택기(bodySel) 기준 — 통합과 독립적으로 주/월/분기/년·과거 조회
  const bodyChain = useMemo(() => {
    const body = bodyPnl[bodySel.rangeKey]
    if (!body) return null
    const saekOffline = seriesRevenue(saekOff, bodySel.range)
    const shopSupply = Math.round(seriesRevenue(dianShop, bodySel.range) / 1.1) // 디안 원단몰 — 본체 매출 편입
    const revenue = body.sales - saekOffline + shopSupply
    const cogs = body.fabricCogs
    const gross = revenue - cogs
    const variable = body.expenses + body.shipping
    const contribution = gross - variable
    const fixed = body.fixed
    const operating = contribution - fixed
    const nonOp = body.interest ?? 0
    const net = operating - nonOp
    const bepRate = fixed > 0 ? (contribution / fixed) * 100 : null
    const bep = fixed > 0 && contribution > 0 ? Math.round((fixed * revenue) / contribution) : null
    const breakdowns = {
      cogs: [
        { label: '판매원가(단가표)', amount: body.soldCogs ?? body.fabricCogs },
        { label: '해외운임·관세', amount: body.freightCogs ?? 0 },
      ],
      variable: [
        { label: '당일지출', amount: body.expenses },
        { label: '국내 배송', amount: body.shipping },
      ],
      fixed: body.fixedBreakdown ?? [],
      nonOp: [{ label: '대출 이자', amount: body.interest ?? 0 }],
    }
    return { revenue, cogs, gross, variable, contribution, fixed, operating, nonOp, net, bep, bepRate, breakdowns }
  }, [bodyPnl, bodySel.rangeKey, saekOff, dianShop, bodySel.range])

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
          · {range.label} · 공급가 기준 · 디안 본체 + 색동 (엔에이아이디 연동 예정)
        </span>
        <div className="ml-auto">
          <PeriodButtons sel={main} />
        </div>
      </div>

      {/* 과거 기간 선택 — 26년 내 지나간 주·월·분기 조회 */}
      <PastPicker sel={main} />

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
            · {range.label} · 본체 + 색동 통합 (엔에이아이디 연동 예정)
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
              bep={chain.bep}
              bepRate={chain.bepRate}
              breakdowns={chain.breakdowns}
              periodKey={rangeKey}
            />
            {/* 숫자 스트립 — 다이어그램과 동일 사슬 */}
            <ChainStrip chain={chain} />
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
              공급가 기준 · 총매출 = 일계표 + 색동 온라인 + 디안 쇼핑몰(÷1.1 환산, 원가 미연동) ·
              매출원가 = 본체 판매원가(단가표) + 운임·관세 + 색동 매입·기준단가 추정 · 변동비 =
              관리회계 변동 판관비 + 국내 배송 + 색동 변동 · 고정비 = 관리회계 고정 판관비 ·
              순이익 = 영업이익 − 영업외비용(색동 등록분 + 대출이자) — 종소세·법인세 반영 전
              {range.weekMode && !range.isCurrentWeek && ' · 지난 주의 색동 온라인 매출은 월 매출 일할 배분 근사'}
              {chain.interestMissing && ' · ⚠ 대출 이자 미연동 (loan_payments SQL 실행 대기)'}
            </p>
          </>
        )}
      </div>

      {/* 디안 본체 — 원단 사업 단독 (사업체별 전략용) */}
      <div
        className="bg-white p-4 sm:p-5"
        style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}
      >
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="text-[14px] font-bold text-slate-900">
            디안 본체는 이렇게 벌고 쓴다
          </h3>
          <span className="text-[11px] text-slate-400">
            · {bodySel.range.label} · 일계표 + 디안 쇼핑몰 (색동 오프라인 매출 제외)
          </span>
          <div className="ml-auto">
            <PeriodButtons sel={bodySel} />
          </div>
        </div>
        <div className="mb-2">
          <PastPicker sel={bodySel} />
        </div>
        {loading || !bodyChain ? (
          <p className="py-8 text-center text-[12px] text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            본체 손익 계산 중...
          </p>
        ) : (
          <>
            <ProfitFlow
              revenue={bodyChain.revenue}
              cogs={bodyChain.cogs}
              gross={bodyChain.gross}
              variable={bodyChain.variable}
              contribution={bodyChain.contribution}
              fixed={bodyChain.fixed}
              operating={bodyChain.operating}
              nonOp={bodyChain.nonOp}
              net={bodyChain.net}
              bep={bodyChain.bep}
              bepRate={bodyChain.bepRate}
              breakdowns={bodyChain.breakdowns}
              nonOpLabel="대출 이자"
              periodKey={`body-${bodySel.rangeKey}`}
            />
            <ChainStrip chain={bodyChain} nonOpLabel="대출 이자" />
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
              매출 = 일계표 + 디안 쇼핑몰(÷1.1 공급가 환산, 원가 미연동) − 색동 오프라인(해당
              원가는 색동에서 관리) · 매출원가 = 판매수량×단가표(TMS) 원가 + 해외운임·관세
              {bodyPnl[bodySel.rangeKey]?.cogsCoverage != null &&
                ` (단가표 매칭 ${bodyPnl[bodySel.rangeKey]!.cogsCoverage}%)`}{' '}
              · 원단 매입 인보이스는 재고 취득으로 손익 미반영 · 변동비 = 관리회계 변동 판관비 +
              국내 배송 · 고정비 = 관리회계 고정 판관비 (월 시트 업로드 기준) · 순이익 = 영업이익 −
              대출 이자 (종합소득세 반영 전)
            </p>
          </>
        )}
      </div>

      {/* 엔에이아이디 (법인) — 연동 예정 슬롯 */}
      <div
        className="bg-white p-4 sm:p-5"
        style={{ border: '1px dashed var(--nv-hairline, #cbd5e1)', borderRadius: '2px' }}
      >
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <h3 className="text-[14px] font-bold text-slate-900">
            엔에이아이디(법인)는 이렇게 벌고 쓴다
          </h3>
          <span className="text-[11px] text-slate-400">
            · {range.label} · 비용 반영 중 (관리회계 명세 자동 분류) · 매출 연동 예정
          </span>
        </div>
        {bodyPnl[rangeKey]?.naid && (bodyPnl[rangeKey]!.naid!.fixed > 0 || bodyPnl[rangeKey]!.naid!.interest > 0) ? (
          <div className="flex flex-wrap items-stretch gap-y-4 px-4 py-4" style={{ backgroundColor: '#000', borderRadius: '2px' }}>
            <StripMetric label="법인 운영비 (임대·급여·4대보험 등)" value={bodyPnl[rangeKey]!.naid!.fixed} big first />
            <StripMetric label="법인 대출이자" value={bodyPnl[rangeKey]!.naid!.interest} negative dim />
            <StripMetric label="법인 비용 합계" value={bodyPnl[rangeKey]!.naid!.fixed + bodyPnl[rangeKey]!.naid!.interest} />
          </div>
        ) : (
          <p className="py-3 text-[12px] text-slate-400">이 기간의 법인 비용 자료(관리회계 명세)가 없습니다.</p>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          관리회계 명세의 &lsquo;법인&rsquo; 항목이 자동으로 여기에 잡히고, 위 통합(디안 전체) 손익의
          고정비·영업외에도 반영됩니다 · 법인 매출·매입 자료가 들어오면 생키 + 스트립 + BEP 전체
          형식으로 확장됩니다
        </p>
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
            <Cell first label={`총매출 · ${range.label}`} big>
              <span style={{ color: '#76b900' }}>{formatKRW(m.total)}</span>
            </Cell>
            <Cell label="디안 본체 (원단 + 쇼핑몰)">
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
            <Cell label={`${m.lastLabel} 총비용`}>
              {m.pulseCosts == null ? (
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span>
              ) : (
                <>
                  <span style={{ color: '#f87171' }}>{formatKRW(m.pulseCosts.total)}</span>
                  <p className="mt-1 text-[11px] font-bold tabular-nums" style={{ color: 'rgba(248,113,113,0.85)' }}>
                    매출 대비 {m.pulseCosts.rate == null ? '—' : `${m.pulseCosts.rate.toFixed(1)}%`}
                  </p>
                  <p className="mt-0.5 text-[10px] tabular-nums" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    원가 {formatKRW(m.pulseCosts.cogs)} · 변동 {formatKRW(m.pulseCosts.variable)} · 고정 {formatKRW(m.pulseCosts.fixed)}
                  </p>
                </>
              )}
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

function pct(v: number, base: number): number {
  return base > 0 ? (v / base) * 100 : 0
}

/** 주/월/분기/년 버튼 — 블록별 독립 선택기 */
function PeriodButtons({ sel }: { sel: PeriodSel }) {
  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-slate-200">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => sel.setPeriod(p.key)}
          className="h-8 px-3.5 text-[12px] font-bold transition-colors"
          style={{
            backgroundColor: sel.period === p.key ? 'var(--nv-primary)' : 'white',
            color: sel.period === p.key ? '#000' : 'var(--nv-mute)',
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

/** 과거 기간 선택 줄 — 월 1~12 / 분기 1~4 / 주 ◀▶ (년은 없음) */
function PastPicker({ sel }: { sel: PeriodSel }) {
  if (sel.period === 'year') return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {sel.period === 'month' &&
        Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => {
          const active = Math.min(sel.selMonth, sel.nowM) === mm
          return (
            <button
              key={mm}
              type="button"
              disabled={mm > sel.nowM}
              onClick={() => sel.setSelMonth(mm)}
              className="h-7 px-2.5 text-[11px] font-bold transition-colors disabled:opacity-25"
              style={{
                border: '1px solid var(--nv-hairline, #e2e8f0)',
                borderRadius: '2px',
                backgroundColor: active ? '#000' : 'white',
                color: active ? '#fff' : '#64748b',
              }}
            >
              {mm}월
            </button>
          )
        })}
      {sel.period === 'quarter' &&
        [1, 2, 3, 4].map((q) => {
          const active = Math.min(sel.selQuarter, sel.curQ) === q
          return (
            <button
              key={q}
              type="button"
              disabled={q > sel.curQ}
              onClick={() => sel.setSelQuarter(q)}
              className="h-7 px-3 text-[11px] font-bold transition-colors disabled:opacity-25"
              style={{
                border: '1px solid var(--nv-hairline, #e2e8f0)',
                borderRadius: '2px',
                backgroundColor: active ? '#000' : 'white',
                color: active ? '#fff' : '#64748b',
              }}
            >
              {q}분기
            </button>
          )
        })}
      {sel.period === 'week' && (
        <>
          <button
            type="button"
            disabled={sel.range.start <= `${kstToday().slice(0, 4)}-01-01`}
            onClick={() => sel.setWeekOffset((o) => o + 1)}
            className="h-7 px-2.5 text-[11px] font-bold bg-white disabled:opacity-25"
            style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px', color: '#64748b' }}
          >
            ◀ 이전 주
          </button>
          <span className="px-1 text-[12px] font-bold tabular-nums text-slate-800">
            {sel.range.label}
            {sel.weekOffset === 0 && <span className="ml-1 text-[10px] font-normal text-slate-400">(이번 주)</span>}
          </span>
          <button
            type="button"
            disabled={sel.weekOffset === 0}
            onClick={() => sel.setWeekOffset((o) => Math.max(0, o - 1))}
            className="h-7 px-2.5 text-[11px] font-bold bg-white disabled:opacity-25"
            style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px', color: '#64748b' }}
          >
            다음 주 ▶
          </button>
        </>
      )}
    </div>
  )
}

/** 손익 사슬 데이터 — 통합·본체·(추후) 법인 스트립이 공유 */
interface ChainData {
  revenue: number
  cogs: number
  gross: number
  variable: number
  contribution: number
  fixed: number
  operating: number
  nonOp: number
  net: number
  bep: number | null
  bepRate: number | null
}

/** 검은 숫자 스트립 — 사슬 전체 + BEP (색동 계기판과 동일 포맷) */
function ChainStrip({
  chain, netLabel = '순이익', nonOpLabel = '영업외·이자',
}: {
  chain: ChainData
  netLabel?: string
  nonOpLabel?: string
}) {
  return (
    <div className="mt-3 px-4 py-5 sm:px-6" style={{ backgroundColor: '#000', borderRadius: '2px' }}>
      <div className="flex flex-wrap items-stretch gap-y-5">
        <StripMetric label="매출" value={chain.revenue} big first />
        <StripMetric label="매출원가" value={chain.cogs} negative dim />
        <StripMetric label="매출총이익" value={chain.gross} rate={pct(chain.gross, chain.revenue)} />
        <StripMetric label="변동비" value={chain.variable} negative dim />
        <StripMetric label="공헌이익" value={chain.contribution} rate={pct(chain.contribution, chain.revenue)} />
        <StripMetric label="고정비" value={chain.fixed} negative dim />
        <StripMetric label="영업이익" value={chain.operating} rate={pct(chain.operating, chain.revenue)} big />
        {chain.nonOp > 0 && (
          <>
            <StripMetric label={nonOpLabel} value={chain.nonOp} negative dim />
            <StripMetric label={netLabel} value={chain.net} rate={pct(chain.net, chain.revenue)} big />
          </>
        )}
        {/* BEP — 공헌이익 ÷ 고정비 */}
        <div className="px-4 sm:px-5" style={{ borderLeft: '1px solid rgba(255,255,255,0.14)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            BEP 달성률
          </p>
          <p
            className="mt-1 font-bold tabular-nums leading-none text-[24px] sm:text-[28px]"
            style={{ color: chain.bepRate == null ? 'rgba(255,255,255,0.35)' : chain.bepRate >= 100 ? '#76b900' : '#f87171' }}
          >
            {chain.bepRate == null ? '—' : `${chain.bepRate.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {chain.bepRate == null
              ? '고정비 미등록'
              : chain.bep == null
                ? 'BEP 매출 산출 불가 (공헌이익 적자)'
                : `BEP 매출 ${formatKRW(chain.bep)}`}
          </p>
        </div>
      </div>
    </div>
  )
}

/** 검은 스트립 숫자 셀 — 색동 계기판과 동일 포맷 */
function StripMetric({
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
