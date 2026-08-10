/**
 * 색동 매장 직접 판매 (현금/카드) — 수기 입력 (대표 지시 2026-07-28)
 * GET  ?months=3 — 최근 N개월 입력 내역 + 월별 현금/카드 합계
 * POST { sale_date, method: 'cash'|'card', amount, memo? } / { action:'delete', id }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const months = Math.min(Number(req.nextUrl.searchParams.get('months') ?? 3), 24)
    const since = new Date()
    since.setMonth(since.getMonth() - months)
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('saekdong_store_sales')
      .select('*')
      .gte('sale_date', since.toLocaleDateString('sv-SE'))
      .order('sale_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(500)
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({ rows: [], monthly: [], tableMissing: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const byMonth = new Map<string, { cash: number; card: number }>()
    for (const r of data ?? []) {
      const m = r.sale_date.slice(0, 7)
      const c = byMonth.get(m) ?? { cash: 0, card: 0 }
      c[r.method as 'cash' | 'card'] += r.amount
      byMonth.set(m, c)
    }
    const monthly = [...byMonth.entries()]
      .map(([month, v]) => ({ month, ...v, total: v.cash + v.card }))
      .sort((a, b) => b.month.localeCompare(a.month))
    return NextResponse.json({ rows: data ?? [], monthly })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const sb = createServiceClient()
    if (b.action === 'delete') {
      const { error } = await sb.from('saekdong_store_sales').delete().eq('id', b.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.sale_date ?? '') || !['cash', 'card'].includes(b.method) || !Number(b.amount)) {
      return NextResponse.json({ error: 'sale_date/method/amount 확인' }, { status: 400 })
    }
    const { data, error } = await sb
      .from('saekdong_store_sales')
      .insert({ sale_date: b.sale_date, method: b.method, amount: Math.round(Number(b.amount)), memo: b.memo?.trim() || null })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, row: data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '저장 실패' }, { status: 500 })
  }
}
