/**
 * GET  /api/cycle/goals  — 목표 목록 (cycle_id + employee_id 필터)
 * POST /api/cycle/goals  — 목표 등록
 *
 * query (GET):
 *   cycle_id     — (필수) 사이클 id
 *   employee_id  — (옵션) 직원 필터
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmployeeGoal } from '@/lib/cycle-okr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cycleId = searchParams.get('cycle_id')
  const employeeId = searchParams.get('employee_id')
  if (!cycleId) {
    return NextResponse.json({ error: 'cycle_id 필수' }, { status: 400 })
  }
  try {
    const supabase = await createClient()
    let query = supabase
      .from('employee_goals')
      .select('*')
      .eq('cycle_id', Number(cycleId))
      .order('display_order', { ascending: true })
    if (employeeId) query = query.eq('employee_id', employeeId)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ goals: (data ?? []) as EmployeeGoal[] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '목표 조회 실패' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.cycle_id || !body.employee_id || !body.title) {
      return NextResponse.json(
        { error: 'cycle_id, employee_id, title 필수' },
        { status: 400 },
      )
    }
    const supabase = await createClient()

    let nextOrder = body.display_order
    if (nextOrder === undefined) {
      const { data: last } = await supabase
        .from('employee_goals')
        .select('display_order')
        .eq('cycle_id', body.cycle_id)
        .eq('employee_id', body.employee_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      nextOrder = (last?.display_order ?? 0) + 1
    }

    // 빅 목표 자동 처리:
    //  - is_big_goal 명시 안 됐을 때, 그 직원에 빅 목표가 없으면 자동 true
    //  - 이미 빅 목표가 있으면 새 목표는 일반 목표
    //  - DB trigger 가 중복 빅 자동 false 처리
    let isBig = body.is_big_goal
    if (isBig === undefined) {
      const { data: existingBig } = await supabase
        .from('employee_goals')
        .select('id')
        .eq('cycle_id', body.cycle_id)
        .eq('employee_id', body.employee_id)
        .eq('is_big_goal', true)
        .maybeSingle()
      isBig = !existingBig
    }

    const { data, error } = await supabase
      .from('employee_goals')
      .insert({
        cycle_id: body.cycle_id,
        employee_id: body.employee_id,
        title: body.title,
        business_track: body.business_track ?? 'both',
        status: body.status ?? 'active',
        display_order: nextOrder,
        is_big_goal: isBig,
      })
      .select('*')
      .single<EmployeeGoal>()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ goal: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '목표 등록 실패' },
      { status: 500 },
    )
  }
}
