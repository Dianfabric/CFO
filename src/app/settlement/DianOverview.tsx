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

type Period = 'week' | 'month' | 'quarter' | 'year'

interface MonthlyPoint { month: string; revenue: number }
interface SeriesData {
  monthly: MonthlyPoint[]
  today: number
  thisWeek: number
  thisMonth: number
  thisYear?: number
  error?: string
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
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [d, s, o] = await Promise.all([
        fetch('/api/settlement/monthly').then((r) => r.json()),
        fetchSharedSales<SeriesData>().catch(() => null),
        fetchSharedOffline<SeriesData>().catch(() => null),
      ])
      setDian(d)
      setSaekOn(s)
      setSaekOff(o)
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

    return { dianBody, saekOnline, saekOffline, total, saekTotal, dianFabric, series, lastRev, growth, lastLabel, saekShare }
  }, [dian, saekOn, saekOff, period])

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
            <Cell label="이익 흐름" dim>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>다음 단계</span>
              <p className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                매입·고정비·변동비 통합 후 표시
              </p>
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
