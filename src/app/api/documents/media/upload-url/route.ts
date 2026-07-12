/**
 * GET /api/documents/media/upload-url?name=파일명
 *
 * 자료 보관함 업로드용 Supabase Storage 서명 URL 발급.
 * (구 Google Drive OAuth 업로드가 GIS 스크립트·토큰 의존으로 자주 깨져 대체 — 2026-07-10)
 * 클라이언트가 서명 URL로 직접 업로드 → Vercel 요청 한도(4.5MB) 무관, 파일당 50MB(플랜 한도).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BUCKET = 'media-library'

export async function GET(request: NextRequest) {
  try {
    // Supabase Storage 키는 한글 등 비ASCII 불가 — 영숫자·점·하이픈만 남김 (원래 파일명은 메타에 보존)
    const raw = request.nextUrl.searchParams.get('name') ?? 'file'
    const ext = raw.includes('.') ? raw.slice(raw.lastIndexOf('.')).replace(/[^\w.]/g, '') : ''
    const base = raw.slice(0, raw.lastIndexOf('.') > 0 ? raw.lastIndexOf('.') : undefined)
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 60)
    const name = `${base || 'file'}${ext}`
    const ym = new Date().toISOString().slice(0, 7)
    const path = `${ym}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`

    const supabase = createServiceClient()
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      return NextResponse.json({ error: `업로드 URL 발급 실패: ${error?.message ?? ''}` }, { status: 500 })
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ path: data.path, token: data.token, publicUrl: pub.publicUrl })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '발급 실패' }, { status: 500 })
  }
}
