'use client'

/**
 * 12주 KPI 모아보기 보드
 *
 * 모든 직원의 KR (KPI) 진행률을 한 화면에:
 *   - 좌측: 선행 KR (활동) 가로 막대 그래프
 *   - 우측: 후행 KR (결과) 가로 막대 그래프
 *   - 80% 기준선 점선
 *   - 직원 색상으로 막대 구분
 *
 * 클릭 → /finance/cycle/employees#emp-{id}
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart3, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { progressColor, formatKrValue, type KrUnit } from '@/lib/cycle-okr'
import { getKrMetric } from '@/lib/kr-metrics'

interface KpiKr {
  kr_id: string
  kr_title: string
  lead_metric: string | null
  lead_unit: string
  lead_start: number
  lead_target: number
  lead_current: number
  lead_progress: number
  lag_metric: string | null
  lag_unit: string | null
  lag_start: number | null
  lag_target: number | null
  lag_current: number | null
  lag_progress: number | null
  is_big_goal: boolean
  goal_title: string
  goal_business_track: string
  employee_id: string
  employee_name: string
  employee_color: string
  employee_track: string
}

const KPI_CACHE_KEY = 'dian:kpis'

export default function CycleKpiBoard() {
  // SSR/CSR 일치 — 항상 []/true 로 시작. mount 후 useEffect 에서 캐시 읽음.
  const [kpis, setKpis] = useState<KpiKr[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1) 캐시 hydrate — hydration 끝난 뒤라 SSR mismatch 없음
    try {
      const raw = sessionStorage.getItem(KPI_CACHE_KEY)
      if (raw) {
        setKpis(JSON.parse(raw) as KpiKr[])
        setLoading(false)
      }
    } catch {
      /* ignore */
    }

    // 2) 백그라운드 갱신
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/cycle/kpis')
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) {
          const next = (j.kpis ?? []) as KpiKr[]
          setKpis(next)
          try {
            sessionStorage.setItem(KPI_CACHE_KEY, JSON.stringify(next))
          } catch {
            /* ignore */
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 선행 KR 차트 데이터 (모든 KR — 선행 측정값 기준)
  const leadData = useMemo(() => {
    return kpis
      .filter((k) => k.lead_metric)
      .map((k) => {
        const emoji = getKrMetric(k.lead_metric ?? '')?.emoji ?? ''
        return {
          name: `${emoji} ${k.kr_title}`.slice(0, 40),
          progress: Math.round(k.lead_progress * 100),
          current: k.lead_current,
          target: k.lead_target,
          unit: k.lead_unit as KrUnit,
          color: k.employee_color,
          employee: k.employee_name,
          big: k.is_big_goal,
          krId: k.kr_id,
          empId: k.employee_id,
        }
      })
      .sort((a, b) => b.progress - a.progress)
  }, [kpis])

  // 후행 KR 차트 데이터 (lag_metric 있는 것만)
  const lagData = useMemo(() => {
    return kpis
      .filter((k) => k.lag_metric && k.lag_progress != null)
      .map((k) => {
        const emoji = getKrMetric(k.lag_metric ?? '')?.emoji ?? ''
        return {
          name: `${emoji} ${k.kr_title}`.slice(0, 40),
          progress: Math.round((k.lag_progress ?? 0) * 100),
          current: Number(k.lag_current ?? 0),
          target: Number(k.lag_target ?? 0),
          unit: (k.lag_unit ?? 'count') as KrUnit,
          color: k.employee_color,
          employee: k.employee_name,
          big: k.is_big_goal,
          krId: k.kr_id,
          empId: k.employee_id,
        }
      })
      .sort((a, b) => b.progress - a.progress)
  }, [kpis])

  // 통계
  const stats = useMemo(() => {
    const all = [
      ...leadData.map((d) => d.progress),
      ...lagData.map((d) => d.progress),
    ]
    if (all.length === 0) return { avg: 0, count: 0, above80: 0 }
    const avg = all.reduce((s, x) => s + x, 0) / all.length
    const above80 = all.filter((x) => x >= 80).length
    return { avg: Math.round(avg), count: all.length, above80 }
  }, [leadData, lagData])

  if (loading) {
    return (
      <div
        className="border border-[#e5e5e5] bg-white p-6 text-center text-[12px] text-[#666]"
        style={{ borderRadius: '2px' }}
      >
        KPI 차트 로드 중...
      </div>
    )
  }

  if (kpis.length === 0) {
    return (
      <div
        className="border border-dashed border-[#cccccc] bg-white p-6 text-center text-[12px] text-[#666]"
        style={{ borderRadius: '2px' }}
      >
        아직 등록된 KR 이 없습니다.{' '}
        <Link href="/finance/cycle/employees" className="underline font-bold">
          직원별 OKR
        </Link>
        에서 KR 을 추가해주세요.
      </div>
    )
  }

  return (
    <div
      className="border border-[#e5e5e5] bg-white p-4"
      style={{ borderRadius: '2px' }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#666]" />
          <h3 className="text-[14px] font-bold tracking-tight text-[#000]">
            KPI 한눈에 보기
          </h3>
          <span className="text-[11px] text-[#666]">
            · 전체 {stats.count} 개 · 평균{' '}
            <strong style={{ color: progressColor(stats.avg / 100) }}>
              {stats.avg}%
            </strong>{' '}
            · 80%+ <strong className="text-[#76b900]">{stats.above80}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 선행 KR */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#0ea5e9]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#666]">
              선행 (활동) — {leadData.length} 개
            </span>
          </div>
          {leadData.length === 0 ? (
            <p className="text-[10px] text-[#999] italic py-4 text-center">
              선행 KR 없음
            </p>
          ) : (
            <KpiBarChart data={leadData} dotColor="#0ea5e9" />
          )}
        </div>

        {/* 후행 KR */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="w-3.5 h-3.5 text-[#a855f7]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#666]">
              후행 (결과) — {lagData.length} 개
            </span>
          </div>
          {lagData.length === 0 ? (
            <p className="text-[10px] text-[#999] italic py-4 text-center">
              후행 KR 없음 — 활동 KR 에 후행 페어 추가 권장
            </p>
          ) : (
            <KpiBarChart data={lagData} dotColor="#a855f7" />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 가로 막대 차트
// ============================================================
interface ChartItem {
  name: string
  progress: number
  current: number
  target: number
  unit: KrUnit
  color: string
  employee: string
  big: boolean
  krId: string
  empId: string
}

function KpiBarChart({ data, dotColor }: { data: ChartItem[]; dotColor: string }) {
  // 차트 높이 동적 — 각 막대 28px
  const chartHeight = Math.max(120, data.length * 28 + 30)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 36, bottom: 8, left: 8 }}
        barCategoryGap={4}
      >
        <XAxis
          type="number"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tick={{ fontSize: 9, fill: '#999' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10, fill: '#000' }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null
            const d = payload[0].payload as ChartItem
            return (
              <div
                className="bg-white border border-[#000] p-2 text-[11px]"
                style={{ borderRadius: '2px' }}
              >
                <p className="font-bold mb-1">
                  {d.big && '👑 '}
                  {d.name}
                </p>
                <p className="text-[#666]">
                  <span
                    className="inline-block w-2 h-2 mr-1"
                    style={{ backgroundColor: d.color, borderRadius: '2px' }}
                  />
                  {d.employee}
                </p>
                <p className="font-bold tabular-nums" style={{ color: dotColor }}>
                  {formatKrValue(d.current, d.unit)} /{' '}
                  {formatKrValue(d.target, d.unit)} ({d.progress}%)
                </p>
              </div>
            )
          }}
          cursor={{ fill: '#f3f4f6' }}
        />
        {/* 80% 기준선 */}
        <ReferenceLine
          x={80}
          stroke="#76b900"
          strokeDasharray="4 4"
          strokeWidth={1}
          label={{
            value: '80%',
            position: 'top',
            fontSize: 9,
            fill: '#76b900',
          }}
        />
        <Bar dataKey="progress" radius={[0, 2, 2, 0]}>
          {data.map((entry, idx) => (
            <Cell
              key={idx}
              fill={progressColor(entry.progress / 100)}
              stroke={entry.big ? '#f59e0b' : 'none'}
              strokeWidth={entry.big ? 2 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
