/**
 * PATCH  /api/cycle/todos/[id]
 * DELETE /api/cycle/todos/[id]
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

const EDITABLE = [
  'weekly_target_id',
  'date',
  'title',
  'description',
  'status',
  'is_shared',
  'collaborator_ids',
  'priority',
  'order_in_day',
  'blocker_note',
] as const

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const body = await request.json()
    const patch: Record<string, unknown> = {}
    for (const k of EDITABLE) {
      if (body[k] !== undefined) patch[k] = body[k]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: '수정할 내용 없음' }, { status: 400 })
    }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('daily_todos')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ todo: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '수정 실패' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('daily_todos').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '삭제 실패' },
      { status: 500 },
    )
  }
}
