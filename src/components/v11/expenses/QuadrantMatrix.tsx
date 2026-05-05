/**
 * 비용 4사분면 매트릭스 — 변동·고정 × 재량·비재량 (PRD #3 ③)
 *
 * 위에서 아래: 재량 / 비재량
 * 왼에서 오른: 변동 / 고정
 *
 *               변동                    고정
 *           ┌────────────┬────────────┐
 *      재량 │ 투자성     │ 재량 고정   │
 *           │ (광고/이벤트)│ (회식/구독)│
 *           ├────────────┼────────────┤
 *      비재량│ 연동성     │ 구조 고정   │
 *           │ (매입/운송)  │ (임대/인건)│
 *           └────────────┴────────────┘
 */
import { formatKRW } from '@/lib/formatters'
import { quadrantLabel } from '@/lib/v11-labels'

export interface QuadrantData {
  variability: string // 'variable' | 'fixed'
  discretion: string // 'discretionary' | 'non_discretionary'
  amount: number
  count: number
}

const QUADRANTS = [
  // (행1: 재량, 열1: 변동) → "투자성"
  { variability: 'variable', discretion: 'discretionary', tone: 'amber' },
  { variability: 'fixed', discretion: 'discretionary', tone: 'blue' },
  { variability: 'variable', discretion: 'non_discretionary', tone: 'slate' },
  { variability: 'fixed', discretion: 'non_discretionary', tone: 'rose' },
] as const

const TONE_CLASSES: Record<string, { bg: string; border: string; accent: string }> = {
  amber: { bg: 'bg-amber-50', border: 'border-amber-300', accent: 'text-amber-700' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-300', accent: 'text-blue-700' },
  slate: { bg: 'bg-slate-50', border: 'border-slate-300', accent: 'text-slate-700' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-300', accent: 'text-rose-700' },
}

export default function QuadrantMatrix({ data }: { data: QuadrantData[] }) {
  const lookup = new Map<string, QuadrantData>()
  for (const d of data) {
    lookup.set(`${d.variability}|${d.discretion}`, d)
  }
  const total = data.reduce((s, d) => s + d.amount, 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-xs">
        <div /> {/* 좌상단 빈 셀 */}
        <div className="text-center font-semibold text-slate-500">변동비</div>
        <div className="text-center font-semibold text-slate-500">고정비</div>

        <div className="flex items-center justify-end pr-2 font-semibold text-slate-500">
          재량
        </div>
        <Cell
          quad={QUADRANTS[0]}
          data={lookup.get('variable|discretionary')}
          total={total}
        />
        <Cell quad={QUADRANTS[1]} data={lookup.get('fixed|discretionary')} total={total} />

        <div className="flex items-center justify-end pr-2 font-semibold text-slate-500">
          비재량
        </div>
        <Cell
          quad={QUADRANTS[2]}
          data={lookup.get('variable|non_discretionary')}
          total={total}
        />
        <Cell
          quad={QUADRANTS[3]}
          data={lookup.get('fixed|non_discretionary')}
          total={total}
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
        💡 <strong>줄이기 쉬운 순서</strong>: 재량 변동(투자성) → 재량 고정 → 비재량 변동 → 비재량 고정.
        매출 위기 시 가장 먼저 보는 곳이 좌상단(투자성), 마지막이 우하단(구조 고정).
      </div>
    </div>
  )
}

function Cell({
  quad,
  data,
  total,
}: {
  quad: { variability: string; discretion: string; tone: string }
  data: QuadrantData | undefined
  total: number
}) {
  const t = TONE_CLASSES[quad.tone]
  const amount = Number(data?.amount ?? 0)
  const count = Number(data?.count ?? 0)
  const ratio = total > 0 ? (amount / total) * 100 : 0
  const labels = quadrantLabel(quad.variability, quad.discretion)

  return (
    <div className={`rounded-md border ${t.border} ${t.bg} p-3 text-xs`}>
      <div className={`text-[10px] font-bold uppercase tracking-wide ${t.accent}`}>
        {labels.short}
      </div>
      <div className="mt-1.5 text-base font-bold tabular-nums text-slate-900">
        {amount > 0 ? formatKRW(amount) : '—'}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-500">
        {count > 0 ? `${count}건 · ${ratio.toFixed(1)}%` : '데이터 없음'}
      </div>
      <div className="mt-1.5 text-[10px] text-slate-500 line-clamp-2">{labels.description}</div>
    </div>
  )
}
