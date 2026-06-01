/**
 * GET  /api/cycle/todos
 *   query:
 *     employee_id     — 직원 단일 필터
 *     date_from       — YYYY-MM-DD (inclusive)
 *     date_to         — YYYY-MM-DD (inclusive)
 *     weekly_target_id — KR-주간 단일 필터
 *     include_collab  — 본인이 collaborator 인 것 포함 (true/false, default false)
 *
 * POST /api/cycle/todos  — 신규 todo
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DailyTodo } from '@/lib/cycle-okr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employee_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const weeklyTargetId = searchParams.get('weekly_target_id')
  const includeCollab = searchParams.get('include_collab') === 'true'

  try {
    const supabase = await createClient()
    let q = supabase
      .from('daily_todos')
      .select('*')
      .order('date', { ascending: true })
      .order('order_in_day', { ascending: true })

    if (employeeId) {
      if (includeCollab) {
        q = q.or(`employee_id.eq.${employeeId},collaborator_ids.cs.{${employeeId}}`)
      } else {
        q = q.eq('employee_id', employeeId)
      }
    }
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo) q = q.lte('date', dateTo)
    if (weeklyTargetId) q = q.eq('weekly_target_id', weeklyTargetId)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ todos: (data ?? []) as DailyTodo[] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '투두 조회 실패' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.employee_id || !body.date || !body.title) {
      return NextResponse.json(
        { error: 'employee_id, date, title 필수' },
        { status: 400 },
      )
    }
    const supabase = await createClient()

    let nextOrder = body.order_in_day
    if (nextOrder === undefined) {
      const { data: last } = await supabase
        .from('daily_todos')
        .select('order_in_day')
        .eq('employee_id', body.employee_id)
        .eq('date', body.date)
        .order('order_in_day', { ascending: false })
        .limit(1)
        .maybeSingle()
      nextOrder = (last?.order_in_day ?? 0) + 1
    }

    const { data, error } = await supabase
      .from('daily_todos')
      .insert({
        employee_id: body.employee_id,
        weekly_target_id: body.weekly_target_id ?? null,
        date: body.date,
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? 'todo',
        is_shared: body.is_shared ?? false,
        collaborator_ids: body.collaborator_ids ?? [],
        priority: body.priority ?? 2,
        order_in_day: nextOrder,
        blocker_note: body.blocker_note ?? null,
      })
      .select('*')
      .single<DailyTodo>()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ todo: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '투두 등록 실패' },
      { status: 500 },
    )
  }
}
