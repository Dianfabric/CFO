'use server'
/**
 * 니즈 카드 Server Actions (PRD #2a ④)
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface NeedCardInput {
  id?: number
  client_id?: number | null
  category?: string | null
  description: string
  discovery_method?: string | null
  status?: string
}

export async function upsertNeedCard(
  input: NeedCardInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  if (!input.description.trim()) {
    return { ok: false, error: '니즈 설명을 입력해 주세요.' }
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const payload = {
      agent_id: user.id,
      client_id: input.client_id ?? null,
      category: input.category?.trim() || null,
      description: input.description.trim(),
      discovery_method: input.discovery_method?.trim() || null,
      status: input.status ?? 'new',
    }

    if (input.id) {
      const { error } = await supabase.from('need_cards').update(payload).eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/sales/needs')
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase.from('need_cards').insert(payload).select('id').single()
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/sales/needs')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function moveNeedCardStatus(
  id: number,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase.from('need_cards').update({ status }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/sales/needs')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function voteNeedCard(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    // increment votes
    const { data: cur } = await supabase.from('need_cards').select('votes').eq('id', id).maybeSingle()
    const newVotes = Number(cur?.votes ?? 0) + 1
    const { error } = await supabase.from('need_cards').update({ votes: newVotes }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/sales/needs')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteNeedCard(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase.from('need_cards').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/sales/needs')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
