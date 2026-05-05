/**
 * Supabase 미러 쓰기 (v1.1 import)
 *
 * 일계표 1일치를 받아 Supabase에 거래처/거래/품목/비용을 기록한다.
 * - 거래처는 이름으로 upsert (default: occupation=interior_project, primary_division=sofa)
 * - 거래는 stage='paid' (현금) 또는 'confirmed' (외상)
 * - 24셀·4티어 매핑은 DB 트리거가 처리 (auto_map_transaction_segment)
 *
 * RLS 우회를 위해 service_role 클라이언트 사용 (서버 전용).
 */
import { createServiceClient } from '@/lib/supabase/server'
import type { DaySheet, TxRow } from './parser'
import { groupSales, groupPurchases, getExpenseRows } from './parser'

type SupabaseAdmin = ReturnType<typeof createServiceClient>

export interface DaySyncResult {
  date: string
  ok: boolean
  message?: string
  salesCount: number
  expenseCount: number
  purchaseCount: number
  error?: string
}

/**
 * 거래처 upsert: 이름으로 찾거나 새로 만들기.
 * default occupation/primary_division를 적용 (24셀 자동 매핑이 동작하도록).
 */
async function upsertClient(
  supabase: SupabaseAdmin,
  name: string,
  isSupplier: boolean,
): Promise<number | null> {
  if (!name) return null

  // 먼저 찾기
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (existing?.id) return existing.id

  // 없으면 새로 만들기
  const { data: created, error } = await supabase
    .from('clients')
    .insert({
      name,
      occupation: isSupplier ? null : 'interior_project',
      primary_division: isSupplier ? null : 'sofa',
      tier: 'general',
      notes: '자동 등록 (v1.1 일계표 업로드, 추후 24셀 매핑 갱신 필요)',
    })
    .select('id')
    .single()

  if (error) {
    console.error(`[supabaseSync] upsertClient(${name}) failed:`, error.message)
    return null
  }
  return created.id
}

/** 일일결산 한 행 upsert (조건: close_date UNIQUE) */
async function upsertDailyClose(supabase: SupabaseAdmin, dateStr: string) {
  // 해당 날짜의 transactions에서 합계 계산
  const { data } = await supabase
    .from('transactions')
    .select('total_amount, total_cost, margin_amount, client_id')
    .eq('transaction_date', dateStr)

  const total_revenue = (data ?? []).reduce((s, r) => s + Number(r.total_amount || 0), 0)
  const total_cost = (data ?? []).reduce((s, r) => s + Number(r.total_cost || 0), 0)
  const contribution_margin = (data ?? []).reduce((s, r) => s + Number(r.margin_amount || 0), 0)
  const transaction_count = (data ?? []).length
  const distinctClients = new Set((data ?? []).map((r) => r.client_id).filter(Boolean))

  await supabase.from('daily_closes').upsert(
    {
      close_date: dateStr,
      total_revenue,
      total_cost,
      contribution_margin,
      transaction_count,
      new_clients_count: distinctClients.size, // 정확하지 않지만 빈 DB 시작 시 근사치
      payment_received: 0,
    },
    { onConflict: 'close_date' },
  )
}

/**
 * 1일치 일계표 데이터를 Supabase에 기록.
 * Prisma 쪽 처리는 호출 측(API route)이 따로 진행한다.
 */
export async function syncDayToSupabase(day: DaySheet): Promise<DaySyncResult> {
  const supabase = createServiceClient()
  const result: DaySyncResult = {
    date: day.dateStr,
    ok: false,
    salesCount: 0,
    expenseCount: 0,
    purchaseCount: 0,
  }

  try {
    // 중복 검사: 해당 날짜에 transactions가 이미 있으면 스킵
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('transaction_date', day.dateStr)

    if (count && count > 0) {
      result.ok = true
      result.message = '이미 업로드된 날짜 (Supabase, 스킵)'
      return result
    }

    // ── 외출 (SALE) ──
    const saleGroups = groupSales(day.rows)
    for (const [, items] of saleGroups) {
      const clientName = items[0].client
      if (!clientName) continue
      const totalAmount = items.reduce((s, i) => s + i.amount, 0)
      if (totalAmount === 0) continue

      const clientId = await upsertClient(supabase, clientName, false)
      if (!clientId) continue

      const allPaid = false // 일계표에는 결제 정보 없음 → 기본값 외상
      const stage = allPaid ? 'paid' : 'confirmed'

      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert({
          transaction_date: day.dateStr,
          client_id: clientId,
          stage,
          total_amount: totalAmount,
          total_cost: 0,
          notes: `일계표 매출 - ${clientName}`,
        })
        .select('id')
        .single()

      if (txError || !tx) {
        console.error(`[supabaseSync] insert tx failed:`, txError?.message)
        continue
      }

      // 품목 행 추가
      const itemRows = items
        .filter((i) => i.qty > 0 || i.amount > 0)
        .map((i: TxRow) => ({
          transaction_id: tx.id,
          quantity: i.qty || 1,
          unit_price: i.unitPrice || (i.qty ? i.amount / i.qty : i.amount),
          unit_cost: 0,
          notes: [i.productName, i.spec, i.memo].filter(Boolean).join(' | '),
        }))

      if (itemRows.length > 0) {
        const { error: itemError } = await supabase.from('transaction_items').insert(itemRows)
        if (itemError) console.error(`[supabaseSync] insert items failed:`, itemError.message)
      }

      result.salesCount++
    }

    // ── 외입 (PURCHASE) → expenses 카테고리 '원단매입' ──
    const purchaseGroups = groupPurchases(day.rows)
    for (const [, items] of purchaseGroups) {
      const clientName = items[0].client
      const totalAmount = items.reduce((s, i) => s + Math.abs(i.amount), 0)
      if (totalAmount === 0) continue

      const { error } = await supabase.from('expenses').insert({
        expense_date: day.dateStr,
        category: '원단매입',
        amount: totalAmount,
        variability: 'variable',
        discretion: 'non_discretionary',
        team: '운영',
        description: `매입 - ${clientName || '알 수 없음'}`,
      })
      if (error) console.error(`[supabaseSync] insert purchase expense failed:`, error.message)
      else result.purchaseCount++
    }

    // ── 현비 (EXPENSE) → expenses ──
    for (const r of getExpenseRows(day.rows)) {
      const amount = Math.abs(r.amount)
      if (amount === 0) continue

      const { error } = await supabase.from('expenses').insert({
        expense_date: day.dateStr,
        category: '운영비',
        amount,
        variability: 'variable',
        discretion: 'discretionary',
        team: '운영',
        description: r.productName || r.memo || '경비',
      })
      if (error) console.error(`[supabaseSync] insert expense failed:`, error.message)
      else result.expenseCount++
    }

    // 일일결산 갱신
    await upsertDailyClose(supabase, day.dateStr)

    result.ok = true
    return result
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e)
    return result
  }
}
