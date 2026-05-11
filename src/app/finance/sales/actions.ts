'use server'
/**
 * 영업 (#2a) Server Actions
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── 영업 활동 ──
export interface ActivityInput {
  id?: number
  client_id: number
  activity_type: string
  activity_date: string
  activity_time?: string | null
  duration_minutes?: number | null
  outcome?: string | null
  value_generated?: number | null
  next_action?: string | null
  next_action_date?: string | null
  stage_before?: string | null
  stage_after?: string | null
  notes?: string | null
}

export async function upsertActivity(
  input: ActivityInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const payload = {
      agent_id: userId,
      client_id: input.client_id,
      activity_type: input.activity_type,
      activity_date: input.activity_date,
      activity_time: input.activity_time ?? null,
      duration_minutes: input.duration_minutes ?? null,
      outcome: input.outcome ?? null,
      value_generated: input.value_generated ?? null,
      next_action: input.next_action ?? null,
      next_action_date: input.next_action_date ?? null,
      stage_before: input.stage_before ?? null,
      stage_after: input.stage_after ?? null,
      notes: input.notes ?? null,
    }

    if (input.id) {
      const { error } = await supabase
        .from('sales_activities')
        .update(payload)
        .eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/sales/activities')
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('sales_activities')
        .insert(payload)
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/sales/activities')
      revalidatePath('/finance/sales')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteActivity(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { error } = await supabase
      .from('sales_activities')
      .delete()
      .eq('id', id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/sales/activities')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 거래처 단계·라이프사이클·드림100 갱신 ──
export async function updateClientSalesFields(
  clientId: number,
  patch: {
    current_stage?: string
    lifecycle_stage?: string
    dream100?: boolean
    assigned_agent_id?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { error } = await supabase.from('clients').update(patch).eq('id', clientId)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/sales')
    revalidatePath('/finance/clients')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 24셀 영업 메시지 보강 (segments 테이블 확장 필드 편집) ──
export async function updateSegmentMessage(
  segmentId: number,
  patch: {
    core_message?: string | null
    sales_sequence?: string[] | null
    avg_cycle_days?: number | null
    recommended_catalog?: string | null
    typical_objections?: string[] | null
    conversion_tips?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { error } = await supabase.from('segments').update(patch).eq('id', segmentId)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/sales/segments')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
