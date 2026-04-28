'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { useState } from 'react'
import { formatKRW } from '@/lib/formatters'

interface SalesDataPoint {
  label: string
  sales: number
  expenses: number
  profit: number
}

interface SalesChartProps {
  data: SalesDataPoint[]
  title?: string
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="text-sm font-medium text-slate-700 mb-1">{label}</p>
        {payload.map((item, index) => (
          <p key={index} className="text-xs" style={{ color: item.color }}>
            {item.name}: {formatKRW(item.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function SalesChart({ data, title = '매출 추이' }: SalesChartProps) {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area')

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex gap-1">
            <button
              onClick={() => setChartType('area')}
              className={`px-2 py-1 text-xs rounded ${chartType === 'area' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              영역
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-2 py-1 text-xs rounded ${chartType === 'bar' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              막대
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="sales" name="매출" stroke="#3b82f6" fill="#93c5fd" fillOpacity={0.3} />
                <Area type="monotone" dataKey="expenses" name="비용" stroke="#ef4444" fill="#fca5a5" fillOpacity={0.2} />
                <Area type="monotone" dataKey="profit" name="이익" stroke="#22c55e" fill="#86efac" fillOpacity={0.2} />
              </AreaChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="sales" name="매출" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="비용" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="이익" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
