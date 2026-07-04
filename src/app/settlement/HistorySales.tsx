'use client'

/**
 * 과거 매출 아카이브 (2016~) — 10년 장부 + 26년부터 시스템 실시간 자동 연결.
 *
 * 한 줄 그래프 3가지 보기:
 * ① 년도별 — 연매출 추이 (막대, 진행 중 연도는 연한 색)
 * ② 월별 — 전체 월매출 추이 (선)
 * ③ 동월 비교 — 1~12월 선택 → 그 달을 연도끼리 비교 (막대)
 *
 * 26년 값 = 본체(일계표) + 색동 온라인 + 디안몰 (공급가 환산) — 통합 총매출.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Landmark } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { HISTORY_SALES } from './history-sales'
import { fetchSharedSales, fetchSharedDianShop } from '@/app/saekdong/sharedFetch'

const LIVE_FROM = 2026 // 이 해부터 시스템 실시간 값을 이어붙임
const GREEN = '#76b900'
const GREEN_LIVE = '#b7dd6e' // 진행 중(실시간) 값 — 연한 초록

interface SeriesData {
  monthly: { month: string; revenue: number }[]
  error?: string
}

const box: React.CSSProperties = { border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }

type View = 'year' | 'month' | 'compare'

const VIEWS: { key: View; label: string }[] = [
  { key: 'year', label: '년도별' },
  { key: 'month', label: '월별 추이' },
  { key: 'compare', label: '동월 비교' },
]

function fmtAxis(v: number): string {
  if (Math.abs(v) >= 100000000) return `${(v / 100000000).toFixed(1)}억`
  if (Math.abs(v) >= 10000) return `${Math.round(v / 10000).toLocaleString()}만`
  return String(v)
}

export default function HistorySales() {
  const [view, setView] = useState<View>('year')
  const [compareMonth, setCompareMonth] = useState(1)
  const [body, setBody] = useState<SeriesData | null>(null)
  const [saekOn, setSaekOn] = useState<SeriesData | null>(null)
  const [dianShop, setDianShop] = useState<SeriesData | null>(null)

  // 26년~ 실시간 값 (본체 + 색동 온라인 + 디안몰 — 공유 캐시라 페이지당 1회)
  useEffect(() => {
    fetch('/api/settlement/monthly').then((r) => r.json()).then(setBody).catch(() => {})
    fetchSharedSales<SeriesData>().then(setSaekOn).catch(() => {})
    fetchSharedDianShop<SeriesData>().then(setDianShop).catch(() => {})
  }, [])

  // 전체 시계열 = 과거 장부 + 실시간(LIVE_FROM~, 통합 총매출·공급가 환산)
  const allMonths = useMemo(() => {
    const onMap = new Map((saekOn?.monthly ?? []).map((x) => [x.month, x.revenue]))
    const shopMap = new Map((dianShop?.monthly ?? []).map((x) => [x.month, x.revenue]))
    const live = (body?.monthly ?? [])
      .filter((m) => Number(m.month.slice(0, 4)) >= LIVE_FROM)
      .map((m) => ({
        ym: m.month,
        sales:
          m.revenue +
          Math.round((onMap.get(m.month) ?? 0) / 1.1) +
          Math.round((shopMap.get(m.month) ?? 0) / 1.1),
        live: true,
      }))
      .sort((a, b) => a.ym.localeCompare(b.ym))
    return [...HISTORY_SALES.map((m) => ({ ...m, live: false })), ...live]
  }, [body, saekOn, dianShop])

  // 년도별 합계 (실시간 연도는 진행 중 누계 — 연한 색)
  const yearly = useMemo(() => {
    const map = new Map<string, { sales: number; live: boolean }>()
    for (const m of allMonths) {
      const y = m.ym.slice(0, 4)
      const cur = map.get(y) ?? { sales: 0, live: false }
      map.set(y, { sales: cur.sales + m.sales, live: cur.live || m.live })
    }
    return [...map.entries()].map(([y, v]) => ({ label: `${y.slice(2)}년`, 매출: v.sales, live: v.live }))
  }, [allMonths])

  // 월별 전체
  const monthly = useMemo(
    () =>
      allMonths.map((m) => ({
        label: `${m.ym.slice(2, 4)}.${Number(m.ym.slice(5, 7))}`,
        매출: m.sales,
      })),
    [allMonths],
  )

  // 동월 비교 (선택한 달의 연도별)
  const compare = useMemo(() => {
    const mm = String(compareMonth).padStart(2, '0')
    return allMonths
      .filter((m) => m.ym.slice(5, 7) === mm)
      .map((m) => ({ label: `${m.ym.slice(2, 4)}년`, 매출: m.sales, live: m.live }))
  }, [allMonths, compareMonth])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Landmark className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h2 className="text-base font-semibold text-slate-900">과거 매출 아카이브</h2>
        <span className="text-xs text-slate-400">· 2016~ 월매출 · 26년부터 시스템 실시간 자동 연결 (연한 색 = 진행 중)</span>
      </div>

      <div className="bg-white p-4 sm:p-5" style={box}>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="inline-flex overflow-hidden rounded-sm border border-slate-200">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className="h-8 px-3 text-[12px] font-bold transition-colors"
                style={{
                  backgroundColor: view === v.key ? 'var(--nv-primary, #76b900)' : 'white',
                  color: view === v.key ? '#000' : '#64748b',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          {view === 'compare' && (
            <div className="flex items-center gap-1 flex-wrap">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => (
                <button
                  key={mm}
                  type="button"
                  onClick={() => setCompareMonth(mm)}
                  className="h-7 px-2 text-[11px] font-bold transition-colors"
                  style={{
                    border: '1px solid var(--nv-hairline, #e2e8f0)',
                    borderRadius: '2px',
                    backgroundColor: compareMonth === mm ? '#000' : 'white',
                    color: compareMonth === mm ? '#fff' : '#64748b',
                  }}
                >
                  {mm}월
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-64 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            {view === 'month' ? (
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#999' }} interval={11} />
                <YAxis tick={{ fontSize: 10, fill: '#999' }} tickFormatter={fmtAxis} width={48} />
                <Tooltip formatter={(v) => formatKRW(Number(v))} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                <Line type="monotone" dataKey="매출" stroke="#76b900" strokeWidth={1.6} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={view === 'year' ? yearly : compare}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#999' }} />
                <YAxis tick={{ fontSize: 10, fill: '#999' }} tickFormatter={fmtAxis} width={48} />
                <Tooltip formatter={(v) => formatKRW(Number(v))} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                <Bar dataKey="매출" radius={[2, 2, 0, 0]}>
                  {(view === 'year' ? yearly : compare).map((d) => (
                    <Cell key={d.label} fill={d.live ? GREEN_LIVE : GREEN} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          {view === 'year' && '연매출 합계 — 흐름 (최고 2022년 약 26.5억 · ~25년 관리 장부 기준)'}
          {view === 'month' && '2016.1 ~ 현재 · 월매출 추이'}
          {view === 'compare' && `${compareMonth}월 매출을 연도끼리 비교 — 계절성·동월 성과 확인`}
          {' · 26년~ = 본체+색동 온라인+디안몰 통합(공급가 환산, 진행 중 누계 — 연한 색)'}
          {' · 2015년 자료를 주시면 추가합니다'}
        </p>
      </div>
    </div>
  )
}
