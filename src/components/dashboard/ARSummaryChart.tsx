'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { formatKRW } from '@/lib/formatters'

interface ARAgingData {
  period: string
  amount: number
  count: number
}

const AGING_COLORS = ['#22c55e', '#f59e0b', '#f97316', '#ef4444']

export default function ARSummaryChart({ data, totalAR }: { data: ARAgingData[]; totalAR: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">미수금 경과 분석</CardTitle>
          <Badge variant={totalAR > 0 ? 'destructive' : 'secondary'}>
            총 {formatKRW(totalAR)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
              <Tooltip
                formatter={(v: unknown) => formatKRW(v as number)}
                labelFormatter={(label) => `경과: ${label}`}
              />
              <Bar dataKey="amount" name="미수금" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={AGING_COLORS[index] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2">
          {['30일 이내', '30~60일', '60~90일', '90일 초과'].map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AGING_COLORS[i] }} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
