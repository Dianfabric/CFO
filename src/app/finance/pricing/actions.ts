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
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { data, error } = await supabase
      .from('price_decisions')
      .insert({
        type: 'price_increase',
        decision_date: new Date().toISOString().split('T')[0],
        created_by: userId,
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
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

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
        .insert({ ...payload, created_by: userId })
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
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    // CEO/임원 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
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
        approved_by: userId,
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
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

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

// ── Client Pricing Policies (#4 ⑤) ──
export interface PolicyInput {
  id?: number
  client_id: number
  line_id: number
  discount_rate?: number
  notes?: string | null
  effective_from?: string
}

export async function upsertPricingPolicy(
  input: PolicyInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const payload = {
      client_id: input.client_id,
      line_id: input.line_id,
      discount_rate: input.discount_rate ?? 0,
      notes: input.notes ?? null,
      effective_from: input.effective_from ?? new Date().toISOString().split('T')[0],
    }

    if (input.id) {
      const { error } = await supabase
        .from('client_pricing_policies')
        .update(payload)
        .eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/pricing/policies')
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('client_pricing_policies')
        .upsert(payload, { onConflict: 'client_id,line_id' })
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/pricing/policies')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deletePricingPolicy(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('client_pricing_policies').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/pricing/policies')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Price Promotions (#4 ⑥) ──
export interface PromotionInput {
  id?: number
  name: string
  promo_type?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string
  target_tier?: string | null
  target_line_id?: number | null
  target_segment_id?: number | null
  target_client_tier?: string | null
  discount_rate?: number | null
  discount_amount?: number | null
  min_quantity?: number | null
  bundle_note?: string | null
  exclude_luxury?: boolean
  notes?: string | null
}

export async function upsertPromotion(
  input: PromotionInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const payload = {
      name: input.name,
      promo_type: input.promo_type ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      status: input.status ?? 'planning',
      target_tier: input.target_tier ?? null,
      target_line_id: input.target_line_id ?? null,
      target_segment_id: input.target_segment_id ?? null,
      target_client_tier: input.target_client_tier ?? null,
      discount_rate: input.discount_rate ?? null,
      discount_amount: input.discount_amount ?? null,
      min_quantity: input.min_quantity ?? null,
      bundle_note: input.bundle_note ?? null,
      exclude_luxury: input.exclude_luxury ?? true,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await supabase.from('price_promotions').update(payload).eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/pricing/promotions')
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('price_promotions')
        .insert({ ...payload, created_by: userId })
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/pricing/promotions')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deletePromotion(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('price_promotions').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/pricing/promotions')
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
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { error } = await supabase.from('price_decisions').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/pricing')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
