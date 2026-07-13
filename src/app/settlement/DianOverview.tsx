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
import { rangeFor, seriesRevenue, kstToday, type Period, type PeriodRange } from '@/lib/period-range'
import { makeFcCtx, prev6Range, estOr, deriveChain, type FcChain } from './forecast'

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

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
  { key: 'quarter', label: '분기' },
  { key: 'half', label: '반기' },
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
  freightBreakdown?: { label: string; amount: number }[] // 해외운임 세부 — 항공/배/관세
  varBreakdown?: { label: string; amount: number }[] // 변동 판관비 대분류 (관리회계)
  // 엔에이아이디(법인): 매출·매입 = 세금계산서 / 운영비·이자 = 관리회계 명세
  naid?: { sales?: number; cogs?: number; fixed: number; interest: number }
  interest: number
  interestMissing?: boolean
  error?: string
}

/** 색동 기간 손익 재료 — 색동 계기판과 동일 규칙 (매입 + 원가성격 비용 + 기준단가 추정, 판관비 배분) */
function computeSaekPnl(
  saekCosts: { purchases: SaekdongPurchase[]; expenses: SaekdongExpense[]; itemCosts: SaekdongItemCost[] } | null,
  saekOn: SeriesData | null,
  range: PeriodRange,
) {
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
  const purch = purchases.filter((pu) => inPeriod(pu.purchase_date)).reduce((s, pu) => s + pu.amount, 0)
  const cogsExpense = expSum((e) => e.nature === '매출원가')
  const stdEstimate = Math.round(onlineSupply * stdRate)
  return {
    onlineSupply,
    purch,
    cogsExpense,
    stdEstimate,
    cogs: purch + cogsExpense + stdEstimate,
    variable: expSum((e) => e.cost_type === 'variable' && e.nature === '판관비'),
    fixed: expSum((e) => e.cost_type === 'fixed' && e.nature === '판관비'),
    nonOp: expSum((e) => e.nature === '영업외비용'),
  }
}

/** 기간 선택 상태 묶음 — 블록마다 독립 선택 (통합·본체·추후 법인) */
function usePeriodSel() {
  const nowM = Number(kstToday().slice(5, 7))
  const curQ = Math.floor((nowM - 1) / 3) + 1
  const curH = nowM <= 6 ? 1 : 2
  const [period, setPeriod] = useState<Period>('month')
  const [selMonth, setSelMonth] = useState(nowM)
  const [selQuarter, setSelQuarter] = useState(curQ)
  const [selHalf, setSelHalf] = useState(curH)
  const [weekOffset, setWeekOffset] = useState(0)
  const range = useMemo(
    () => rangeFor(period, selMonth, selQuarter, weekOffset, selHalf),
    [period, selMonth, selQuarter, weekOffset, selHalf],
  )
  return {
    period, setPeriod, selMonth, setSelMonth, selQuarter, setSelQuarter,
    selHalf, setSelHalf, weekOffset, setWeekOffset, nowM, curQ, curH, range,
    rangeKey: `${range.start}_${range.end}`,
  }
}
type PeriodSel = ReturnType<typeof usePeriodSel>

