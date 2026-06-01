/**
 * GET  /api/cycle/wam-scores  — 직원별 12주 점수 (v_wam_weekly_scores)
 *   query:
 *     employee_id   — (옵션) 특정 직원
 *
 * PATCH /api/cycle/wam-scores  — 자기평가 점수 upsert
 *   body: { employee_id, week_number, self_score (1-5), note? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { WamWeeklyScore } from '@/lib/cycle-okr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employee_id')
  try {
    const supabase = await createClient()
    let q = supabase
      .from('v_wam_weekly_scores')
      .select('*')
      .order('employee_id')
      .order('week_number')
    if (employeeId) q = q.eq('employee_id', employeeId)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ scores: (data ?? []) as WamWeeklyScore[] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'WAM 점수 조회 실패' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.employee_id || !body.week_number || !body.self_score) {
      return NextResponse.json(
        { error: 'employee_id, week_number, self_score 필수' },
        { status: 400 },
      )
    }
    const sc = Number(body.self_score)
    if (sc < 1 || sc > 5) {
      return NextResponse.json({ error: 'self_score 는 1~5' }, { status: 400 })
    }

    const supabase = await createClient()

    // 활성 사이클
    const { data: cycle } = await supabase
      .from('cycles')
      .select('id')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cycle) {
      return NextResponse.json({ error: '활성 사이클 없음' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('weekly_self_scores')
      .upsert(
        {
          cycle_id: cycle.id,
          employee_id: body.employee_id,
          week_number: body.week_number,
          self_score: sc,
          note: body.note ?? null,
        },
        { onConflict: 'cycle_id,employee_id,week_number' },
      )
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ self_score: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '자기평가 저장 실패' },
      { status: 500 },
    )
  }
}
