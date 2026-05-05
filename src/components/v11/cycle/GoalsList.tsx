'use client'
/**
 * 목표 리스트 (카드 그리드, 클릭 시 편집 다이얼로그)
 */
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Activity, Target, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import GoalEditDialog, { type GoalRow } from './GoalEditDialog'

const CATEGORY_LABEL: Record<string, string> = {
  revenue: '매출',
  sales_activity: '영업 활동',
  marketing: '마케팅',
  operations: '운영',
  finance: '재무',
}

const CATEGORY_COLOR: Record<string, string> = {
  revenue: 'border-emerald-200 bg-emerald-50',
  sales_activity: 'border-blue-200 bg-blue-50',
  marketing: 'border-purple-200 bg-purple-50',
  operations: 'border-slate-200 bg-slate-50',
  finance: 'border-amber-200 bg-amber-50',
}

function formatGoalValue(value: number | null | undefined, unit: string | null): string {
  if (value == null) return '—'
  const v = Number(value)
  if (unit === 'KRW') {
    if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
    if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`
    return v.toLocaleString()
  }
  if (unit === '%') return `${v.toFixed(1)}%`
  return v.toLocaleString()
}

export default function GoalsList({
  goals,
  cycleId,
}: {
  goals: GoalRow[]
  cycleId: number
}) {
  const [editing, setEditing] = useState<GoalRow | null>(null)
  const [adding, setAdding] = useState(false)

  const lagging = goals.filter((g) => !g.is_leading_indicator)
  const leading = goals.filter((g) => g.is_leading_indicator)

  return (
    <>
      <div className="space-y-4">
        {/* 추가 버튼 */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">12주 목표</h2>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            목표 추가
          </Button>
        </div>

        {goals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Target className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">
                아직 12주 목표가 없습니다
              </p>
              <p className="mt-1 text-xs text-slate-400">
                위대한 12주는 <strong>3~5개</strong>의 단순화된 목표를 권장합니다
              </p>
              <Button size="sm" className="mt-4" onClick={() => setAdding(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />첫 목표 추가
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 후행지표 (결과) */}
            {lagging.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Target className="h-3 w-3" />
                  후행지표 (결과)
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {lagging.map((g) => (
                    <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g)} />
                  ))}
                </div>
              </div>
            )}

            {/* 선행지표 (활동) */}
            {leading.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Activity className="h-3 w-3" />
                  선행지표 (활동)
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {leading.map((g) => (
                    <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <GoalEditDialog
        goal={editing}
        cycleId={cycleId}
        open={!!editing || adding}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setAdding(false)
          }
        }}
        goalsCount={goals.length}
      />
    </>
  )
}

function GoalCard({ goal, onEdit }: { goal: GoalRow; onEdit: () => void }) {
  const target = Number(goal.target_value) || 0
  const current = Number(goal.current_value) || 0
  const progress = target > 0 ? Math.min(1, current / target) : 0
  const ratio = progress * 100
  const baseline80 = target * 0.8
  const passed80 = current >= baseline80

  // 진행률 vs 시간 진행률을 비교해 위험도 표시
  // (시간 진행률은 페이지에서 props로 받을 수도 있지만 단순화)
  const colorClass = passed80
    ? 'bg-emerald-500'
    : ratio >= 60
    ? 'bg-blue-500'
    : ratio >= 30
    ? 'bg-amber-500'
    : 'bg-rose-400'

  return (
    <Card className={cn('group relative overflow-hidden')}>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  CATEGORY_COLOR[goal.category] ?? 'bg-slate-100 text-slate-600',
                )}
              >
                {CATEGORY_LABEL[goal.category] ?? goal.category}
              </span>
              {!passed80 && ratio < 50 && (
                <AlertTriangle className="h-3 w-3 text-rose-400" />
              )}
            </div>
            <h3 className="mt-1.5 truncate font-semibold text-slate-800">{goal.title}</h3>
            {goal.description && (
              <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                {goal.description}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 shrink-0 p-0 opacity-0 transition group-hover:opacity-100"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* 진행률 */}
        <div className="space-y-1">
          <div className="flex items-end justify-between text-[11px]">
            <span className="font-semibold tabular-nums text-slate-700">
              {formatGoalValue(current, goal.unit)}{' '}
              <span className="text-slate-400">/ {formatGoalValue(target, goal.unit)}</span>
            </span>
            <span
              className={cn(
                'font-semibold tabular-nums',
                passed80 ? 'text-emerald-600' : 'text-slate-500',
              )}
            >
              {ratio.toFixed(0)}%
            </span>
          </div>

          <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn('h-full transition-all', colorClass)}
              style={{ width: `${Math.min(ratio, 100)}%` }}
            />
            {/* 80% 기준선 */}
            <div
              className="absolute top-0 h-full w-0.5 bg-slate-700/40"
              style={{ left: '80%' }}
              title="80% 기준선"
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>0%</span>
            <span className="text-slate-600">80%</span>
            <span>100%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
