'use server'
/**
 * 운영 (#2c) Server Actions — 샘플 추적 핵심
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ── Sample Requests ──
export interface SampleRequestInput {
  id?: number
  client_id: number
  request_date?: string
  request_method?: string | null
  purpose?: string | null
  ship_date?: string | null
  return_due_date?: string | null
  notes?: string | null
}

export async function createSampleRequest(): Promise<never> {
  let newId: number | null = null
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    // 첫 거래처 자동 선택 (없으면 빈 폼)
    const { data: firstClient } = await supabase
      .from('clients')
      .select('id')
      .eq('active', true)
      .order('name')
      .limit(1)
      .maybeSingle()

    if (!firstClient) {
      throw new Error('등록된 거래처가 없습니다. 먼저 거래처를 추가하세요.')
    }

    const { data, error } = await supabase
      .from('sample_requests')
      .insert({
        client_id: firstClient.id,
        request_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        created_by: userId,
      })
      .select('id')
      .single()
    if (error) throw error
    newId = data.id
  } catch (e) {
    throw e
  }
  redirect(`/finance/operations/samples/${newId}`)
}

export async function updateSampleRequest(
  input: SampleRequestInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!input.id) return { ok: false, error: 'id 누락' }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const patch: Record<string, unknown> = {
      client_id: input.client_id,
      request_method: input.request_method ?? null,
      purpose: input.purpose ?? null,
      ship_date: input.ship_date ?? null,
      return_due_date: input.return_due_date ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    }
    if (input.request_date) patch.request_date = input.request_date

    const { error } = await supabase
      .from('sample_requests')
      .update(patch)
      .eq('id', input.id)
    if (error) return { ok: false, error: error.message }
    revalidatePath(`/finance/operations/samples/${input.id}`)
    revalidatePath('/finance/operations/samples')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function setSampleRequestStatus(
  id: number,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
    if (status === 'shipped' || status === 'sent') {
      patch.ship_date = new Date().toISOString().split('T')[0]
    }
    const { error } = await supabase.from('sample_requests').update(patch).eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath(`/finance/operations/samples/${id}`)
    revalidatePath('/finance/operations/samples')
    revalidatePath('/finance/operations')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteSampleRequest(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('sample_requests').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/operations/samples')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Sample Items ──
export interface SampleItemInput {
  id?: number
  request_id: number
  product_id?: number | null
  product_name: string
  spec?: string | null
  quantity?: number
  unit_cost?: number | null
  notes?: string | null
}

export async function upsertSampleItem(
  input: SampleItemInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const payload = {
      request_id: input.request_id,
      product_id: input.product_id ?? null,
      product_name: input.product_name.trim(),
      spec: input.spec?.trim() || null,
      quantity: input.quantity ?? 1,
      unit_cost: input.unit_cost ?? 0,
      notes: input.notes?.trim() || null,
    }

    if (input.id) {
      const { error } = await supabase.from('sample_items').update(payload).eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath(`/finance/operations/samples/${input.request_id}`)
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('sample_items')
        .insert({ ...payload, status: 'pending' })
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath(`/finance/operations/samples/${input.request_id}`)
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function setSampleItemStatus(
  itemId: number,
  status: string,
  conversionValue?: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const patch: Record<string, unknown> = { status }
    if (status === 'returned') patch.returned_date = new Date().toISOString().split('T')[0]
    if (status === 'converted' && conversionValue) {
      patch.conversion_value = conversionValue
    }

    const { data: item } = await supabase
      .from('sample_items')
      .select('request_id')
      .eq('id', itemId)
      .maybeSingle()

    const { error } = await supabase.from('sample_items').update(patch).eq('id', itemId)
    if (error) return { ok: false, error: error.message }

    if (item?.request_id) {
      revalidatePath(`/finance/operations/samples/${item.request_id}`)
    }
    revalidatePath('/finance/operations/samples')
    revalidatePath('/finance/operations')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteSampleItem(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: item } = await supabase
      .from('sample_items')
      .select('request_id')
      .eq('id', id)
      .maybeSingle()
    const { error } = await supabase.from('sample_items').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    if (item?.request_id) {
      revalidatePath(`/finance/operations/samples/${item.request_id}`)
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Sample Books ──
export interface SampleBookInput {
  id?: number
  name: string
  season?: string | null
  year?: number | null
  description?: string | null
  cover_url?: string | null
  status?: string
}

export async function upsertSampleBook(
  input: SampleBookInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const payload = {
      name: input.name,
      season: input.season ?? null,
      year: input.year ?? null,
      description: input.description ?? null,
      cover_url: input.cover_url ?? null,
      status: input.status ?? 'active',
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await supabase.from('sample_books').update(payload).eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/operations/sample-books')
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('sample_books')
        .insert({ ...payload, created_by: userId })
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/operations/sample-books')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteSampleBook(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('sample_books').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/operations/sample-books')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
