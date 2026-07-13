/**
 * 미수 건 부가정보 (ar_meta) — 프로젝트명·거래처 담당자·연락처.
 * POST { arId, project_name?, contact_name?, contact_phone? } — upsert (빈 문자열 = 지움)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.arId) return NextResponse.json({ error: 'arId 필요' }, { status: 400 })
    const supabase = createServiceClient()
    const { error } = await supabase.from('ar_meta').upsert({
      ar_id: b.arId,
      project_name: b.project_name?.trim() || null,
      contact_name: b.contact_name?.trim() || null,
      contact_phone: b.contact_phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      const missing = /find the table|does not exist|schema cache/i.test(error.message)
      return NextResponse.json(
        { error: missing ? 'ar_meta 테이블이 없습니다 — supabase/migrations/2026-07-13_ar_meta.sql 실행 필요' : error.message },
        { status: missing ? 409 : 500 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '저장 실패' }, { status: 500 })
  }
}
