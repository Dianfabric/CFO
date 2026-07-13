/**
 * 매출원가 수기 원가(cogs_overrides) CRUD.
 * GET    ?active=1        — 등록된 수기 원가 목록
 * POST   { scope, product_name, match_mode?, transaction_id?, cost_mode, unit_cost, effective_from?, note? }
 * DELETE ?id=
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TABLE_MISSING = /find the table|does not exist|schema cache/i
const MISSING_MSG = 'cogs_overrides 테이블이 없습니다 — supabase/migrations/2026-07-13_cogs_overrides.sql 실행 필요'

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('cogs_overrides')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
    if (error) {
      if (TABLE_MISSING.test(error.message)) return NextResponse.json({ overrides: [], tableMissing: true })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ overrides: data ?? [] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.product_name || b.unit_cost == null) {
      return NextResponse.json({ error: 'product_name, unit_cost 필수' }, { status: 400 })
    }
    const scope = b.scope === 'line' ? 'line' : 'name'
    const row = {
      scope,
      product_name: String(b.product_name).trim(),
      match_mode: b.match_mode === 'contains' ? 'contains' : 'exact',
      transaction_id: scope === 'line' ? (b.transaction_id ?? null) : null,
      cost_mode: b.cost_mode === 'per_line' ? 'per_line' : 'per_unit',
      unit_cost: Math.round(Number(b.unit_cost)),
      effective_from: b.effective_from || '2026-07-01',
      note: b.note?.trim() || null,
      active: true,
    }
    const supabase = createServiceClient()
    const { data, error } = await supabase.from('cogs_overrides').insert(row).select('*').single()
    if (error) {
      if (TABLE_MISSING.test(error.message)) return NextResponse.json({ error: MISSING_MSG }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ override: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '등록 실패' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })
    const supabase = createServiceClient()
    const { error } = await supabase.from('cogs_overrides').delete().eq('id', Number(id))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '삭제 실패' }, { status: 500 })
  }
}
