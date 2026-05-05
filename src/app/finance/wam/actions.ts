'use server'
/**
 * WAM (Weekly Action Meeting) Server Actions (PRD #1 ④)
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calculateCycleProgress } from '@/lib/v11-cycle'

/** WAM 생성 — 현재 활성 사이클 + 오늘 날짜 + 자동 week_number 계산 */
export async function createWAM(): Promise<never> {
  let newId: number | null = null
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인이 필요합니다.')

    // 활성 사이클 조회
    const { data: cycle, error: cycleErr } = await supabase
      .from('cycles')
      .select('id, start_date, end_date')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (cycleErr || !cycle) throw new Error('활성 사이클이 없습니다.')

    const progress = calculateCycleProgress(cycle.start_date, cycle.end_date)

    const { data, error } = await supabase
      .from('weekly_action_meetings')
      .insert({
        cycle_id: cycle.id,
        meeting_date: new Date().toISOString().split('T')[0],
        week_number: Math.min(12, Math.max(1, progress.weekNumber)),
        attendees: [],
        next_week_priorities: [],
        scorecard: {},
        created_by: user.id,
      })
      .select('id')
      .single()
    if (error) throw error
    newId = data.id
  } catch (e) {
    throw e
  }
  redirect(`/finance/wam/${newId}`)
}

export interface WAMUpdateInput {
  id: number
  meeting_date?: string
  week_number?: number
  attendees?: string[]
  scorecard?: Record<string, { current: number; status: string; note?: string }>
  next_week_priorities?: string[]
  blockers?: string | null
  notes?: string | null
  /** 점수표에서 갱신된 current_value를 goals 테이블에도 반영할지 */
  apply_to_goals?: boolean
}

export async function updateWAM(
  input: WAMUpdateInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const patch: Record<string, unknown> = {}
    if (input.meeting_date !== undefined) patch.meeting_date = input.meeting_date
    if (input.week_number !== undefined) patch.week_number = input.week_number
    if (input.attendees !== undefined) patch.attendees = input.attendees
    if (input.scorecard !== undefined) patch.scorecard = input.scorecard
    if (input.next_week_priorities !== undefined)
      patch.next_week_priorities = input.next_week_priorities
    if (input.blockers !== undefined) patch.blockers = input.blockers
    if (input.notes !== undefined) patch.notes = input.notes

    const { error } = await supabase
      .from('weekly_action_meetings')
      .update(patch)
      .eq('id', input.id)
    if (error) return { ok: false, error: error.message }

    // 점수표 → goals.current_value 동기화 (옵션)
    if (input.apply_to_goals && input.scorecard) {
      for (const [goalIdStr, score] of Object.entries(input.scorecard)) {
        const goalId = parseInt(goalIdStr, 10)
        if (!Number.isFinite(goalId)) continue
        const cur = Number(score.current)
        if (!Number.isFinite(cur)) continue
        await supabase.from('goals').update({ current_value: cur }).eq('id', goalId)
      }
      revalidatePath('/finance/cycle')
    }

    revalidatePath('/finance/wam')
    revalidatePath(`/finance/wam/${input.id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteWAM(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase.from('weekly_action_meetings').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/wam')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
