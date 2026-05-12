/**
 * PATCH /api/documents/storage/[id]  — 메타데이터 수정 (카테고리·태그·메모 등)
 * DELETE /api/documents/storage/[id] — 메타데이터 삭제 (Drive 파일은 클라이언트가 별도 삭제)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const body = await request.json()
    const patch: Record<string, unknown> = {}

    if (body.filename !== undefined) patch.filename = body.filename
    if (body.category !== undefined) patch.category = body.category
    if (body.tags !== undefined) patch.tags = body.tags
    if (body.client_id !== undefined) patch.client_id = body.client_id
    if (body.notes !== undefined) patch.notes = body.notes
    if (body.issued_date !== undefined) patch.issued_date = body.issued_date
    if (body.expires_date !== undefined) patch.expires_date = body.expires_date

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: '수정할 내용 없음' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('document_files')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ file: data })
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
    const { error } = await supabase.from('document_files').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '삭제 실패' },
      { status: 500 },
    )
  }
}
