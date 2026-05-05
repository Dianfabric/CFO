/**
 * WAM 상세 (점수표 + 우선순위 + 블로커 편집)
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Sparkles, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WAMForm, { type WAMRow, type GoalLite } from '@/components/v11/wam/WAMForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WAMDetailPage({ params }: PageProps) {
  const { id } = await params
  const wamId = parseInt(id, 10)
  if (!Number.isFinite(wamId)) notFound()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('weekly_action_meetings')
    .select('*')
    .eq('id', wamId)
    .maybeSingle()

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/finance/wam"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-3 w-3" />
          목록으로
        </Link>
        <p className="text-sm text-rose-600">
          회의록을 불러올 수 없습니다. {error?.message}
        </p>
      </div>
    )
  }

  const wam = data as WAMRow

  // 해당 사이클의 목표들
  let goals: GoalLite[] = []
  if (wam.cycle_id) {
    const { data: goalsData } = await supabase
      .from('goals')
      .select(
        'id, category, title, target_value, current_value, unit, is_leading_indicator',
      )
      .eq('cycle_id', wam.cycle_id)
      .order('display_order', { ascending: true })
    goals = (goalsData ?? []) as GoalLite[]
  }

  return (
    <div className="space-y-4">
      <Link
        href="/finance/wam"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        목록으로
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · Phase 1 ⑫ · WAM #{wam.id}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">주간 회의 — Week {wam.week_number}</h1>
        <p className="mt-1 text-sm text-slate-500">{wam.meeting_date}</p>
      </div>

      <WAMForm wam={wam} goals={goals} />
    </div>
  )
}
