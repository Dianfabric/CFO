'use server'

/**
 * 1일 체크리스트 서버 액션 (공문/자료 페이지).
 * 항목 마스터(담당자 포함) + 날짜별 체크 기록 — 매일 자동으로 새로 시작.
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface ChecklistItem {
  id: number
  title: string
  memo: string | null
  link: string | null
  assignee: string
  sort_order: number
  checked: boolean // 조회 날짜 기준
}

function kstToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

/** 오늘 기준 체크리스트 조회 (테이블 없으면 tableMissing) */
export async function listDailyChecklist(): Promise<{
  items: ChecklistItem[]
  date: string
  tableMissing?: boolean
  error?: string
}> {
  const date = kstToday()
  try {
    const sb = await createClient()
    const [items, checks] = await Promise.all([
      sb
        .from('daily_checklist_items')
        .select('id, title, memo, link, assignee, sort_order')
        .eq('active', true)
        .order('sort_order')
        .order('id'),
      sb.from('daily_checklist_checks').select('item_id').eq('check_date', date),
    ])
    if (items.error) {
      return {
        items: [],
        date,
        tableMissing: /find the table|does not exist/i.test(items.error.message),
        error: items.error.message,
      }
    }
    const checkedSet = new Set((checks.data ?? []).map((c) => c.item_id as number))
    return {
      items: (items.data ?? []).map((it) => ({
        ...(it as Omit<ChecklistItem, 'checked'>),
        checked: checkedSet.has(it.id as number),
      })),
      date,
    }
  } catch (e) {
    return { items: [], date, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 오늘 체크 토글 */
export async function toggleDailyCheck(
  itemId: number,
  checked: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const date = kstToday()
  try {
    const sb = await createClient()
    if (checked) {
      const { error } = await sb
        .from('daily_checklist_checks')
        .upsert({ item_id: itemId, check_date: date }, { onConflict: 'item_id,check_date' })
      if (error) return { ok: false, error: error.message }
    } else {
      const { error } = await sb
        .from('daily_checklist_checks')
        .delete()
        .eq('item_id', itemId)
        .eq('check_date', date)
      if (error) return { ok: false, error: error.message }
    }
    revalidatePath('/documents')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 체크 항목 추가 */
export async function addChecklistItem(input: {
  title: string
  assignee: string
  memo?: string | null
  link?: string | null
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  try {
    const sb = await createClient()
    const { data, error } = await sb
      .from('daily_checklist_items')
      .insert({
        title: input.title.trim(),
        assignee: input.assignee.trim() || '대표',
        memo: input.memo?.trim() || null,
        link: input.link?.trim() || null,
        sort_order: 99,
      })
      .select('id')
      .single()
    if (error) {
      return {
        ok: false,
        error: /find the table|does not exist/i.test(error.message)
          ? '체크리스트 테이블이 없습니다 — supabase/migrations/2026-07-02_daily_checklist.sql 을 실행해 주세요.'
          : error.message,
      }
    }
    revalidatePath('/documents')
    return { ok: true, id: (data as { id: number } | null)?.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 체크 항목 삭제 (비활성화가 아닌 완전 삭제) */
export async function deleteChecklistItem(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = await createClient()
    const { error } = await sb.from('daily_checklist_items').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/documents')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
