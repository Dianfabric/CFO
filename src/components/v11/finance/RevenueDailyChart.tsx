'use client'
/**
 * 일별 매출 트렌드 (라인+바). 빈 데이터에서는 placeholder.
 */
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface DailyRow {
  date: string
  revenue: number
  margin: number
  count: number
}

export default function RevenueDailyChart({ data }: { data: DailyRow[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-center">
        <p className="text-sm font-medium text-slate-500">기간 내 거래가 없습니다</p>
        <p className="mt-1 text-xs text-slate-400">
          일계표 업로드하시면 일별 추이가 표시됩니다
        </p>
      </div>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
  }))

  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis
          tick={{ fontSize: 10 }}
          tickFormatter={(v) =>
            v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`
          }
        />
        <Tooltip
          formatter={(value, name) => {
            const v = typeof value === 'number' ? value : Number(value) || 0
            if (name === '거래') return `${v}건`
            return new Intl.NumberFormat('ko-KR').format(v) + '원'
          }}
          labelFormatter={(label, payload) => {
            const item = payload?.[0]?.payload as { date?: string } | undefined
            return item?.date ?? label
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="매출"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#grad-revenue)"
        />
        <Area
          type="monotone"
          dataKey="margin"
          name="공헌이익"
          stroke="#10b981"
          strokeWidth={1.5}
          fill="transparent"
          strokeDasharray="4 2"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
