'use client'

/**
 * 색동 펄스 — 한 줄 모션 타이포 전광판.
 *
 * 지금 상황을 3초 안에 읽는 성장 지표 스트립:
 *  ① 월 매출 (카운트업 + 12개월 스파크라인 드로잉)
 *  ② 영업이익률 곡선 (월별 %)
 *  ③ 비용 구조 (고정 vs 변동 미니 바)
 *  ④ 고정비 커버 (공헌이익/고정비 게이지 — BEP 100%)
 *
 * 수치는 왜곡을 피해 '마지막 완료월 vs 그 전달' 기준 (진행 중인 달은 곡선 끝에만).
 * 매출 = 온라인 공급가 환산(÷1.1) + 오프라인.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { fetchSharedSales, fetchSharedOffline } from './sharedFetch'
import type { SaekdongPurchase, SaekdongExpense, SaekdongItemCost } from './actions'

interface MonthlyPoint { month: string; revenue: number; orders: number }
interface SalesLite {
  monthly: MonthlyPoint[]
  thisYear?: number
  products?: { prodName: string; revenue: number; qty: number }[]
  error?: string
}
interface OfflineLite { monthly: MonthlyPoint[]; error?: string }

function normName(s: string): string {
  return String(s || '').replace(/\[[^\]]*\]/g, '').toLowerCase().replace(/\s+/g, '')
}

// ── 카운트업 훅 (rAF, easeOut) ──
function useCountUp(target: number, durationMs = 1400): number {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(from + (target - from) * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, durationMs])
  return val
}

// ── 스파크라인 (SVG, 드로잉 애니메이션) ──
function Sparkline({
  values, width = 120, height = 34, color = '#76b900', fillOpacity = 0.14,
}: {
  values: (number | null)[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
}) {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center">
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>데이터 부족</span>
      </div>
    )
  }
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const range = max - min || 1
  const pts = values
    .map((v, i) => {
      if (v == null) return null
      const x = (i / (values.length - 1)) * (width - 4) + 2
      const y = height - 4 - ((v - min) / range) * (height - 10)
      return { x, y }
    })
    .filter(Boolean) as { x: number; y: number }[]
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${d} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z`
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={area} fill={color} opacity={fillOpacity} className="pulse-fade" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        pathLength={100}
        className="pulse-draw"
      />
      <circle cx={last.x} cy={last.y} r="2.6" fill={color} className="pulse-dot" />
    </svg>
  )
}

interface Props {
  purchases: SaekdongPurchase[]
  expenses: SaekdongExpense[]
  itemCosts?: SaekdongItemCost[]
}

export default function SaekdongPulse({ purchases, expenses, itemCosts = [] }: Props) {
  const [sales, setSales] = useState<SalesLite | null>(null)
  const [offline, setOffline] = useState<OfflineLite | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchSharedSales<SalesLite>(), fetchSharedOffline<OfflineLite>()])
      .then(([s, o]) => {
        setSales(s)
        setOffline(o)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const m = useMemo(() => {
    const months = (sales?.monthly ?? []).map((x) => x.month)
    if (months.length === 0) return null

    // 월별 매출 (공급가) = 온라인/1.1 + 오프라인
    const offMap = new Map((offline?.monthly ?? []).map((x) => [x.month, x.revenue]))
    const revenue = months.map((mo, i) =>
      Math.round((sales!.monthly[i]?.revenue ?? 0) / 1.1) + (offMap.get(mo) ?? 0),
    )

    // 월별 비용
    const monthlyActive = (e: SaekdongExpense, mo: string) =>
      (!e.start_month || e.start_month <= mo) && (!e.end_month || e.end_month >= mo)
    const fixedByMonth = months.map((mo) =>
      expenses.reduce((s, e) => {
        if (e.nature !== '판관비' || e.cost_type !== 'fixed') return s
        if (e.is_monthly) return monthlyActive(e, mo) ? s + e.amount : s
        return (e.expense_date ?? '').startsWith(mo) ? s + e.amount : s
      }, 0),
    )
    const varByMonth = months.map((mo) =>
      expenses.reduce((s, e) => {
        if (e.nature !== '판관비' || e.cost_type !== 'variable') return s
        if (e.is_monthly) return monthlyActive(e, mo) ? s + e.amount : s
        return (e.expense_date ?? '').startsWith(mo) ? s + e.amount : s
      }, 0),
    )
    // 월별 매출원가: 매입 + 기준단가 추정(올해 원가율 × 월 온라인 공급가) + 성격=매출원가 비용
    const purchasedKeys = new Set(purchases.map((p) => normName(p.item_name)))
    const stdMap = new Map(itemCosts.map((c) => [normName(c.item_name), c.unit_cost]))
    let yearStdCogs = 0
    for (const pr of sales?.products ?? []) {
      const k = normName(pr.prodName)
      if (purchasedKeys.has(k)) continue
      const uc = stdMap.get(k)
      if (uc != null) yearStdCogs += uc * pr.qty
    }
    const yearOnlineSupply = Math.round((sales?.thisYear ?? 0) / 1.1)
    const stdRate = yearOnlineSupply > 0 ? yearStdCogs / yearOnlineSupply : 0
    const cogsByMonth = months.map((mo, i) => {
      const purch = purchases
        .filter((p) => p.purchase_date.startsWith(mo))
        .reduce((s, p) => s + p.amount, 0)
      const cogsExp = expenses.reduce((s, e) => {
        if (e.nature !== '매출원가') return s
        if (e.is_monthly) return monthlyActive(e, mo) ? s + e.amount : s
        return (e.expense_date ?? '').startsWith(mo) ? s + e.amount : s
      }, 0)
      const std = Math.round((sales!.monthly[i]?.revenue ?? 0) / 1.1 * stdRate)
      return purch + cogsExp + std
    })

    // 월별 영업이익률 (%)
    const margin = months.map((mo, i) => {
      const r = revenue[i]
      if (r <= 0) return null
      return ((r - cogsByMonth[i] - varByMonth[i] - fixedByMonth[i]) / r) * 100
    })

    // 마지막 완료월 (이번 달은 진행 중 → 제외)
    const nowMonth = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7)
    let lastIdx = months.length - 1
    if (months[lastIdx] === nowMonth) lastIdx -= 1
    const prevIdx = lastIdx - 1
    if (lastIdx < 0) return null

    const lastLabel = `${Number(months[lastIdx].slice(5))}월`
    const lastRev = revenue[lastIdx]
    const prevRev = prevIdx >= 0 ? revenue[prevIdx] : 0
    const growth = prevRev > 0 ? ((lastRev - prevRev) / prevRev) * 100 : null
    const lastMargin = margin[lastIdx]
    const prevMargin = prevIdx >= 0 ? margin[prevIdx] : null
    const marginDelta = lastMargin != null && prevMargin != null ? lastMargin - prevMargin : null

    // 고정비 커버 (BEP) — 마지막 완료월 공헌이익 / 고정비
    const lastContribution = lastRev - cogsByMonth[lastIdx] - varByMonth[lastIdx]
    const lastFixed = fixedByMonth[lastIdx]
    const bep = lastFixed > 0 ? (lastContribution / lastFixed) * 100 : null

    return {
      months, revenue, margin, fixedByMonth, varByMonth,
      lastIdx, lastLabel, lastRev, growth, lastMargin, marginDelta,
      lastFixed, lastVar: varByMonth[lastIdx], bep,
    }
  }, [sales, offline, purchases, expenses, itemCosts])

  const revCount = useCountUp(m?.lastRev ?? 0)
  const marginCount = useCountUp(m?.lastMargin ?? 0)
  const bepCount = useCountUp(m?.bep ?? 0)

  if (loading || !m) {
    return (
      <div
        className="px-4 py-4 text-[12px]"
        style={{ backgroundColor: '#000', borderRadius: '2px', color: 'rgba(255,255,255,0.5)' }}
      >
        <Activity className="w-3.5 h-3.5 inline mr-1.5 align-[-2px]" />
        색동 펄스 준비 중...
      </div>
    )
  }

  const growthColor = (v: number | null) =>
    v == null ? 'rgba(255,255,255,0.4)' : v >= 0 ? '#76b900' : '#f87171'

  return (
    <div
      className="px-4 py-4 sm:px-6"
      style={{ backgroundColor: '#000', borderRadius: '2px' }}
    >
      {/* CSS 모션 정의 */}
      <style>{`
        .pulse-draw { stroke-dasharray: 100; stroke-dashoffset: 100; animation: pulseDraw 1.6s ease-out forwards; }
        @keyframes pulseDraw { to { stroke-dashoffset: 0; } }
        .pulse-fade { opacity: 0; animation: pulseFade 1s ease-out 0.9s forwards; }
        @keyframes pulseFade { to { opacity: 0.14; } }
        .pulse-dot { animation: pulseDot 2s ease-in-out 1.4s infinite; transform-origin: center; transform-box: fill-box; }
        @keyframes pulseDot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(1.6); } }
        .pulse-bar { transform: scaleY(0); transform-origin: bottom; animation: pulseBar 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes pulseBar { to { transform: scaleY(1); } }
        .pulse-gauge { width: 0; transition: width 1.4s cubic-bezier(0.22,1,0.36,1); }
        .pulse-live { animation: pulseDot 1.6s ease-in-out infinite; }
      `}</style>

      {/* 헤더 라인 */}
      <div className="flex items-center gap-1.5 mb-3">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full pulse-live"
          style={{ backgroundColor: '#76b900' }}
        />
        <span
          className="text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          Saekdong Pulse
        </span>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          · {m.lastLabel} 확정 기준 · 진행 중인 달은 곡선 끝에 표시
        </span>
      </div>

      {/* 한 줄 스트립 */}
      <div className="flex flex-wrap items-stretch gap-y-5">
        {/* ① 월 매출 */}
        <PulseCell first label={`${m.lastLabel} 매출`}>
          <div className="flex items-end gap-3">
            <div>
              <p className="text-[26px] sm:text-[30px] font-bold tabular-nums leading-none" style={{ color: '#76b900' }}>
                {formatKRW(Math.round(revCount))}
              </p>
              <p className="mt-1 text-[11px] font-bold tabular-nums" style={{ color: growthColor(m.growth) }}>
                {m.growth == null ? '전월 데이터 없음' : `${m.growth >= 0 ? '▲' : '▼'} ${Math.abs(m.growth).toFixed(1)}% 전월 대비`}
              </p>
            </div>
            <Sparkline values={m.revenue} />
          </div>
        </PulseCell>

        {/* ② 영업이익률 곡선 */}
        <PulseCell label="영업이익률">
          <div className="flex items-end gap-3">
            <div>
              <p
                className="text-[26px] sm:text-[30px] font-bold tabular-nums leading-none"
                style={{ color: (m.lastMargin ?? 0) >= 0 ? '#ffffff' : '#f87171' }}
              >
                {m.lastMargin == null ? '—' : `${marginCount.toFixed(1)}%`}
              </p>
              <p className="mt-1 text-[11px] font-bold tabular-nums" style={{ color: growthColor(m.marginDelta) }}>
                {m.marginDelta == null
                  ? `${m.lastLabel} 기준`
                  : `${m.marginDelta >= 0 ? '▲' : '▼'} ${Math.abs(m.marginDelta).toFixed(1)}p 전월 대비`}
              </p>
            </div>
            <Sparkline values={m.margin} color="#ffffff" fillOpacity={0.08} />
          </div>
        </PulseCell>

        {/* ③ 비용 구조 (최근 6개월 고정+변동 바) */}
        <PulseCell label="비용 구조 (고정+변동)">
          <div className="flex items-end gap-3">
            <div>
              <p className="text-[15px] font-bold tabular-nums leading-tight" style={{ color: 'rgba(255,255,255,0.85)' }}>
                고정 {formatKRW(m.lastFixed)}
              </p>
              <p className="text-[15px] font-bold tabular-nums leading-tight" style={{ color: '#76b900' }}>
                변동 {formatKRW(m.lastVar)}
              </p>
              <p className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {m.lastLabel} · 막대 = 최근 6개월
              </p>
            </div>
            <div className="flex items-end gap-1" style={{ height: 40 }}>
              {m.months.slice(-6).map((mo, i) => {
                const idx = m.months.length - 6 + i
                const f = m.fixedByMonth[idx] ?? 0
                const v = m.varByMonth[idx] ?? 0
                const maxCost = Math.max(1, ...m.months.map((_, j) => (m.fixedByMonth[j] ?? 0) + (m.varByMonth[j] ?? 0)))
                const total = f + v
                const h = Math.max(total > 0 ? 3 : 1, (total / maxCost) * 38)
                const fh = total > 0 ? (f / total) * h : 0
                return (
                  <div
                    key={mo}
                    className="pulse-bar flex flex-col justify-end"
                    style={{ width: 8, height: h, animationDelay: `${0.15 * i}s` }}
                    title={`${mo} 고정 ${formatKRW(f)} · 변동 ${formatKRW(v)}`}
                  >
                    <div style={{ height: h - fh, backgroundColor: '#76b900', opacity: 0.9 }} />
                    <div style={{ height: fh, backgroundColor: 'rgba(255,255,255,0.35)' }} />
                  </div>
                )
              })}
            </div>
          </div>
        </PulseCell>

        {/* ④ 고정비 커버 (BEP) */}
        <PulseCell label="고정비 커버 (BEP 100%)">
          {m.bep == null ? (
            <div>
              <p className="text-[15px] font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                고정비 미등록
              </p>
              <p className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                비용 탭에서 고정비를 등록하면 손익분기 게이지가 켜집니다.
              </p>
            </div>
          ) : (
            <div style={{ minWidth: 150 }}>
              <p
                className="text-[26px] sm:text-[30px] font-bold tabular-nums leading-none"
                style={{ color: m.bep >= 100 ? '#76b900' : m.bep >= 70 ? '#fbbf24' : '#f87171' }}
              >
                {bepCount.toFixed(0)}%
              </p>
              <div
                className="mt-2 h-2 relative overflow-hidden"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, width: 150 }}
              >
                <div
                  className="h-full pulse-gauge"
                  ref={(el) => {
                    if (el) requestAnimationFrame(() => {
                      el.style.width = `${Math.min(m.bep!, 100)}%`
                    })
                  }}
                  style={{
                    backgroundColor: m.bep >= 100 ? '#76b900' : m.bep >= 70 ? '#fbbf24' : '#f87171',
                    borderRadius: 999,
                  }}
                />
                <div className="absolute right-0 top-0 h-full w-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }} />
              </div>
              <p className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {m.lastLabel} 공헌이익이 고정비의 {m.bep.toFixed(0)}% 를 커버
              </p>
            </div>
          )}
        </PulseCell>
      </div>
    </div>
  )
}

function PulseCell({
  label, first, children,
}: {
  label: string
  first?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="px-4 sm:px-6 first:pl-0"
      style={{ borderLeft: first ? 'none' : '1px solid rgba(255,255,255,0.14)' }}
    >
      <p
        className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}
