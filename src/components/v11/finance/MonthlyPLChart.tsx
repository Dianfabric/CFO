'use client'
/**
 * 월별 매출/이익 트렌드 차트 (PRD #3 ①)
 * 빈 데이터일 때는 placeholder 메시지 표시.
 */
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type MonthlyPLRow = {
  month: string
  revenue: number
  variable_cost: number
  contribution_margin: number
  contribution_margin_rate: number
  transaction_count: number
}

export default function MonthlyPLChart({ data }: { data: MonthlyPLRow[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-center">
        <p className="text-sm font-medium text-slate-500">아직 거래 데이터가 없습니다</p>
        <p className="mt-1 text-xs text-slate-400">
          거래를 입력하거나 v1.0 데이터를 동기화하면 월별 트렌드가 표시됩니다
        </p>
      </div>
    )
  }

  // recharts는 시간순 (오래된 → 최신)으로 그려야 자연스러움
  const chartData = [...data]
    .reverse()
    .map((d) => ({
      ...d,
      monthLabel: new Date(d.month).toLocaleDateString('ko-KR', {
        year: '2-digit',
        month: 'short',
      }),
      revenue: Number(d.revenue) || 0,
      variable_cost: Number(d.variable_cost) || 0,
      contribution_margin: Number(d.contribution_margin) || 0,
      contribution_margin_rate: Number(d.contribution_margin_rate) || 0,
    }))

  return (
    <ResponsiveContainer width="100%" height={288}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${v}`)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value, name) => {
            const v = typeof value === 'number' ? value : Number(value) || 0
            if (name === '공헌이익률') return `${v.toFixed(1)}%`
            return new Intl.NumberFormat('ko-KR').format(v) + '원'
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="revenue" name="매출" fill="#3b82f6" />
        <Bar yAxisId="left" dataKey="variable_cost" name="변동비" fill="#94a3b8" />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="contribution_margin_rate"
          name="공헌이익률"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
