'use server'
/**
 * 4단계 가격 의사결정 Server Actions (PRD #4 ③)
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface DecisionInput {
  id?: number
  type: string // 'new_product' | 'price_increase' | 'price_decrease' | 'discount' | 'differentiation'
  decision_date?: string
  target_product_id?: number | null
  target_line_id?: number | null
  target_client_id?: number | null
  previous_price?: number | null
  decided_price?: number | null
  decision_rationale?: string | null
  step1_strategy?: Record<string, unknown> | null
  step2_analysis?: Record<string, unknown> | null
  step3_decision?: Record<string, unknown> | null
  step4_execution?: Record<string, unknown> | null
}

/** 의사결정 생성 — 페이지 redirect까지 */
export async function createDecision(): Promise<never> {
  let newId: number | null = null
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인이 필요합니다.')

    const { data, error } = await supabase
      .from('price_decisions')
      .insert({
        type: 'price_increase',
        decision_date: new Date().toISOString().split('T')[0],
        created_by: user.id,
      })
      .select('id')
      .single()
    if (error) throw error
    newId = data.id
  } catch (e) {
    throw e
  }
  redirect(`/finance/pricing/${newId}`)
}

export async function upsertDecision(
  input: DecisionInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const payload: Record<string, unknown> = {
      type: input.type,
      decision_date: input.decision_date,
      target_product_id: input.target_product_id ?? null,
      target_line_id: input.target_line_id ?? null,
      target_client_id: input.target_client_id ?? null,
      previous_price: input.previous_price ?? null,
      decided_price: input.decided_price ?? null,
      decision_rationale: input.decision_rationale ?? null,
      step1_strategy: input.step1_strategy ?? null,
      step2_analysis: input.step2_analysis ?? null,
      step3_decision: input.step3_decision ?? null,
      step4_execution: input.step4_execution ?? null,
    }

    if (input.id) {
      const { error } = await supabase
        .from('price_decisions')
        .update(payload)
        .eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/pricing')
      revalidatePath(`/finance/pricing/${input.id}`)
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('price_decisions')
        .insert({ ...payload, created_by: user.id })
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/pricing')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function approveDecision(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    // CEO/임원 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!['ceo', 'executive'].includes(profile?.role ?? '')) {
      return { ok: false, error: 'CEO 또는 임원만 승인할 수 있습니다.' }
    }

    // 90일 후 검증 예정일 자동 계산
    const validation = new Date()
    validation.setDate(validation.getDate() + 90)

    const { error } = await supabase
      .from('price_decisions')
      .update({
        ceo_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        validation_due_date: validation.toISOString().split('T')[0],
      })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/pricing')
    revalidatePath(`/finance/pricing/${id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function validateDecision(
  id: number,
  validation_notes: string,
  quality_score: number,
): Promise<{ ok: boolean; error?: string }> {
  if (quality_score < 1 || quality_score > 5) {
    return { ok: false, error: '품질 점수는 1~5 사이여야 합니다.' }
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase
      .from('price_decisions')
      .update({
        validation_completed: true,
        validation_notes,
        quality_score,
      })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/pricing')
    revalidatePath(`/finance/pricing/${id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteDecision(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase.from('price_decisions').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/pricing')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
