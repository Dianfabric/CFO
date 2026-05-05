'use server'
/**
 * 거래처 관리 Server Actions (v1.1)
 *
 * RLS 적용: 일반 createClient() 사용 → CEO/executive는 모든 거래처,
 * 일반 직원은 본인 등록한 거래처만 (clients 테이블에 RLS 정책 추가 시).
 *
 * 현재 schema.sql에는 clients RLS가 없으므로 인증된 모든 사용자가 가능.
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type UpdateClientInput = {
  id: number
  name?: string
  occupation?: string | null
  primary_division?: string | null
  tier?: string | null
  contact_person?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  payment_terms_days?: number | null
  notes?: string | null
}

export async function updateClient(
  input: UpdateClientInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!input.id) return { ok: false, error: 'id가 없습니다.' }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    // 빈 문자열은 null로 (occupation/division은 enum이라 ''는 invalid)
    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.occupation !== undefined) patch.occupation = input.occupation || null
    if (input.primary_division !== undefined) patch.primary_division = input.primary_division || null
    if (input.tier !== undefined) patch.tier = input.tier || null
    if (input.contact_person !== undefined) patch.contact_person = input.contact_person || null
    if (input.contact_phone !== undefined) patch.contact_phone = input.contact_phone || null
    if (input.contact_email !== undefined) patch.contact_email = input.contact_email || null
    if (input.payment_terms_days !== undefined) patch.payment_terms_days = input.payment_terms_days
    if (input.notes !== undefined) patch.notes = input.notes || null

    const { error } = await supabase.from('clients').update(patch).eq('id', input.id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/clients')
    revalidatePath('/finance')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
