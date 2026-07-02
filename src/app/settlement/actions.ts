'use server'

/**
 * 경영 계기판 서버 액션 — 본체 스와치·샘플 재고 (V1 대략).
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface SampleMove {
  id: number
  move_date: string // YYYY-MM-DD
  direction: 'in' | 'out'
  item_name: string
  qty: number
  counterparty: string | null
  memo: string | null
}

/** 이동 기록 전체 (최신순) — 테이블 없으면 tableMissing */
export async function listSampleMoves(): Promise<{
  moves: SampleMove[]
  tableMissing?: boolean
}> {
  try {
    const sb = await createClient()
    const { data, error } = await sb
      .from('dian_sample_moves')
      .select('*')
      .order('move_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(500)
    if (error) {
      return { moves: [], tableMissing: /find the table|does not exist/i.test(error.message) }
    }
    return { moves: (data ?? []) as SampleMove[] }
  } catch {
    return { moves: [], tableMissing: true }
  }
}

export async function addSampleMove(input: {
  move_date: string
  direction: 'in' | 'out'
  item_name: string
  qty: number
  counterparty?: string | null
  memo?: string | null
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  try {
    const sb = await createClient()
    const { data, error } = await sb
      .from('dian_sample_moves')
      .insert({
        move_date: input.move_date,
        direction: input.direction,
        item_name: input.item_name.trim(),
        qty: input.qty,
        counterparty: input.counterparty?.trim() || null,
        memo: input.memo?.trim() || null,
      })
      .select('id')
      .single()
    if (error) {
      return {
        ok: false,
        error: /find the table|does not exist/i.test(error.message)
          ? '재고 테이블이 없습니다 — supabase/migrations/2026-07-02_dian_sample_stock.sql 을 실행해 주세요.'
          : error.message,
      }
    }
    revalidatePath('/settlement')
    return { ok: true, id: (data as { id: number } | null)?.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteSampleMove(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = await createClient()
    const { error } = await sb.from('dian_sample_moves').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/settlement')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
