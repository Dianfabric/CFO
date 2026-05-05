/**
 * 4티어 매출 비중 (PRD #4 ①)
 * 빈 데이터에서도 4개 티어 행이 모두 보이도록.
 */
import { formatKRW } from '@/lib/formatters'

type TierRow = {
  tier: string
  display_name: string
  target_margin_min: number | null
  target_margin_max: number | null
  revenue: number
  margin: number
  transaction_count: number
  actual_margin_rate: number
}

const TIER_COLORS: Record<string, string> = {
  value: 'bg-slate-500',
  mid: 'bg-blue-500',
  premium: 'bg-purple-500',
  luxury: 'bg-amber-500',
}

export default function TierBreakdown({ data }: { data: TierRow[] }) {
  const totalRevenue = data.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0)

  return (
    <div className="space-y-3">
      {data.map((tier) => {
        const revenue = Number(tier.revenue) || 0
        const ratio = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
        const actualMargin = Number(tier.actual_margin_rate) || 0
        const targetMin = Number(tier.target_margin_min) || 0
        const targetMax = Number(tier.target_margin_max) || 0
        const inTarget = actualMargin >= targetMin && actualMargin <= targetMax
        const color = TIER_COLORS[tier.tier] ?? 'bg-slate-400'

        return (
          <div key={tier.tier}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                <span className="font-semibold text-slate-700">{tier.display_name}</span>
                <span className="text-[10px] text-slate-400">
                  목표 {targetMin}~{targetMax}%
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] tabular-nums">
                <span className="font-medium text-slate-600">{formatKRW(revenue)}</span>
                <span className="w-12 text-right text-slate-400">
                  {ratio.toFixed(1)}%
                </span>
                {revenue > 0 && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      inTarget
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    실제 마진 {actualMargin.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full ${color} transition-all`}
                style={{ width: `${Math.min(ratio, 100)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
