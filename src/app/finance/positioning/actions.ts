'use server'
/**
 * 포지셔닝 매트릭스 / 제품 라인 Server Actions (PRD #4)
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface UpsertProductLineInput {
  id?: number
  name: string
  brand_name?: string | null
  tier: string // 'value' | 'mid' | 'premium' | 'luxury'
  division: string // 'sofa' | 'curtain' | 'wall' | 'accessory'
  value_essential?: string | null
  value_extended?: string | null
  value_roi_note?: string | null
  active?: boolean
}

export async function upsertProductLine(
  input: UpsertProductLineInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const payload = {
      name: input.name.trim(),
      brand_name: input.brand_name?.trim() || null,
      tier: input.tier,
      division: input.division,
      value_essential: input.value_essential?.trim() || null,
      value_extended: input.value_extended?.trim() || null,
      value_roi_note: input.value_roi_note?.trim() || null,
      active: input.active ?? true,
    }

    if (input.id) {
      const { error } = await supabase.from('product_lines').update(payload).eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/positioning')
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('product_lines')
        .insert(payload)
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/positioning')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteProductLine(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    // 실제 삭제보단 비활성화가 안전 (FK 거는 products가 있을 수 있음)
    const { error } = await supabase
      .from('product_lines')
      .update({ active: false })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/positioning')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
