/**
 * 매입 계산서 거래처 자동 분류 규칙 관리 (대표 지시 2026-07-13)
 *
 * PATCH  { supplier_key, mode: 'auto'|'manual' } — 자동↔수동(혼합) 전환
 * DELETE { supplier_key } — 규칙 삭제 (이미 분류된 계산서는 그대로)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.supplier_key || !['auto', 'manual'].includes(b.mode)) {
      return NextResponse.json({ error: 'supplier_key, mode(auto|manual) 필요' }, { status: 400 })
    }
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('ptax_supplier_rules')
      .update({ mode: b.mode, updated_at: new Date().toISOString() })
      .eq('supplier_key', b.supplier_key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.supplier_key) return NextResponse.json({ error: 'supplier_key 필요' }, { status: 400 })
    const supabase = createServiceClient()
    const { error } = await supabase.from('ptax_supplier_rules').delete().eq('supplier_key', b.supplier_key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '삭제 실패' }, { status: 500 })
  }
}
