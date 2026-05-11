'use server'
/**
 * CEO 코크핏 (#7) Server Actions
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ── 1:1 미팅 노트 ──
export interface OneOnOneInput {
  id?: number
  counterpart_id?: string | null
  counterpart_name?: string | null
  meeting_date?: string
  duration_minutes?: number | null
  agenda?: string | null
  rapport?: string | null
  performance?: string | null
  feedback_given?: string | null
  feedback_received?: string | null
  decisions?: string | null
  next_steps?: string | null
  notes?: string | null
}

export async function createOneOnOne(): Promise<never> {
  let newId: number | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { data, error } = await supabase
      .from('one_on_one_notes')
      .insert({
        owner_id: userId,
        meeting_date: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single()
    if (error) throw error
    newId = data.id
  } catch (e) {
    throw e
  }
  redirect(`/finance/cockpit/one-on-one/${newId}`)
}

export async function updateOneOnOne(
  input: OneOnOneInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!input.id) return { ok: false, error: 'id 누락' }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const patch: Record<string, unknown> = {
      counterpart_id: input.counterpart_id ?? null,
      counterpart_name: input.counterpart_name?.trim() || null,
      meeting_date: input.meeting_date,
      duration_minutes: input.duration_minutes ?? null,
      agenda: input.agenda ?? null,
      rapport: input.rapport ?? null,
      performance: input.performance ?? null,
      feedback_given: input.feedback_given ?? null,
      feedback_received: input.feedback_received ?? null,
      decisions: input.decisions ?? null,
      next_steps: input.next_steps ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('one_on_one_notes')
      .update(patch)
      .eq('id', input.id)
      .eq('owner_id', userId)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/cockpit/one-on-one')
    revalidatePath(`/finance/cockpit/one-on-one/${input.id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteOneOnOne(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { error } = await supabase
      .from('one_on_one_notes')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/cockpit/one-on-one')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 자기경영 5가지 점검 ──
export interface SelfCheckinInput {
  id?: number
  checkin_date: string
  period_type?: string
  time_management_score?: number | null
  time_management_note?: string | null
  contribution_score?: number | null
  contribution_note?: string | null
  strengths_score?: number | null
  strengths_note?: string | null
  priorities_score?: number | null
  priorities_note?: string | null
  decisions_score?: number | null
  decisions_note?: string | null
  overall_reflection?: string | null
}

export async function upsertSelfCheckin(
  input: SelfCheckinInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const payload = {
      user_id: userId,
      checkin_date: input.checkin_date,
      period_type: input.period_type ?? 'weekly',
      time_management_score: input.time_management_score ?? null,
      time_management_note: input.time_management_note ?? null,
      contribution_score: input.contribution_score ?? null,
      contribution_note: input.contribution_note ?? null,
      strengths_score: input.strengths_score ?? null,
      strengths_note: input.strengths_note ?? null,
      priorities_score: input.priorities_score ?? null,
      priorities_note: input.priorities_note ?? null,
      decisions_score: input.decisions_score ?? null,
      decisions_note: input.decisions_note ?? null,
      overall_reflection: input.overall_reflection ?? null,
    }

    const { error } = await supabase
      .from('self_mgmt_checkins')
      .upsert(payload, { onConflict: 'user_id,checkin_date,period_type' })
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/cockpit/self')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 강점 자기인식 ──
export interface StrengthsInput {
  self_strengths?: string[]
  strengths_description?: string | null
  strengths_evidence?: string | null
  strengths_blindspots?: string | null
  golden_hours_start?: string | null
  golden_hours_end?: string | null
}

export async function updateStrengths(
  input: StrengthsInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (input.self_strengths !== undefined) patch.self_strengths = input.self_strengths
    if (input.strengths_description !== undefined)
      patch.strengths_description = input.strengths_description
    if (input.strengths_evidence !== undefined)
      patch.strengths_evidence = input.strengths_evidence
    if (input.strengths_blindspots !== undefined)
      patch.strengths_blindspots = input.strengths_blindspots
    if (input.golden_hours_start !== undefined)
      patch.golden_hours_start = input.golden_hours_start
    if (input.golden_hours_end !== undefined)
      patch.golden_hours_end = input.golden_hours_end

    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/cockpit/strengths')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 텔레그램 설정 ──
export interface TelegramInput {
  telegram_chat_id?: string | null
  telegram_enabled?: boolean
  morning_briefing_time?: string | null
  evening_note_time?: string | null
}

export async function updateTelegramSettings(
  input: TelegramInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const patch: Record<string, unknown> = {}
    if (input.telegram_chat_id !== undefined) patch.telegram_chat_id = input.telegram_chat_id
    if (input.telegram_enabled !== undefined) patch.telegram_enabled = input.telegram_enabled
    if (input.morning_briefing_time !== undefined)
      patch.morning_briefing_time = input.morning_briefing_time
    if (input.evening_note_time !== undefined)
      patch.evening_note_time = input.evening_note_time

    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/cockpit/telegram')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
