'use client'

import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, AlertTriangle, Percent } from 'lucide-react'
import { formatKRW, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface KPIData {
  todaySales: number
  monthSales: number
  monthExpenses: number
  monthProfit: number
  monthMarginRate: number
  totalReceivable: number
  salesCount: number
  previousMonthSales: number
}

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

function KPICard({ title, value, subtitle, icon, trend, trendValue, variant = 'default' }: KPICardProps) {
  // V2.1 — NVIDIA card pattern with green corner-square
  return (
    <Card className="relative">
      {/* corner-square — NVIDIA signature motif */}
      <span
        aria-hidden
        className="absolute top-0 left-0"
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: 'var(--nv-primary)',
        }}
      />
      <CardContent className="p-5 pt-7">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#757575]">{title}</p>
            <p className="text-[24px] font-bold tracking-tight text-[#000000] tabular-nums">{value}</p>
            {subtitle && <p className="text-[12px] text-[#757575]">{subtitle}</p>}
          </div>
          <div className="p-2 bg-[#f7f7f7] border border-[#cccccc]" style={{ borderRadius: '2px' }}>
            {icon}
          </div>
        </div>
        {trend && trendValue && (
          <div className={cn(
            'flex items-center gap-1 mt-3 text-[12px] font-bold',
            trend === 'up' ? 'text-[#3f8500]' : trend === 'down' ? 'text-[#e52020]' : 'text-[#757575]'
          )}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" strokeWidth={2.4} /> : <TrendingDown className="w-3 h-3" strokeWidth={2.4} />}
            <span>{trendValue}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function KPICards({ data }: { data: KPIData }) {
  const growthRate = data.previousMonthSales > 0
    ? ((data.monthSales - data.previousMonthSales) / data.previousMonthSales * 100)
    : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="오늘 매출"
        value={formatKRW(data.todaySales)}
        subtitle={`${formatNumber(data.salesCount)}건`}
        icon={<DollarSign className="w-4 h-4 text-[#1a1a1a]" strokeWidth={1.8} />}
      />
      <KPICard
        title="이번 달 매출"
        value={formatKRW(data.monthSales)}
        icon={<ShoppingCart className="w-4 h-4 text-[#1a1a1a]" strokeWidth={1.8} />}
        trend={growthRate >= 0 ? 'up' : 'down'}
        trendValue={`전월 대비 ${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%`}
      />
      <KPICard
        title="이번 달 순이익"
        value={formatKRW(data.monthProfit)}
        subtitle={`이익률 ${data.monthMarginRate.toFixed(1)}%`}
        icon={<Percent className="w-4 h-4 text-[#1a1a1a]" strokeWidth={1.8} />}
      />
      <KPICard
        title="미수금 총액"
        value={formatKRW(data.totalReceivable)}
        icon={<AlertTriangle className="w-4 h-4 text-[#1a1a1a]" strokeWidth={1.8} />}
      />
    </div>
  )
}
