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
  const variantStyles = {
    default: 'border-l-blue-500',
    success: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    danger: 'border-l-red-500',
  }

  return (
    <Card className={cn('border-l-4', variantStyles[variant])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-slate-500 font-medium">{title}</p>
            <p className="text-xl font-bold text-slate-900">{value}</p>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-lg bg-slate-100">
            {icon}
          </div>
        </div>
        {trend && trendValue && (
          <div className={cn(
            'flex items-center gap-1 mt-2 text-xs font-medium',
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-slate-500'
          )}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
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
        icon={<DollarSign className="w-5 h-5 text-blue-500" />}
        variant="default"
      />
      <KPICard
        title="이번 달 매출"
        value={formatKRW(data.monthSales)}
        icon={<ShoppingCart className="w-5 h-5 text-green-500" />}
        trend={growthRate >= 0 ? 'up' : 'down'}
        trendValue={`전월 대비 ${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%`}
        variant="success"
      />
      <KPICard
        title="이번 달 순이익"
        value={formatKRW(data.monthProfit)}
        subtitle={`이익률 ${data.monthMarginRate.toFixed(1)}%`}
        icon={<Percent className="w-5 h-5 text-yellow-500" />}
        variant={data.monthProfit >= 0 ? 'success' : 'danger'}
      />
      <KPICard
        title="미수금 총액"
        value={formatKRW(data.totalReceivable)}
        icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
        variant={data.totalReceivable > data.monthSales * 0.3 ? 'danger' : 'warning'}
      />
    </div>
  )
}
