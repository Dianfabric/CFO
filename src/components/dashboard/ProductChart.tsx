'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'
import { useState } from 'react'
import { formatKRW } from '@/lib/formatters'

interface ProductData {
  name: string
  revenue: number
  margin: number
  grade: string
}

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
}

const GRADE_LABELS: Record<string, string> = {
  A: '효자상품',
  B: '육성상품',
  C: '관리상품',
  D: '정리검토',
}

export default function ProductChart({ data }: { data: ProductData[] }) {
  const [view, setView] = useState<'bar' | 'pie'>('bar')

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">제품별 매출/마진</CardTitle>
          <div className="flex gap-1">
            <button
              onClick={() => setView('bar')}
              className={`px-2 py-1 text-xs rounded ${view === 'bar' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              막대
            </button>
            <button
              onClick={() => setView('pie')}
              className={`px-2 py-1 text-xs rounded ${view === 'pie' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              파이
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-1">
          {Object.entries(GRADE_LABELS).map(([grade, label]) => (
            <div key={grade} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GRADE_COLORS[grade] }} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {view === 'bar' ? (
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip
                  formatter={(value: number) => formatKRW(value)}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar dataKey="revenue" name="매출" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={index} fill={GRADE_COLORS[entry.grade] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="revenue"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {data.map((entry, index) => (
                    <Cell key={index} fill={GRADE_COLORS[entry.grade] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatKRW(value)} />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
