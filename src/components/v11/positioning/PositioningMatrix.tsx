'use client'
/**
 * 포지셔닝 매트릭스 (4티어 × 4제품군 = 16셀)
 *
 * 각 셀에 product_lines 표시. 클릭 시 추가/편집 다이얼로그.
 */
import { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PRICE_TIER_LABEL,
  PRICE_TIER_VALUES,
  DIVISION_LABEL,
  DIVISION_VALUES,
} from '@/lib/v11-labels'
import ProductLineEditDialog, {
  type ProductLineRow,
} from './ProductLineEditDialog'

interface PriceTierInfo {
  tier: string
  display_name: string
  display_order: number
  target_margin_min: number | null
  target_margin_max: number | null
  discount_policy: string | null
}

const TIER_TONE: Record<string, string> = {
  value: 'border-slate-200 bg-slate-50',
  mid: 'border-blue-200 bg-blue-50/50',
  premium: 'border-purple-200 bg-purple-50/50',
  luxury: 'border-amber-200 bg-amber-50/50',
}
const TIER_LABEL_TONE: Record<string, string> = {
  value: 'text-slate-700 bg-slate-100',
  mid: 'text-blue-700 bg-blue-100',
  premium: 'text-purple-700 bg-purple-100',
  luxury: 'text-amber-800 bg-amber-100',
}

export default function PositioningMatrix({
  lines,
  tiers,
}: {
  lines: ProductLineRow[]
  tiers: PriceTierInfo[]
}) {
  const [editing, setEditing] = useState<ProductLineRow | null>(null)
  const [adding, setAdding] = useState<{ tier: string; division: string } | null>(null)

  // tier별로 정렬
  const tiersOrdered = [...tiers].sort(
    (a, b) => Number(a.display_order) - Number(b.display_order),
  )

  // 셀별로 라인 그룹핑 (tier|division)
  const cellMap = new Map<string, ProductLineRow[]>()
  for (const l of lines) {
    if (!l.active) continue
    const key = `${l.tier}|${l.division}`
    if (!cellMap.has(key)) cellMap.set(key, [])
    cellMap.get(key)!.push(l)
  }

  // tier 정보 lookup
  const tierInfo = new Map<string, PriceTierInfo>()
  tiers.forEach((t) => tierInfo.set(t.tier, t))

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-40 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-500">
                티어 ＼ 제품군
              </th>
              {DIVISION_VALUES.map((d) => (
                <th
                  key={d}
                  className="px-2 py-2 text-center text-xs font-semibold text-slate-700"
                >
                  {DIVISION_LABEL[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tiersOrdered.map((tier) => {
              const info = tierInfo.get(tier.tier)
              return (
                <tr key={tier.tier}>
                  <td
                    className={cn(
                      'sticky left-0 z-10 align-top px-3 py-2',
                      TIER_TONE[tier.tier] ?? 'bg-white',
                    )}
                  >
                    <div className="space-y-1">
                      <span
                        className={cn(
                          'inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          TIER_LABEL_TONE[tier.tier] ?? 'bg-slate-100 text-slate-700',
                        )}
                      >
                        {PRICE_TIER_LABEL[tier.tier] ?? tier.display_name}
                      </span>
                      <div className="text-[11px] text-slate-600">
                        목표 마진{' '}
                        <strong className="tabular-nums">
                          {info?.target_margin_min}%~{info?.target_margin_max}%
                        </strong>
                      </div>
                      {info?.discount_policy && (
                        <div className="text-[10px] text-slate-500 line-clamp-2">
                          {info.discount_policy}
                        </div>
                      )}
                    </div>
                  </td>
                  {DIVISION_VALUES.map((div) => {
                    const cellKey = `${tier.tier}|${div}`
                    const cellLines = cellMap.get(cellKey) ?? []
                    return (
                      <td key={div} className="p-1 align-top">
                        <div
                          className={cn(
                            'min-h-[100px] rounded-md border-2 border-dashed p-2 transition',
                            cellLines.length > 0
                              ? 'border-transparent bg-white shadow-sm'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                          )}
                        >
                          {cellLines.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => setAdding({ tier: tier.tier, division: div })}
                              className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
                            >
                              <Plus className="h-4 w-4" />
                              <span>라인 추가</span>
                            </button>
                          ) : (
                            <div className="space-y-1.5">
                              {cellLines.map((l) => (
                                <button
                                  key={l.id}
                                  type="button"
                                  onClick={() => setEditing(l)}
                                  className="group block w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-left text-xs hover:border-blue-300 hover:bg-blue-50/30"
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate font-semibold text-slate-800">
                                        {l.name}
                                      </div>
                                      {l.brand_name && (
                                        <div className="truncate text-[10px] text-slate-500">
                                          {l.brand_name}
                                        </div>
                                      )}
                                      {l.value_essential && (
                                        <div className="mt-1 text-[10px] text-slate-600 line-clamp-2">
                                          {l.value_essential}
                                        </div>
                                      )}
                                    </div>
                                    <Pencil className="h-3 w-3 shrink-0 text-slate-300 opacity-0 group-hover:opacity-100" />
                                  </div>
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setAdding({ tier: tier.tier, division: div })}
                                className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-slate-200 px-2 py-1 text-[10px] text-slate-400 hover:border-slate-300 hover:text-slate-600"
                              >
                                <Plus className="h-3 w-3" />
                                추가
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ProductLineEditDialog
        line={editing}
        defaultTier={adding?.tier}
        defaultDivision={adding?.division}
        open={!!editing || !!adding}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setAdding(null)
          }
        }}
      />
    </>
  )
}
