/**
 * GET  /api/documents/storage  — 서류 목록 (검색·필터)
 * POST /api/documents/storage  — 신규 메타데이터 등록 (클라이언트가 Drive 업로드 완료 후)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  DocumentFileCategory,
  DocumentFile,
} from '@/lib/document-storage'

// ============================================================
// GET — 목록·검색·필터
// query params:
//   q          — 파일명/태그 검색
//   category   — 카테고리 필터 (contract|business_reg|...|other)
//   client_id  — 거래처 필터 (UUID)
//   limit      — 기본 50
// ============================================================
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const category = searchParams.get('category') as DocumentFileCategory | null
  const clientId = searchParams.get('client_id')
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500)

  try {
    const supabase = await createClient()
    let query = supabase
      .from('document_files')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (category) query = query.eq('category', category)
    if (clientId) query = query.eq('client_id', clientId)
    if (q) {
      // filename/설명(notes) 부분일치 OR tags 배열 매칭 (콤마·괄호 escape)
      const safe = q.replace(/[,(){}]/g, ' ').trim()
      if (safe) {
        query = query.or(`filename.ilike.%${safe}%,notes.ilike.%${safe}%,tags.cs.{${safe}}`)
      }
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ files: data ?? [] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '서류 조회 실패' },
      { status: 500 },
    )
  }
}

// ============================================================
// POST — 메타데이터 등록 (Drive 업로드는 클라이언트가 처리)
// body: {
//   drive_file_id: string
//   drive_folder_id?: string
//   drive_view_url?: string
//   drive_download_url?: string
//   drive_thumbnail_url?: string
//   filename: string
//   mime_type?: string
//   size_bytes?: number
//   category: DocumentFileCategory
//   tags?: string[]
//   client_id?: string | null
//   notes?: string
//   issued_date?: string  // YYYY-MM-DD
//   expires_date?: string
// }
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.drive_file_id || !body.filename || !body.category) {
      return NextResponse.json(
        { error: 'drive_file_id, filename, category 는 필수' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('document_files')
      .insert({
        drive_file_id: body.drive_file_id,
        drive_folder_id: body.drive_folder_id ?? null,
        drive_view_url: body.drive_view_url ?? null,
        drive_download_url: body.drive_download_url ?? null,
        drive_thumbnail_url: body.drive_thumbnail_url ?? null,
        filename: body.filename,
        mime_type: body.mime_type ?? null,
        size_bytes: body.size_bytes ?? null,
        category: body.category,
        tags: body.tags ?? [],
        client_id: body.client_id ?? null,
        notes: body.notes ?? null,
        issued_date: body.issued_date ?? null,
        expires_date: body.expires_date ?? null,
      })
      .select('*')
      .single<DocumentFile>()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ file: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '서류 등록 실패' },
      { status: 500 },
    )
  }
}
