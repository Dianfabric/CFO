/**
 * GET  /api/cycle/key-results  — KR 목록 (goal_id 필터)
 * POST /api/cycle/key-results  — KR 등록
 *
 * KR 등록 시 weekly_targets 12행 자동 생성 (target_value 균등 분할).
 *
 * query (GET):
 *   goal_id      — (옵션) 목표 필터
 *   cycle_id     — (옵션) cycle 안의 모든 KR
 *   pinned_only  — (옵션) is_company_pinned=true 만
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { KeyResult } from '@/lib/cycle-okr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const goalId = searchParams.get('goal_id')
  const cycleId = searchParams.get('cycle_id')
  const pinnedOnly = searchParams.get('pinned_only') === 'true'
  try {
    const supabase = await createClient()

    if (cycleId && !goalId) {
      // cycle 안의 모든 KR (goal join)
      const { data: goals } = await supabase
        .from('employee_goals')
        .select('id')
        .eq('cycle_id', Number(cycleId))
      const goalIds = (goals ?? []).map((g) => g.id)
      if (goalIds.length === 0) {
        return NextResponse.json({ key_results: [] })
      }
      let q = supabase
        .from('key_results')
        .select('*')
        .in('goal_id', goalIds)
        .order('display_order', { ascending: true })
      if (pinnedOnly) q = q.eq('is_company_pinned', true).order('pinned_order')
      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ key_results: (data ?? []) as KeyResult[] })
    }

    let q = supabase
      .from('key_results')
      .select('*')
      .order('display_order', { ascending: true })
    if (goalId) q = q.eq('goal_id', goalId)
    if (pinnedOnly) q = q.eq('is_company_pinned', true)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ key_results: (data ?? []) as KeyResult[] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'KR 조회 실패' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.goal_id || !body.title || body.target_value === undefined) {
      return NextResponse.json(
        { error: 'goal_id, title, target_value 필수' },
        { status: 400 },
      )
    }
    const supabase = await createClient()

    let nextOrder = body.display_order
    if (nextOrder === undefined) {
      const { data: last } = await supabase
        .from('key_results')
        .select('display_order')
        .eq('goal_id', body.goal_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      nextOrder = (last?.display_order ?? 0) + 1
    }

    const startValue = Number(body.start_value ?? 0)
    const targetValue = Number(body.target_value)

    const { data: kr, error } = await supabase
      .from('key_results')
      .insert({
        goal_id: body.goal_id,
        title: body.title,
        // 선행 측정값
        unit: body.unit ?? 'count',
        is_leading: body.is_leading ?? true,
        start_value: startValue,
        target_value: targetValue,
        current_value: Number(body.current_value ?? startValue),
        metric_code: body.metric_code ?? null,
        auto_sync: body.auto_sync ?? false,
        // 후행 측정값 (페어)
        lag_metric_code: body.lag_metric_code ?? null,
        lag_unit: body.lag_unit ?? null,
        lag_start_value: body.lag_start_value ?? null,
        lag_target_value: body.lag_target_value ?? null,
        lag_current_value:
          body.lag_current_value ??
          (body.lag_target_value != null ? body.lag_start_value ?? 0 : null),
        lag_auto_sync: body.lag_auto_sync ?? false,
        // 메타
        is_company_pinned: body.is_company_pinned ?? false,
        pinned_order: body.pinned_order ?? null,
        display_order: nextOrder,
        expected_lag_impact: body.expected_lag_impact ?? null,
        started_date: body.started_date ?? null,
      })
      .select('*')
      .single<KeyResult>()

    if (error || !kr) {
      return NextResponse.json({ error: error?.message ?? 'KR 등록 실패' }, { status: 500 })
    }

    // weekly_targets 12행 자동 생성 + 각 주의 note + 5일 투두 일괄 처리
    interface UserWeekly {
      week_number: number
      target_value?: number
      actual_value?: number | null
      note?: string | null
      todos?: Array<{ date: string; title: string; priority?: number; status?: string }>
    }
    const userWeekly: UserWeekly[] | undefined = Array.isArray(body.weekly_targets)
      ? body.weekly_targets
      : undefined
    const span = targetValue - startValue
    const weeklyRows = Array.from({ length: 12 }).map((_, i) => {
      const wn = i + 1
      const u = userWeekly?.find((w) => w.week_number === wn)
      const userVal = u?.target_value
      const autoVal = Number((startValue + (span * wn) / 12).toFixed(2))
      return {
        key_result_id: kr.id,
        week_number: wn,
        target_value: userVal != null ? Number(userVal) : autoVal,
        actual_value:
          u?.actual_value != null && !Number.isNaN(Number(u.actual_value))
            ? Number(u.actual_value)
            : 0,
        note: u?.note ?? null,
      }
    })
    const { data: insertedWeekly } = await supabase
      .from('weekly_targets')
      .insert(weeklyRows)
      .select('id, week_number')

    // 일일 투두 일괄 insert (사용자가 입력한 것만)
    if (insertedWeekly && userWeekly) {
      const employeeIdForTodos = body.employee_id // KrForm 이 보내야 함
      // employee_id 가 body 에 없으면 goal 에서 가져옴
      let empId: string | undefined = employeeIdForTodos
      if (!empId) {
        const { data: g } = await supabase
          .from('employee_goals')
          .select('employee_id')
          .eq('id', body.goal_id)
          .maybeSingle()
        empId = g?.employee_id
      }

      if (empId) {
        const todoRows: Array<Record<string, unknown>> = []
        for (const u of userWeekly) {
          const wt = insertedWeekly.find((w) => w.week_number === u.week_number)
          if (!wt || !u.todos || u.todos.length === 0) continue
          for (const t of u.todos) {
            if (!t.title?.trim() || !t.date) continue
            todoRows.push({
              employee_id: empId,
              weekly_target_id: wt.id,
              date: t.date,
              title: t.title.trim(),
              priority: t.priority ?? 2,
              status: t.status === 'done' ? 'done' : 'todo',
            })
          }
        }
        if (todoRows.length > 0) {
          await supabase.from('daily_todos').insert(todoRows)
        }
      }
    }

    return NextResponse.json({ key_result: kr }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'KR 등록 실패' },
      { status: 500 },
    )
  }
}
