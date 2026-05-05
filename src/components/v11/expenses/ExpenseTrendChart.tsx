'use client'
/**
 * 월별 비용 트렌드 — variable / fixed stacked bar
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface MonthlyExpense {
  month: string
  variable: number
  fixed: number
  discretionary: number
  non_discretionary: number
}

export default function ExpenseTrendChart({ data }: { data: MonthlyExpense[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-center">
        <p className="text-sm font-medium text-slate-500">월별 비용 데이터가 없습니다</p>
        <p className="mt-1 text-xs text-slate-400">
          일계표 업로드 시 expenses에 자동 기록됩니다
        </p>
      </div>
    )
  }

  const chartData = [...data].reverse().map((d) => ({
    ...d,
    monthLabel: new Date(d.month).toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: 'short',
    }),
  }))

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) =>
            v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`
          }
        />
        <Tooltip
          formatter={(value) => {
            const v = typeof value === 'number' ? value : Number(value) || 0
            return new Intl.NumberFormat('ko-KR').format(v) + '원'
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="variable" stackId="a" fill="#f59e0b" name="변동비" />
        <Bar dataKey="fixed" stackId="a" fill="#64748b" name="고정비" />
      </BarChart>
    </ResponsiveContainer>
  )
}
