/**
 * GET  /api/cycle/employees  — 직원 목록
 * POST /api/cycle/employees  — 직원 등록
 *
 * query params (GET):
 *   include_inactive — 비활성 포함 여부 (default false)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Employee } from '@/lib/cycle-okr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const includeInactive = searchParams.get('include_inactive') === 'true'
  try {
    const supabase = await createClient()
    let query = supabase
      .from('employees')
      .select('*')
      .order('display_order', { ascending: true })
    if (!includeInactive) query = query.eq('active', true)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ employees: (data ?? []) as Employee[] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '직원 조회 실패' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.name) {
      return NextResponse.json({ error: 'name 은 필수' }, { status: 400 })
    }
    const supabase = await createClient()

    // display_order 자동 계산 (가장 마지막)
    let nextOrder = 0
    if (body.display_order === undefined) {
      const { data: last } = await supabase
        .from('employees')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      nextOrder = (last?.display_order ?? 0) + 1
    }

    const { data, error } = await supabase
      .from('employees')
      .insert({
        name: body.name,
        role_label: body.role_label ?? null,
        department: body.department ?? null,
        business_track: body.business_track ?? 'both',
        color: body.color ?? '#76b900',
        avatar_emoji: body.avatar_emoji ?? null,
        is_leader: body.is_leader ?? false,
        active: body.active ?? true,
        display_order: body.display_order ?? nextOrder,
        profile_id: body.profile_id ?? null,
        notes: body.notes ?? null,
      })
      .select('*')
      .single<Employee>()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ employee: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '직원 등록 실패' },
      { status: 500 },
    )
  }
}
