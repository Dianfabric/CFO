/**
 * 색동 전용 12주 사이클 (대표 지시 2026-07-13 — 색동은 본체와 따로 목표 관리)
 * POST { start_date } → 종료일 자동(+12주−1일), cycles 에 status='saekdong' 단일 행 upsert
 * 본체 12주 대시보드는 status='active' 만 보므로 서로 간섭 없음.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SAEK_CYCLE_NUMBER = 901

export async function POST(req: NextRequest) {
  try {
    const { start_date } = await req.json()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date ?? '')) {
      return NextResponse.json({ error: 'start_date(YYYY-MM-DD) 필요' }, { status: 400 })
    }
    const end = new Date(start_date + 'T12:00:00')
    end.setDate(end.getDate() + 12 * 7 - 1)
    const end_date = end.toLocaleDateString('sv-SE')
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('cycles')
      .upsert(
        {
          cycle_number: SAEK_CYCLE_NUMBER,
          start_date,
          end_date,
          status: 'saekdong',
          vision_statement: '색동 신사업 전용 사이클',
        },
        { onConflict: 'cycle_number' },
      )
      .select('id, start_date, end_date')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, cycle: data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '실패' }, { status: 500 })
  }
}
