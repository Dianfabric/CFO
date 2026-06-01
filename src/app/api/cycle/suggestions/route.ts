/**
 * GET  /api/cycle/suggestions?cycle_id=&status=open|resolved|all&week_number=
 * POST /api/cycle/suggestions   {cycle_id, employee_id, week_number_created, title}
 * PATCH /api/cycle/suggestions  {id, status?, resolved_note?, resolved_by?}
 *
 * 건의사항 CRUD — 직원이 주별 카드에서 작성, 미니 헤더에서 체크.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ANON_UUID = '00000000-0000-0000-0000-000000000000'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const cycleId = searchParams.get('cycle_id')
    const status = searchParams.get('status') ?? 'open'
    const weekNumber = searchParams.get('week_number')

    let query = supabase
      .from('cycle_suggestions')
      .select('*, employees:employees!employee_id(id, name, color, role_label)')
      .order('created_at', { ascending: false })

    if (cycleId) query = query.eq('cycle_id', Number(cycleId))
    if (status !== 'all') query = query.eq('status', status)
    if (weekNumber) query = query.eq('week_number_created', Number(weekNumber))

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ suggestions: data ?? [] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '조회 실패' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const {
      cycle_id,
      employee_id,
      week_number_created,
      title,
    } = body as {
      cycle_id?: number
      employee_id?: string | null
      week_number_created?: number
      title?: string
    }

    if (!cycle_id || !week_number_created || !title?.trim()) {
      return NextResponse.json(
        { error: 'cycle_id, week_number_created, title 필수' },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('cycle_suggestions')
      .insert({
        cycle_id,
        employee_id: employee_id ?? null,
        week_number_created,
        title: title.trim(),
        status: 'open',
      })
      .select('*, employees:employees!employee_id(id, name, color, role_label)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ suggestion: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '등록 실패' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id, status, resolved_note, resolved_by, title } = body as {
      id?: number
      status?: 'open' | 'resolved'
      resolved_note?: string | null
      resolved_by?: string | null
      title?: string
    }
    if (!id) {
      return NextResponse.json({ error: 'id 필수' }, { status: 400 })
    }
    const patch: Record<string, unknown> = {}
    if (status !== undefined) {
      patch.status = status
      if (status === 'resolved') {
        patch.resolved_at = new Date().toISOString()
        if (resolved_by !== undefined) patch.resolved_by = resolved_by || null
      } else {
        patch.resolved_at = null
        patch.resolved_by = null
      }
    }
    if (resolved_note !== undefined) patch.resolved_note = resolved_note || null
    if (title !== undefined) patch.title = title.trim()

    const { data, error } = await supabase
      .from('cycle_suggestions')
      .update(patch)
      .eq('id', id)
      .select('*, employees:employees!employee_id(id, name, color, role_label)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ suggestion: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '업데이트 실패' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

    const { error } = await supabase
      .from('cycle_suggestions')
      .delete()
      .eq('id', Number(id))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '삭제 실패' },
      { status: 500 },
    )
  }
}
