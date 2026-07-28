/**
 * 마케팅 설정 (mkt_settings key-value) — 쇼핑몰 순이익 목표 등
 * GET ?key=goal / POST { key, value }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get('key')
    if (!key) return NextResponse.json({ error: 'key 필요' }, { status: 400 })
    const sb = createServiceClient()
    const { data, error } = await sb.from('mkt_settings').select('value').eq('key', key).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ value: data?.value ?? null })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { key, value } = await req.json()
    if (!key) return NextResponse.json({ error: 'key 필요' }, { status: 400 })
    const sb = createServiceClient()
    const { error } = await sb.from('mkt_settings').upsert({ key, value }, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '저장 실패' }, { status: 500 })
  }
}