export default function DianOverview() {
  const main = usePeriodSel()
  const { period, range, rangeKey } = main
  const bodySel = usePeriodSel() // 본체 블록 독립 선택
  const naidSel = usePeriodSel() // 법인(엔에이아이디) 블록 독립 선택
  const saekSel = usePeriodSel() // 색동 블록 독립 선택
  const shareSel = usePeriodSel() // 매출 비중 도넛 독립 선택 (주 제외)
  const [saekOn, setSaekOn] = useState<SeriesData | null>(null)
  const [saekOff, setSaekOff] = useState<SeriesData | null>(null)
  const [dianShop, setDianShop] = useState<SeriesData | null>(null) // 디안 원단몰 — 본체 매출에 편입
  const [saekCosts, setSaekCosts] = useState<{
    purchases: SaekdongPurchase[]
    expenses: SaekdongExpense[]
    itemCosts: SaekdongItemCost[]
  } | null>(null)
  const [bodyPnl, setBodyPnl] = useState<Record<string, BodyPnl>>({})
  const [loading, setLoading] = useState(true)
  // 월중 예상 토글 — 블록별 독립 (이번 달 조회 시에만 노출, 대표 지시 2026-07-13)
  const [fcMain, setFcMain] = useState(false)
  const [fcBody, setFcBody] = useState(false)
  const [fcNaid, setFcNaid] = useState(false)
  const [fcSaek, setFcSaek] = useState(false)
  const fcCtx = useMemo(() => makeFcCtx(kstToday()), [])
  const avg6 = useMemo(() => prev6Range(kstToday()), [])
  const avgKey = `avg6_${avg6.start}`

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
  useEffect(() => {
    fetchPnlFor(naidSel.rangeKey, naidSel.range.start, naidSel.range.end)
  }, [naidSel.rangeKey, naidSel.range.start, naidSel.range.end, fetchPnlFor])
  useEffect(() => {
    fetchPnlFor(shareSel.rangeKey, shareSel.range.start, shareSel.range.end)
  }, [shareSel.rangeKey, shareSel.range.start, shareSel.range.end, fetchPnlFor])
  // 예상 켜면 지난 6개월 평균 재료 1회 로드
  useEffect(() => {
    if (fcMain || fcBody || fcNaid) fetchPnlFor(avgKey, avg6.start, avg6.end)
  }, [fcMain, fcBody, fcNaid, avgKey, avg6.start, avg6.end, fetchPnlFor])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, o, sc, ds] = await Promise.all([
        fetchSharedSales<SeriesData>().catch(() => null),
        fetchSharedOffline<SeriesData>().catch(() => null),
        listSaekdongCosts().catch(() => null),
        // 디안 원단몰 (아임웹 2호점) — 본체 매출에 편입
        fetchSharedDianShop<SeriesData>().catch(() => null),
      ])
      setSaekOn(s)
      setSaekOff(o)
      setDianShop(ds)
      if (sc) setSaekCosts({ purchases: sc.purchases, expenses: sc.expenses, itemCosts: sc.itemCosts })
    } catch {
      // 부가 표시 — 실패 시 0
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // 매출 비중 도넛 데이터 — 본체(원단+쇼핑몰) / 색동(온+오프) / 법인, 독립 기간 선택
  const shareData = useMemo(() => {
    const body = bodyPnl[shareSel.rangeKey]
    if (!body) return null
    const saekOffline = seriesRevenue(saekOff, shareSel.range)
    const saekOnline = Math.round(seriesRevenue(saekOn, shareSel.range) / 1.1)
    const shopSupply = Math.round(seriesRevenue(dianShop, shareSel.range) / 1.1)
    const bodyRev = body.sales - saekOffline + shopSupply
    const naidRev = body.naid?.sales ?? 0
    const saekRev = saekOnline + saekOffline
    return { bodyRev, saekRev, naidRev, total: bodyRev + saekRev + naidRev }
  }, [bodyPnl, shareSel.rangeKey, shareSel.range, saekOn, saekOff, dianShop])

  // ── 색동 기간 손익 재료 (색동 계기판과 동일 규칙, 과거 기간 지원) — 통합 합산용 ──
  const saekChain = useMemo(() => computeSaekPnl(saekCosts, saekOn, range), [saekCosts, saekOn, range])

  // ── 색동 블록 손익 사슬 (독립 선택기 saekSel — 생키용 전체 사슬) ──
  const saekBlockChain = useMemo(() => {
    const p = computeSaekPnl(saekCosts, saekOn, saekSel.range)
    const offline = saekOff && !saekOff.error ? seriesRevenue(saekOff, saekSel.range) : 0
    const revenue = p.onlineSupply + offline
    const gross = revenue - p.cogs
    const contribution = gross - p.variable
    const operating = contribution - p.fixed
    const net = operating - p.nonOp
    const bepRate = p.fixed > 0 ? (contribution / p.fixed) * 100 : null
    const bep = p.fixed > 0 && contribution > 0 ? Math.round((p.fixed * revenue) / contribution) : null
    return {
      revenue, cogs: p.cogs, gross, variable: p.variable, contribution,
      fixed: p.fixed, operating, nonOp: p.nonOp, net, bep, bepRate,
      breakdowns: {
        cogs: [
          { label: '매입 등록분', amount: p.purch },
          { label: '원가 성격 비용', amount: p.cogsExpense },
          { label: '기준단가 추정', amount: p.stdEstimate },
        ],
        variable: [{ label: '색동 변동 판관비', amount: p.variable }],
        fixed: [{ label: '색동 고정 판관비', amount: p.fixed }],
        nonOp: [{ label: '색동 영업외', amount: p.nonOp }],
      },
    }
  }, [saekCosts, saekOn, saekOff, saekSel.range])

  // ── 회사 전체 손익 사슬 = 본체(일계표 + 디안몰) + 색동 (오프라인은 본체에 포함 — 이중계상 없음) ──
  const chain = useMemo(() => {
    const body = bodyPnl[rangeKey]
    if (!body) return null
    const shopSupply = Math.round(seriesRevenue(dianShop, range) / 1.1) // 디안 원단몰 — 본체 소속 (원가 미연동)
    const naidSales = body.naid?.sales ?? 0
    const naidCogs = body.naid?.cogs ?? 0
    const revenue = body.sales + saekChain.onlineSupply + shopSupply + naidSales
    const cogs = body.fabricCogs + saekChain.cogs + naidCogs
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
    // 비용 세부 구성 — 자료가 등록된 만큼 갈라짐 표시 (자료 늘면 자동 세분화)
    const freightItems = body.freightBreakdown?.length
      ? body.freightBreakdown
      : [{ label: '해외운임·관세', amount: body.freightCogs ?? 0 }]
    const varItems = body.varBreakdown?.length
      ? body.varBreakdown.map((x) => ({ label: `본체 ${x.label}`, amount: x.amount }))
      : [{ label: '본체 변동 판관비', amount: body.expenses }]
    const breakdowns = {
      cogs: [
        { label: '본체 판매원가(단가표)', amount: body.soldCogs ?? body.fabricCogs },
        ...freightItems,
        { label: '법인 매입', amount: naidCogs },
        { label: '색동 매입·원가', amount: saekChain.cogs },
      ],
      variable: [
        ...varItems,
        { label: '본체 국내 배송', amount: body.shipping },
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
        ...(body.freightBreakdown?.length
          ? body.freightBreakdown
          : [{ label: '해외운임·관세', amount: body.freightCogs ?? 0 }]),
      ],
      variable: [
        ...(body.varBreakdown?.length
          ? body.varBreakdown
          : [{ label: '변동 판관비', amount: body.expenses }]),
        { label: '국내 배송', amount: body.shipping },
      ],
      fixed: body.fixedBreakdown ?? [],
      nonOp: [{ label: '대출 이자', amount: body.interest ?? 0 }],
    }
    return { revenue, cogs, gross, variable, contribution, fixed, operating, nonOp, net, bep, bepRate, breakdowns }
  }, [bodyPnl, bodySel.rangeKey, saekOff, dianShop, bodySel.range])

  // ── 엔에이아이디(법인) 손익 사슬 — 매출·매입 = 세금계산서 / 운영비·이자 = 관리회계 명세 ──
  const naidChain = useMemo(() => {
    const body = bodyPnl[naidSel.rangeKey]
    if (!body) return null
    const revenue = body.naid?.sales ?? 0
    const cogs = body.naid?.cogs ?? 0
    const fixed = body.naid?.fixed ?? 0
    const nonOp = body.naid?.interest ?? 0
    const gross = revenue - cogs
    const contribution = gross // 법인 변동비는 관리회계에 별도 항목 생기면 분리
    const operating = contribution - fixed
    const bepRate = fixed > 0 ? (contribution / fixed) * 100 : null
    const bep = fixed > 0 && contribution > 0 ? Math.round((fixed * revenue) / contribution) : null
    return {
      revenue, cogs, gross, variable: 0, contribution,
      fixed, operating, nonOp, net: operating - nonOp,
      bep, bepRate,
      breakdowns: {
        cogs: [{ label: '법인 매입(세금계산서)', amount: cogs }],
        fixed: [{ label: '법인 운영비', amount: fixed }],
        nonOp: [{ label: '법인 대출이자', amount: nonOp }],
      },
    }
  }, [bodyPnl, naidSel.rangeKey])

  // ── 월중 예상 (대표 지시 2026-07-13) — 지난 6개월 평균 재료 ──
  // 매출·판매원가·배송 = 현재 영업일 페이스 투영, 월말 입력분(월말원가·변동·고정·이자·법인) = 6개월 평균
  const avgB = bodyPnl[avgKey]
  const fcAvg = useMemo(() => {
    if (!avgB) return null
    const n = 6
    const soldTot = avgB.soldCogs ?? avgB.fabricCogs
    return {
      fixed: avgB.fixed / n,
      variable: avgB.expenses / n,
      interest: (avgB.interest ?? 0) / n,
      late: Math.max(0, avgB.fabricCogs - soldTot) / n, // 월말 원가 — 운임·관세·가공계산서
      naidSales: (avgB.naid?.sales ?? 0) / n,
      naidCogs: (avgB.naid?.cogs ?? 0) / n,
      naidFixed: (avgB.naid?.fixed ?? 0) / n,
      naidInterest: (avgB.naid?.interest ?? 0) / n,
    }
  }, [avgB])
  const avg6Range: PeriodRange = useMemo(() => {
    const months: { ym: string; w: number }[] = []
    const [sy, sm] = avg6.start.split('-').map(Number)
    for (let i = 0; i < 6; i++) {
      const dt = new Date(sy, sm - 1 + i, 1)
      months.push({ ym: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`, w: 1 })
    }
    return {
      start: avg6.start, end: avg6.end, label: '지난 6개월',
      months, weekMode: false, isCurrentWeek: false, weekOverlaps: [],
    }
  }, [avg6])
  const saekAvg = useMemo(() => {
    const p = computeSaekPnl(saekCosts, saekOn, avg6Range)
    const n = 6
    return { cogs: p.cogs / n, variable: p.variable / n, fixed: p.fixed / n, nonOp: p.nonOp / n }
  }, [saekCosts, saekOn, avg6Range])

  const isCurMonth = (sel: PeriodSel) => sel.period === 'month' && sel.selMonth === sel.nowM

  // 본체 예상 — 오늘까지 + 말일
  const bodyFc = useMemo(() => {
    if (!fcBody || !fcAvg || !isCurMonth(bodySel)) return null
    const a = bodyPnl[bodySel.rangeKey]
    if (!a) return null
    const { pace, ratio, d, D } = fcCtx
    const saekOffline = seriesRevenue(saekOff, bodySel.range)
    const shop = Math.round(seriesRevenue(dianShop, bodySel.range) / 1.1)
    const revenueA = a.sales - saekOffline + shop
    const soldA = a.soldCogs ?? a.fabricCogs
    const lateA = Math.max(0, a.fabricCogs - soldA)
    const soldP = Math.round(soldA * pace)
    const lateP = estOr(lateA, fcAvg.late)
    const varP = estOr(a.expenses, fcAvg.variable)
    const shipP = Math.round(a.shipping * pace)
    const month = deriveChain({
      revenue: Math.round(revenueA * pace),
      cogs: soldP + lateP,
      variable: varP + shipP,
      fixed: estOr(a.fixed, fcAvg.fixed),
      nonOp: estOr(a.interest ?? 0, fcAvg.interest),
    })
    const today = deriveChain({
      revenue: revenueA,
      cogs: soldA + estOr(lateA, fcAvg.late * ratio),
      variable: estOr(a.expenses, fcAvg.variable * ratio) + a.shipping,
      fixed: estOr(a.fixed, fcAvg.fixed * ratio),
      nonOp: estOr(a.interest ?? 0, fcAvg.interest * ratio),
    })
    const breakdowns = {
      cogs: [
        { label: '판매원가(페이스 투영)', amount: soldP },
        { label: '월말 원가 예상 — 운임·관세·가공', amount: lateP },
      ],
      variable: [
        { label: '변동 판관비(6개월 평균)', amount: varP },
        { label: '국내 배송(페이스 투영)', amount: shipP },
      ],
      fixed: [{ label: '고정비(6개월 평균)', amount: month.fixed }],
      nonOp: [{ label: '대출 이자(6개월 평균)', amount: month.nonOp }],
    }
    return { month: { ...month, breakdowns }, today, d, D }
  }, [fcBody, fcAvg, bodyPnl, bodySel, saekOff, dianShop, fcCtx])

  // 법인 예상 — 계산서가 띄엄띄엄이라 페이스 대신 실측·평균 중 큰 값
  const naidFc = useMemo(() => {
    if (!fcNaid || !fcAvg || !isCurMonth(naidSel)) return null
    const a = bodyPnl[naidSel.rangeKey]
    if (!a) return null
    const { ratio, d, D } = fcCtx
    const nsA = a.naid?.sales ?? 0
    const ncA = a.naid?.cogs ?? 0
    const nfA = a.naid?.fixed ?? 0
    const niA = a.naid?.interest ?? 0
    const month = deriveChain({
      revenue: estOr(nsA, fcAvg.naidSales),
      cogs: estOr(ncA, fcAvg.naidCogs),
      variable: 0,
      fixed: estOr(nfA, fcAvg.naidFixed),
      nonOp: estOr(niA, fcAvg.naidInterest),
    })
    const today = deriveChain({
      revenue: nsA,
      cogs: estOr(ncA, fcAvg.naidCogs * ratio),
      variable: 0,
      fixed: estOr(nfA, fcAvg.naidFixed * ratio),
      nonOp: estOr(niA, fcAvg.naidInterest * ratio),
    })
    const breakdowns = {
      cogs: [{ label: '법인 매입 예상(6개월 평균)', amount: month.cogs }],
      fixed: [{ label: '법인 운영비(6개월 평균)', amount: month.fixed }],
      nonOp: [{ label: '법인 이자(6개월 평균)', amount: month.nonOp }],
    }
    return { month: { ...month, breakdowns }, today, d, D }
  }, [fcNaid, fcAvg, bodyPnl, naidSel, fcCtx])

  // 색동 예상 — 매출·원가는 일 실측 페이스, 변동·고정·영업외는 지난 6개월 평균
  const saekFc = useMemo(() => {
    if (!fcSaek || !isCurMonth(saekSel)) return null
    const a = saekBlockChain
    const { pace, ratio, d, D } = fcCtx
    const month = deriveChain({
      revenue: Math.round(a.revenue * pace),
      cogs: Math.round(a.cogs * pace),
      variable: estOr(a.variable, saekAvg.variable),
      fixed: estOr(a.fixed, saekAvg.fixed),
      nonOp: estOr(a.nonOp, saekAvg.nonOp),
    })
    const today = deriveChain({
      revenue: a.revenue,
      cogs: a.cogs,
      variable: estOr(a.variable, saekAvg.variable * ratio),
      fixed: estOr(a.fixed, saekAvg.fixed * ratio),
      nonOp: estOr(a.nonOp, saekAvg.nonOp * ratio),
    })
    const breakdowns = {
      cogs: [{ label: '색동 매입·원가(페이스 투영)', amount: month.cogs }],
      variable: [{ label: '색동 변동비(6개월 평균)', amount: month.variable }],
      fixed: [{ label: '색동 고정비(6개월 평균)', amount: month.fixed }],
      nonOp: [{ label: '색동 영업외(6개월 평균)', amount: month.nonOp }],
    }
    return { month: { ...month, breakdowns }, today, d, D }
  }, [fcSaek, saekSel, saekBlockChain, saekAvg, fcCtx])

  // 통합 예상 — 본체·색동 페이스 + 월말 입력분·법인 평균
  const mainFc = useMemo(() => {
    if (!fcMain || !fcAvg || !isCurMonth(main)) return null
    const a = bodyPnl[rangeKey]
    if (!a) return null
    const { pace, ratio, d, D } = fcCtx
    const shop = Math.round(seriesRevenue(dianShop, range) / 1.1)
    const soldA = a.soldCogs ?? a.fabricCogs
    const lateA = Math.max(0, a.fabricCogs - soldA)
    const nsA = a.naid?.sales ?? 0
    const ncA = a.naid?.cogs ?? 0
    const nfA = a.naid?.fixed ?? 0
    const niA = a.naid?.interest ?? 0
    const bodySoldP = Math.round(soldA * pace)
    const lateP = estOr(lateA, fcAvg.late)
    const saekCogsP = Math.round(saekChain.cogs * pace)
    const naidCogsP = estOr(ncA, fcAvg.naidCogs)
    const bodyVarP = estOr(a.expenses, fcAvg.variable)
    const shipP = Math.round(a.shipping * pace)
    const saekVarP = estOr(saekChain.variable, saekAvg.variable)
    const bodyFixedP = estOr(a.fixed, fcAvg.fixed)
    const saekFixedP = estOr(saekChain.fixed, saekAvg.fixed)
    const naidFixedP = estOr(nfA, fcAvg.naidFixed)
    const bodyIntP = estOr(a.interest ?? 0, fcAvg.interest)
    const saekNonOpP = estOr(saekChain.nonOp, saekAvg.nonOp)
    const naidIntP = estOr(niA, fcAvg.naidInterest)
    const month = deriveChain({
      revenue:
        Math.round(a.sales * pace) + Math.round(saekChain.onlineSupply * pace) +
        Math.round(shop * pace) + estOr(nsA, fcAvg.naidSales),
      cogs: bodySoldP + lateP + saekCogsP + naidCogsP,
      variable: bodyVarP + shipP + saekVarP,
      fixed: bodyFixedP + saekFixedP + naidFixedP,
      nonOp: bodyIntP + saekNonOpP + naidIntP,
    })
    const today = deriveChain({
      revenue: a.sales + saekChain.onlineSupply + shop + nsA,
      cogs: soldA + estOr(lateA, fcAvg.late * ratio) + saekChain.cogs + estOr(ncA, fcAvg.naidCogs * ratio),
      variable:
        estOr(a.expenses, fcAvg.variable * ratio) + a.shipping +
        estOr(saekChain.variable, saekAvg.variable * ratio),
      fixed:
        estOr(a.fixed, fcAvg.fixed * ratio) + estOr(saekChain.fixed, saekAvg.fixed * ratio) +
        estOr(nfA, fcAvg.naidFixed * ratio),
      nonOp:
        estOr(a.interest ?? 0, fcAvg.interest * ratio) +
        estOr(saekChain.nonOp, saekAvg.nonOp * ratio) + estOr(niA, fcAvg.naidInterest * ratio),
    })
    const breakdowns = {
      cogs: [
        { label: '본체 판매원가(페이스 투영)', amount: bodySoldP },
        { label: '월말 원가 예상 — 운임·관세·가공', amount: lateP },
        { label: '법인 매입 예상', amount: naidCogsP },
        { label: '색동 매입·원가(페이스)', amount: saekCogsP },
      ],
      variable: [
        { label: '본체 변동 판관비(6개월 평균)', amount: bodyVarP },
        { label: '본체 국내 배송(페이스)', amount: shipP },
        { label: '색동 변동비(예상)', amount: saekVarP },
      ],
      fixed: [
        { label: '본체 고정비(6개월 평균)', amount: bodyFixedP },
        { label: '엔에이아이디(법인) 예상', amount: naidFixedP },
        { label: '색동 고정비(예상)', amount: saekFixedP },
      ],
      nonOp: [
        { label: '대출 이자(6개월 평균)', amount: bodyIntP },
        { label: '법인 이자(예상)', amount: naidIntP },
        { label: '색동 영업외(예상)', amount: saekNonOpP },
      ],
    }
    return { month: { ...month, breakdowns }, today, d, D }
  }, [fcMain, fcAvg, bodyPnl, rangeKey, main, range, dianShop, saekChain, saekAvg, fcCtx])

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
        <div className="ml-auto flex items-center gap-1.5">
          <ForecastButton on={fcMain} setOn={setFcMain} visible={isCurMonth(main)} />
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
              revenue={(mainFc?.month ?? chain).revenue}
              cogs={(mainFc?.month ?? chain).cogs}
              gross={(mainFc?.month ?? chain).gross}
              variable={(mainFc?.month ?? chain).variable}
              contribution={(mainFc?.month ?? chain).contribution}
              fixed={(mainFc?.month ?? chain).fixed}
              operating={(mainFc?.month ?? chain).operating}
              nonOp={(mainFc?.month ?? chain).nonOp}
              net={(mainFc?.month ?? chain).net}
              bep={(mainFc?.month ?? chain).bep}
              bepRate={(mainFc?.month ?? chain).bepRate}
              breakdowns={(mainFc?.month ?? chain).breakdowns}
              periodKey={mainFc ? `${rangeKey}-fc` : rangeKey}
            />
            {fcMain && isCurMonth(main) && <ForecastStrip fc={mainFc} actualNet={chain.net} />}
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
          <div className="ml-auto flex items-center gap-1.5">
            <ForecastButton on={fcBody} setOn={setFcBody} visible={isCurMonth(bodySel)} />
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
              revenue={(bodyFc?.month ?? bodyChain).revenue}
              cogs={(bodyFc?.month ?? bodyChain).cogs}
              gross={(bodyFc?.month ?? bodyChain).gross}
              variable={(bodyFc?.month ?? bodyChain).variable}
              contribution={(bodyFc?.month ?? bodyChain).contribution}
              fixed={(bodyFc?.month ?? bodyChain).fixed}
              operating={(bodyFc?.month ?? bodyChain).operating}
              nonOp={(bodyFc?.month ?? bodyChain).nonOp}
              net={(bodyFc?.month ?? bodyChain).net}
              bep={(bodyFc?.month ?? bodyChain).bep}
              bepRate={(bodyFc?.month ?? bodyChain).bepRate}
              breakdowns={(bodyFc?.month ?? bodyChain).breakdowns}
              nonOpLabel="대출 이자"
              periodKey={bodyFc ? `body-${bodySel.rangeKey}-fc` : `body-${bodySel.rangeKey}`}
            />
            {fcBody && isCurMonth(bodySel) && <ForecastStrip fc={bodyFc} actualNet={bodyChain.net} />}
          </>
        )}
      </div>

      {/* 엔에이아이디 (법인) — 연동 예정 슬롯 */}
      <div
        className="bg-white p-4 sm:p-5"
        style={{ border: '1px dashed var(--nv-hairline, #cbd5e1)', borderRadius: '2px' }}
      >
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="text-[14px] font-bold text-slate-900">
            엔에이아이디(법인)는 이렇게 벌고 쓴다
          </h3>
          <span className="text-[11px] text-slate-400">
            · {naidSel.range.label} · 매출·매입 = 세금계산서 · 운영비·이자 = 관리회계 명세
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <ForecastButton on={fcNaid} setOn={setFcNaid} visible={isCurMonth(naidSel)} />
            <PeriodButtons sel={naidSel} />
          </div>
        </div>
        <div className="mb-2">
          <PastPicker sel={naidSel} />
        </div>
        {!naidChain ? (
          <p className="py-8 text-center text-[12px] text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            법인 손익 계산 중...
          </p>
        ) : (
          <>
            <ProfitFlow
              revenue={(naidFc?.month ?? naidChain).revenue}
              cogs={(naidFc?.month ?? naidChain).cogs}
              gross={(naidFc?.month ?? naidChain).gross}
              variable={(naidFc?.month ?? naidChain).variable}
              contribution={(naidFc?.month ?? naidChain).contribution}
              fixed={(naidFc?.month ?? naidChain).fixed}
              operating={(naidFc?.month ?? naidChain).operating}
              nonOp={(naidFc?.month ?? naidChain).nonOp}
              net={(naidFc?.month ?? naidChain).net}
              bep={(naidFc?.month ?? naidChain).bep}
              bepRate={(naidFc?.month ?? naidChain).bepRate}
              breakdowns={(naidFc?.month ?? naidChain).breakdowns}
              nonOpLabel="법인 이자"
              periodKey={naidFc ? `naid-${naidSel.rangeKey}-fc` : `naid-${naidSel.rangeKey}`}
            />
            {fcNaid && isCurMonth(naidSel) && <ForecastStrip fc={naidFc} actualNet={naidChain.net} naid />}
          </>
        )}
      </div>

      {/* 색동 — 신사업 (색동 계기판과 동일 규칙) */}
      <div
        className="bg-white p-4 sm:p-5"
        style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}
      >
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="text-[14px] font-bold text-slate-900">
            색동은 이렇게 벌고 쓴다
          </h3>
          <span className="text-[11px] text-slate-400">
            · {saekSel.range.label} · 온라인(공급가) + 오프라인 · 비용 = 색동 계기판 등록분
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <ForecastButton on={fcSaek} setOn={setFcSaek} visible={isCurMonth(saekSel)} />
            <PeriodButtons sel={saekSel} />
          </div>
        </div>
        <div className="mb-2">
          <PastPicker sel={saekSel} />
        </div>
        {loading ? (
          <p className="py-8 text-center text-[12px] text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            색동 손익 계산 중...
          </p>
        ) : (
          <>
            <ProfitFlow
              revenue={(saekFc?.month ?? saekBlockChain).revenue}
              cogs={(saekFc?.month ?? saekBlockChain).cogs}
              gross={(saekFc?.month ?? saekBlockChain).gross}
              variable={(saekFc?.month ?? saekBlockChain).variable}
              contribution={(saekFc?.month ?? saekBlockChain).contribution}
              fixed={(saekFc?.month ?? saekBlockChain).fixed}
              operating={(saekFc?.month ?? saekBlockChain).operating}
              nonOp={(saekFc?.month ?? saekBlockChain).nonOp}
              net={(saekFc?.month ?? saekBlockChain).net}
              bep={(saekFc?.month ?? saekBlockChain).bep}
              bepRate={(saekFc?.month ?? saekBlockChain).bepRate}
              breakdowns={(saekFc?.month ?? saekBlockChain).breakdowns}
              nonOpLabel="영업외"
              periodKey={saekFc ? `saek-${saekSel.rangeKey}-fc` : `saek-${saekSel.rangeKey}`}
            />
            {fcSaek && isCurMonth(saekSel) && <ForecastStrip fc={saekFc} actualNet={saekBlockChain.net} />}
          </>
        )}
      </div>

      {/* 매출 비중 도넛 — 디안 전체 매출 중 본체·색동·법인 */}
      <div
        className="bg-white p-4 sm:p-5"
        style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}
      >
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="text-[14px] font-bold text-slate-900">디안 매출 비중 — 어디서 벌고 있나</h3>
          <span className="text-[11px] text-slate-400">
            · {shareSel.range.label} · 공급가 기준 · 본체(원단+쇼핑몰) / 색동 / 법인
          </span>
          <div className="ml-auto">
            <PeriodButtons sel={shareSel} exclude={['week']} />
          </div>
        </div>
        <div className="mb-2">
          <PastPicker sel={shareSel} />
        </div>
        {loading || !shareData ? (
          <p className="py-8 text-center text-[12px] text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            매출 비중 계산 중...
          </p>
        ) : (
          <RevenueShareDonut data={shareData} periodKey={shareSel.rangeKey} />
        )}
      </div>
    </div>
  )
}

/** 주/월/분기/반기/년 버튼 — 블록별 독립 선택기 (exclude 로 일부 기간 숨김) */
/** 월중 예상 토글 — 이번 달 조회 시에만 노출 (대표 지시 2026-07-13) */
function ForecastButton({ on, setOn, visible }: { on: boolean; setOn: (v: boolean) => void; visible: boolean }) {
  if (!visible) return null
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      className="h-6 px-2 text-[10px] font-bold"
      style={{
        borderRadius: '2px',
        border: '1px solid',
        borderColor: on ? '#f59e0b' : '#e2e8f0',
        backgroundColor: on ? '#fffbeb' : '#fff',
        color: on ? '#b45309' : '#64748b',
      }}
      title="월말 입력분(월말 원가·변동·고정·이자·법인)을 지난 6개월 평균으로 채워 오늘까지·말일 예상 순이익을 계산"
    >
      {on ? '📈 예상 ON' : '예상'}
    </button>
  )
}

/** 예상 근거 스트립 — 오늘까지·말일 순이익 + 계산 근거 */
function ForecastStrip({
  fc, actualNet, naid,
}: {
  fc: { month: FcChain; today: FcChain; d: number; D: number } | null
  actualNet: number
  naid?: boolean
}) {
  if (!fc) {
    return (
      <p className="mt-2 text-[11px] text-slate-400">
        <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
        지난 6개월 평균 계산 중...
      </p>
    )
  }
  const net = (v: number) => (
    <b style={{ color: v >= 0 ? 'var(--nv-success-deep, #4a7c00)' : '#dc2626' }}>{formatKRW(v)}</b>
  )
  return (
    <div
      className="mt-2 px-3 py-2 text-[11px] leading-relaxed"
      style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: '2px' }}
    >
      <span className="font-bold">📈 예상 모드</span> — 위 흐름은 <b>말일 예상</b>입니다.
      오늘까지({fc.d}/{fc.D} 영업일) 예상 순이익 {net(fc.today.net)} · <b>말일 예상 순이익 {net(fc.month.net)}</b>
      <span className="text-slate-400"> (실측만으로는 {formatKRW(actualNet)})</span>
      <br />
      <span style={{ color: '#b45309' }}>
        {naid
          ? '법인 매출·매입·운영비·이자는 실측과 지난 6개월 평균 중 큰 값.'
          : '매출·판매원가·배송 = 현재 영업일 페이스로 투영 · 월말 원가(운임·관세·가공)·변동비·고정비·이자 = 실측과 지난 6개월 평균 중 큰 값.'}
        {' '}자료가 업로드될수록 실측으로 대체됩니다.
      </span>
    </div>
  )
}

function PeriodButtons({ sel, exclude }: { sel: PeriodSel; exclude?: Period[] }) {
  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-slate-200">
      {PERIODS.filter((p) => !exclude?.includes(p.key)).map((p) => (
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
      {sel.period === 'half' &&
        [1, 2].map((h) => {
          const active = Math.min(sel.selHalf, sel.curH) === h
          return (
            <button
              key={h}
              type="button"
              disabled={h > sel.curH}
              onClick={() => sel.setSelHalf(h)}
              className="h-7 px-3 text-[11px] font-bold transition-colors disabled:opacity-25"
              style={{
                border: '1px solid var(--nv-hairline, #e2e8f0)',
                borderRadius: '2px',
                backgroundColor: active ? '#000' : 'white',
                color: active ? '#fff' : '#64748b',
              }}
            >
              {h === 1 ? '상반기 (1~6월)' : '하반기 (7~12월)'}
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

/** 매출 비중 도넛 — 디안 전체 매출 중 본체·색동·법인 구성 (타이포 + 원형) */
function RevenueShareDonut({
  data, periodKey,
}: {
  data: { bodyRev: number; saekRev: number; naidRev: number; total: number }
  periodKey: string
}) {
  const segs = [
    { label: '디안 본체', sub: '원단 + 쇼핑몰', value: Math.max(0, data.bodyRev), color: '#76b900' },
    { label: '색동', sub: '온라인 + 오프라인', value: Math.max(0, data.saekRev), color: '#38bdf8' },
    { label: '엔에이아이디', sub: '법인 · 세금계산서', value: Math.max(0, data.naidRev), color: '#a78bfa' },
  ]
  const total = segs.reduce((s, x) => s + x.value, 0)
  const R = 74
  const STROKE = 30
  const C = 2 * Math.PI * R

  // 도넛 호 — stroke-dasharray 로 비율만큼, -90°에서 시작해 시계방향 누적
  let acc = 0
  const arcs = segs.map((sg) => {
    const frac = total > 0 ? sg.value / total : 0
    const a = { ...sg, frac, offset: acc }
    acc += frac
    return a
  })

  return (
    <div key={periodKey} className="flex flex-wrap items-center gap-x-10 gap-y-5 py-2">
      {/* 원형 그래프 */}
      <div className="relative shrink-0 mx-auto sm:mx-0">
        <svg width={200} height={200} viewBox="0 0 200 200" role="img" aria-label="사업체별 매출 비중">
          <circle cx="100" cy="100" r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
          {total > 0 &&
            arcs.filter((a) => a.frac > 0).map((a) => (
              <circle
                key={a.label}
                cx="100" cy="100" r={R} fill="none"
                stroke={a.color} strokeWidth={STROKE}
                strokeDasharray={`${Math.max(0.5, a.frac * C - 1.5)} ${C}`}
                strokeDashoffset={-a.offset * C}
                transform="rotate(-90 100 100)"
              />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">총매출</span>
          <span className="text-[17px] font-bold tabular-nums text-slate-900 leading-tight">
            {formatKRW(total)}
          </span>
        </div>
      </div>

      {/* 타이포 범례 — 비중이 큰 순서 */}
      <div className="flex-1 min-w-[240px] grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
        {[...arcs].sort((a, b) => b.value - a.value).map((a) => (
          <div key={a.label}>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: a.color }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{a.label}</span>
            </div>
            <p className="mt-1 text-[26px] sm:text-[30px] font-bold tabular-nums leading-none" style={{ color: a.color }}>
              {total > 0 ? `${(a.frac * 100).toFixed(1)}%` : '—'}
            </p>
            <p className="mt-1 text-[13px] font-bold tabular-nums text-slate-800">{formatKRW(a.value)}</p>
            <p className="text-[10px] text-slate-400">{a.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
