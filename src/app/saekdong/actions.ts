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

// ── 매입 (매출원가) ──

export interface SaekdongPurchase {
  id: number
  purchase_date: string // YYYY-MM-DD
  kind: 'fabric' | 'finished'
  item_name: string
  supplier: string | null
  supplier_tax_type: 'general' | 'simplified'
  qty: number
  unit_price: number
  amount: number // 공급가액 (간이는 지급총액)
  vat: number
  paid: boolean
  invoice_received: boolean
  memo: string | null
}

export interface PurchaseInput {
  purchase_date: string
  kind: 'fabric' | 'finished'
  item_name: string
  supplier?: string | null
  supplier_tax_type: 'general' | 'simplified'
  qty: number
  unit_price: number
  amount: number
  vat: number
  memo?: string | null
}

// ── 비용 (고정/변동) ──

export interface SaekdongExpense {
  id: number
  cost_type: 'fixed' | 'variable'
  category: string
  item: string
  discretionary: boolean
  nature: '판관비' | '매출원가' | '영업외비용'
  amount: number
  is_monthly: boolean
  start_month: string | null // YYYY-MM
  end_month: string | null
  expense_date: string | null // YYYY-MM-DD
  memo: string | null
}

export interface ExpenseInput {
  cost_type: 'fixed' | 'variable'
  category: string
  item: string
  discretionary: boolean
  nature: '판관비' | '매출원가' | '영업외비용'
  amount: number
  is_monthly: boolean
  start_month?: string | null
  end_month?: string | null
  expense_date?: string | null
  memo?: string | null
}

// 품목 기준단가 — 매입으로 잡지 않는 제품별 원가 (이익 계산 전용)
export interface SaekdongItemCost {
  item_name: string
  unit_cost: number
  memo: string | null
}

// 선물(무료 증정) — 재고 차감 기록
export interface SaekdongGift {
  id: number
  gift_date: string // YYYY-MM-DD
  item_name: string
  qty: number
  memo: string | null
}

/** 매입 + 비용 + 기준단가 + 선물 전체 조회 (테이블 없으면 빈 배열 + 안내). */
export async function listSaekdongCosts(): Promise<{
  purchases: SaekdongPurchase[]
  expenses: SaekdongExpense[]
  itemCosts: SaekdongItemCost[]
  gifts: SaekdongGift[]
  tableMissing?: boolean
}> {
  try {
    const supabase = await createClient()
    const [p, e, c, g] = await Promise.all([
      supabase
        .from('saekdong_purchases')
        .select('*')
        .order('purchase_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(500),
      supabase
        .from('saekdong_expenses')
        .select('*')
        .order('is_monthly', { ascending: false })
        .order('expense_date', { ascending: false })
        .limit(500),
      supabase
        .from('saekdong_item_costs')
        .select('item_name, unit_cost, memo')
        .order('item_name'),
      supabase
        .from('saekdong_gifts')
        .select('*')
        .order('gift_date', { ascending: false })
        .limit(300),
    ])
    if (p.error || e.error) {
      const msg = p.error?.message ?? e.error?.message ?? ''
      return {
        purchases: [], expenses: [], itemCosts: [], gifts: [],
        tableMissing: /find the table|does not exist/i.test(msg),
      }
    }
    return {
      purchases: (p.data ?? []) as SaekdongPurchase[],
      expenses: (e.data ?? []) as SaekdongExpense[],
      // 기준단가·선물 테이블은 없어도 매입·비용은 정상 동작
      itemCosts: (c.error ? [] : (c.data ?? [])) as SaekdongItemCost[],
      gifts: (g.error ? [] : (g.data ?? [])) as SaekdongGift[],
    }
  } catch {
    return { purchases: [], expenses: [], itemCosts: [], gifts: [], tableMissing: true }
  }
}

/** 선물(무료 증정) 기록 추가 — 재고에서 차감 */
export async function addSaekdongGift(input: {
  gift_date: string
  item_name: string
  qty: number
  memo?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('saekdong_gifts').insert({
      gift_date: input.gift_date,
      item_name: input.item_name.trim(),
      qty: input.qty,
      memo: input.memo ?? null,
    })
    if (error) return { ok: false, error: error.message }
    revalidatePath('/saekdong')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteSaekdongGift(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('saekdong_gifts').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/saekdong')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 품목 기준단가 등록/수정 (매입 아님 — 이익 계산 전용) */
export async function upsertSaekdongItemCost(
  input: SaekdongItemCost,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('saekdong_item_costs').upsert(
      {
        item_name: input.item_name.trim(),
        unit_cost: input.unit_cost,
        memo: input.memo ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'item_name' },
    )
    if (error) return { ok: false, error: error.message }
    revalidatePath('/saekdong')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteSaekdongItemCost(
  itemName: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('saekdong_item_costs').delete().eq('item_name', itemName)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/saekdong')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function addSaekdongPurchase(
  input: PurchaseInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('saekdong_purchases').insert({
      ...input,
      vat: input.supplier_tax_type === 'simplified' ? 0 : input.vat,
    })
    if (error) return { ok: false, error: error.message }
    revalidatePath('/saekdong')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 송금/계산서 체크 토글 등 부분 수정 */
export async function updateSaekdongPurchase(
  id: number,
  patch: Partial<Pick<SaekdongPurchase, 'paid' | 'invoice_received' | 'memo' | 'amount' | 'vat' | 'qty' | 'unit_price'>>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('saekdong_purchases')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/saekdong')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteSaekdongPurchase(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('saekdong_purchases').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/saekdong')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function addSaekdongExpense(
  input: ExpenseInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('saekdong_expenses').insert(input)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/saekdong')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateSaekdongExpense(
  id: number,
  patch: Partial<ExpenseInput>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('saekdong_expenses')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/saekdong')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteSaekdongExpense(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('saekdong_expenses').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/saekdong')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
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
