/**
 * PATCH  /api/cycle/employees/[id]  — 수정
 * DELETE /api/cycle/employees/[id]  — 비활성화 (?hard=true 면 영구 삭제)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

const EDITABLE_FIELDS = [
  'name',
  'role_label',
  'department',
  'business_track',
  'color',
  'avatar_emoji',
  'is_leader',
  'active',
  'display_order',
  'profile_id',
  'notes',
] as const

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const body = await request.json()
    const patch: Record<string, unknown> = {}
    for (const k of EDITABLE_FIELDS) {
      if (body[k] !== undefined) patch[k] = body[k]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: '수정할 내용 없음' }, { status: 400 })
    }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('employees')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ employee: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '수정 실패' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const hard = searchParams.get('hard') === 'true'
  try {
    const supabase = await createClient()
    if (hard) {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase
        .from('employees')
        .update({ active: false })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '삭제 실패' },
      { status: 500 },
    )
  }
}
