/**
 * GET   /api/cycle/weekly-targets  — KR 의 12주 분 조회
 * PATCH /api/cycle/weekly-targets  — 단일 주간 셀 업데이트 (upsert)
 *
 * GET query:
 *   key_result_id — 필수
 *
 * PATCH body:
 *   key_result_id: string
 *   week_number: number (1-12)
 *   target_value?: number
 *   actual_value?: number
 *   note?: string
 *
 * actual_value 변경 시 KR.current_value 도 자동 갱신 (해당 주 actual 의 cumulative).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { WeeklyTarget } from '@/lib/cycle-okr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const krId = searchParams.get('key_result_id')
  if (!krId) {
    return NextResponse.json({ error: 'key_result_id 필수' }, { status: 400 })
  }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('weekly_targets')
      .select('*')
      .eq('key_result_id', krId)
      .order('week_number', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ weekly_targets: (data ?? []) as WeeklyTarget[] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '주간 타겟 조회 실패' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.key_result_id || !body.week_number) {
      return NextResponse.json(
        { error: 'key_result_id, week_number 필수' },
        { status: 400 },
      )
    }
    const supabase = await createClient()

    // upsert
    const row: Record<string, unknown> = {
      key_result_id: body.key_result_id,
      week_number: body.week_number,
    }
    if (body.target_value !== undefined) row.target_value = body.target_value
    if (body.actual_value !== undefined) row.actual_value = body.actual_value
    if (body.note !== undefined) row.note = body.note

    const { data, error } = await supabase
      .from('weekly_targets')
      .upsert(row, { onConflict: 'key_result_id,week_number' })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // actual_value 가 갱신되면 KR.current_value = 시작값 + 12주 actual 합 (단순 합)
    if (body.actual_value !== undefined) {
      const { data: kr } = await supabase
        .from('key_results')
        .select('start_value')
        .eq('id', body.key_result_id)
        .single()
      const { data: weeks } = await supabase
        .from('weekly_targets')
        .select('actual_value')
        .eq('key_result_id', body.key_result_id)
      const totalActual = (weeks ?? []).reduce(
        (s, w) => s + Number(w.actual_value ?? 0),
        0,
      )
      const newCurrent = Number(kr?.start_value ?? 0) + totalActual
      await supabase
        .from('key_results')
        .update({ current_value: newCurrent })
        .eq('id', body.key_result_id)
    }

    return NextResponse.json({ weekly_target: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '주간 타겟 수정 실패' },
      { status: 500 },
    )
  }
}
