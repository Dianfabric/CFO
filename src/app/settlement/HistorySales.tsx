'use client'

/**
 * 과거 매출 아카이브 (2016~2025) — 26년 본격 운영 전 10년 참고 지표.
 *
 * 한 줄 그래프 3가지 보기:
 * ① 년도별 — 연매출 추이 (막대)
 * ② 월별 — 120개월 전체 추이 (선)
 * ③ 동월 비교 — 1~12월 선택 → 그 달의 16~25년 비교 (막대)
 */
import { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Landmark } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { HISTORY_SALES } from './history-sales'

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

  // 년도별 합계
  const yearly = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of HISTORY_SALES) {
      const y = m.ym.slice(0, 4)
      map.set(y, (map.get(y) ?? 0) + m.sales)
    }
    return [...map.entries()].map(([y, sales]) => ({ label: `${y.slice(2)}년`, 매출: sales }))
  }, [])

  // 월별 120개월
  const monthly = useMemo(
    () =>
      HISTORY_SALES.map((m) => ({
        label: `${m.ym.slice(2, 4)}.${Number(m.ym.slice(5, 7))}`,
        매출: m.sales,
      })),
    [],
  )

  // 동월 비교 (선택한 달의 연도별)
  const compare = useMemo(() => {
    const mm = String(compareMonth).padStart(2, '0')
    return HISTORY_SALES.filter((m) => m.ym.slice(5, 7) === mm).map((m) => ({
      label: `${m.ym.slice(2, 4)}년`,
      매출: m.sales,
    }))
  }, [compareMonth])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Landmark className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h2 className="text-base font-semibold text-slate-900">과거 매출 아카이브</h2>
        <span className="text-xs text-slate-400">· 2016~2025 월매출 (참고용) · 26년부터는 위 경영지표가 실시간</span>
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
                <Bar dataKey="매출" fill="#76b900" radius={[2, 2, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          {view === 'year' && '연매출 합계 — 10년 흐름 (최고 2022년 약 26.5억 · 관리 장부 매출 열 기준)'}
          {view === 'month' && '2016.1 ~ 2025.12 · 120개월 월매출 추이'}
          {view === 'compare' && `${compareMonth}월 매출을 2016~2025년끼리 비교 — 계절성·동월 성과 확인`}
          {' · 2015년 자료를 주시면 추가합니다'}
        </p>
      </div>
    </div>
  )
}
