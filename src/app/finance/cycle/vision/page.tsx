/**
 * 비전·목표 통합 워크북 (Phase 8 #1 ② + ⑥)
 */
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, ChevronLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import VisionWorkbook, {
  type VisionRow,
  type GoalCheck,
} from '@/components/v11/cycle/VisionWorkbook'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const [visionRes, cycleRes] = await Promise.all([
      supabase.from('long_term_vision').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('cycles')
        .select('id')
        .eq('status', 'active')
        .order('cycle_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    let goals: GoalCheck[] = []
    if (cycleRes.data) {
      const { data: goalsData } = await supabase
        .from('goals')
        .select(
          'id, title, category, is_leading_indicator, target_value, current_value, unit, aligned_with_vision, importance_score, measurability_note',
        )
        .eq('cycle_id', cycleRes.data.id)
        .order('display_order')
      goals = (goalsData ?? []) as GoalCheck[]
    }

    return {
      vision: (visionRes.data ?? {
        five_year_vision: null,
        three_year_vision: null,
        three_year_milestones: null,
        core_values: null,
        non_negotiables: null,
        origin_story: null,
        bhag: null,
      }) as VisionRow,
      goals,
      error: visionRes.error?.message ?? null,
    }
  } catch (e) {
    return {
      vision: {
        five_year_vision: null,
        three_year_vision: null,
        three_year_milestones: null,
        core_values: null,
        non_negotiables: null,
        origin_story: null,
        bhag: null,
      } as VisionRow,
      goals: [] as GoalCheck[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function VisionPage() {
  const { vision, goals, error } = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/cycle"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        12주 대시보드
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #1 ② + ⑥ 비전·목표 워크북
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">비전·목표 통합 워크북</h1>
        <p className="mt-1 text-sm text-slate-500">
          5년 비전 → 3년 마일스톤 → 12주 목표 — 정합성 자체 점검
        </p>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p>{error}</p>
                <p className="mt-1 text-xs">v11.7_planning.sql 적용 필요</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <VisionWorkbook vision={vision} goals={goals} />
    </div>
  )
}
