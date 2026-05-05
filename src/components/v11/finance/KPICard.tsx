import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone?: 'default' | 'positive' | 'negative' | 'neutral'
}

export default function KPICard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: KPICardProps) {
  const toneClasses = {
    default: 'text-slate-900',
    positive: 'text-emerald-600',
    negative: 'text-rose-600',
    neutral: 'text-slate-500',
  }
  const iconBg = {
    default: 'bg-slate-100 text-slate-600',
    positive: 'bg-emerald-100 text-emerald-600',
    negative: 'bg-rose-100 text-rose-600',
    neutral: 'bg-slate-100 text-slate-400',
  }

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className={cn('mt-1.5 truncate text-2xl font-bold tabular-nums', toneClasses[tone])}>
            {value}
          </p>
          {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconBg[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}
