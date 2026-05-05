'use server'
/**
 * 12주 사이클 / 목표 Server Actions
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface UpsertGoalInput {
  id?: number
  cycle_id: number
  category: string
  title: string
  description?: string | null
  target_value?: number | null
  unit?: string | null
  current_value?: number | null
  is_leading_indicator?: boolean
  display_order?: number
}

export async function upsertGoal(
  input: UpsertGoalInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    if (input.id) {
      const { error } = await supabase
        .from('goals')
        .update({
          category: input.category,
          title: input.title,
          description: input.description ?? null,
          target_value: input.target_value ?? null,
          unit: input.unit ?? null,
          current_value: input.current_value ?? 0,
          is_leading_indicator: input.is_leading_indicator ?? false,
          display_order: input.display_order ?? 0,
        })
        .eq('id', input.id)

      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/cycle')
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          cycle_id: input.cycle_id,
          category: input.category,
          title: input.title,
          description: input.description ?? null,
          target_value: input.target_value ?? null,
          unit: input.unit ?? null,
          current_value: input.current_value ?? 0,
          is_leading_indicator: input.is_leading_indicator ?? false,
          owner_id: user.id,
          display_order: input.display_order ?? 0,
        })
        .select('id')
        .single()

      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/cycle')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteGoal(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/cycle')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateGoalProgress(
  id: number,
  current_value: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase.from('goals').update({ current_value }).eq('id', id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/cycle')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Long-term Vision (singleton) ──
export interface LongTermVisionInput {
  five_year_vision?: string | null
  three_year_vision?: string | null
  three_year_milestones?: string | null
  core_values?: string | null
  non_negotiables?: string | null
  origin_story?: string | null
  bhag?: string | null
}

export async function updateLongTermVision(
  input: LongTermVisionInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase
      .from('long_term_vision')
      .update({ ...input, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', 1)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/cycle/vision')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 사이클 회고 ──
export interface CycleRetroInput {
  cycle_id: number
  vision_statement?: string | null
  what_worked?: string | null
  what_didnt?: string | null
  lessons_learned?: string | null
  next_cycle_focus?: string | null
  reflection_notes?: string | null
  retro_completed?: boolean
}

export async function updateCycleRetro(
  input: CycleRetroInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const patch: Record<string, unknown> = {}
    if (input.vision_statement !== undefined) patch.vision_statement = input.vision_statement
    if (input.what_worked !== undefined) patch.what_worked = input.what_worked
    if (input.what_didnt !== undefined) patch.what_didnt = input.what_didnt
    if (input.lessons_learned !== undefined) patch.lessons_learned = input.lessons_learned
    if (input.next_cycle_focus !== undefined) patch.next_cycle_focus = input.next_cycle_focus
    if (input.reflection_notes !== undefined) patch.reflection_notes = input.reflection_notes
    if (input.retro_completed !== undefined) patch.retro_completed = input.retro_completed

    const { error } = await supabase.from('cycles').update(patch).eq('id', input.cycle_id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/cycle')
    revalidatePath('/finance/cycle/retro')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 목표 정합성 점검 ──
export async function updateGoalAlignment(
  goal_id: number,
  patch: {
    aligned_with_vision?: boolean
    importance_score?: number | null
    measurability_note?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase.from('goals').update(patch).eq('id', goal_id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/cycle/vision')
    revalidatePath('/finance/cycle')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateCycleVision(
  cycle_id: number,
  vision_statement: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase
      .from('cycles')
      .update({ vision_statement })
      .eq('id', cycle_id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/cycle')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
