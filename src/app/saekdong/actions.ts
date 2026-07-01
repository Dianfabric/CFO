'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const ANON_UUID = '00000000-0000-0000-0000-000000000000'

export interface SaekdongVision {
  vision: string | null
  mission: string | null
}

export interface SaekdongVisionInput {
  vision?: string | null
  mission?: string | null
}

/** 색동 비전·미션 조회 (테이블 없거나 미설정이면 null). */
export async function getSaekdongVision(): Promise<SaekdongVision> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('saekdong_vision')
      .select('vision, mission')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return { vision: null, mission: null }
    return { vision: data.vision ?? null, mission: data.mission ?? null }
  } catch {
    return { vision: null, mission: null }
  }
}

/** 색동 비전·미션 저장 (단일 행 upsert). */
export async function upsertSaekdongVision(
  input: SaekdongVisionInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? ANON_UUID

    const { error } = await supabase.from('saekdong_vision').upsert(
      {
        id: 1,
        vision: input.vision ?? null,
        mission: input.mission ?? null,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: 'id' },
    )
    if (error) return { ok: false, error: error.message }

    revalidatePath('/saekdong')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
