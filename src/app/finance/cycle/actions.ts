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
