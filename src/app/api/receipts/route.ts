/**
 * 간이영수증 대장 API.
 *
 * POST  multipart(image?, receipt_date, vendor, item, amount, cost_type, memo?)
 *       → Storage 업로드(비공개 버킷) + 행 등록
 * GET   ?year=2026&q=2 → 분기 목록 + 서명 URL(1h) + 합계
 * DELETE ?id=N → 행 + 사진 삭제
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TABLE_HINT =
  '영수증 테이블이 없습니다 — supabase/migrations/2026-07-03_simple_receipts.sql 을 실행해 주세요.'

function tableMissing(msg: string): boolean {
  return /find the table|does not exist/i.test(msg)
}

export async function POST(req: NextRequest) {
  try {
    const sb = createServiceClient()
    const form = await req.formData()
    const receipt_date = String(form.get('receipt_date') ?? '').trim()
    const vendor = String(form.get('vendor') ?? '').trim()
    const item = String(form.get('item') ?? '').trim()
    const amount = Math.round(Number(form.get('amount') ?? 0))
    const cost_type = String(form.get('cost_type') ?? 'variable') === 'fixed' ? 'fixed' : 'variable'
    const memo = String(form.get('memo') ?? '').trim() || null
    if (!receipt_date || !vendor || !item || !(amount > 0)) {
      return NextResponse.json({ ok: false, error: '날짜·상호·항목·금액을 입력하세요.' }, { status: 400 })
    }

    // 사진 업로드 (선택)
    let image_path: string | null = null
    const file = form.get('image') as File | null
    if (file && file.size > 0) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      image_path = `${receipt_date.slice(0, 4)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await sb.storage
        .from('receipts')
        .upload(image_path, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type || 'image/jpeg',
        })
      if (upErr) return NextResponse.json({ ok: false, error: `사진 업로드 실패: ${upErr.message}` }, { status: 500 })
    }

    const { data, error } = await sb
      .from('simple_receipts')
      .insert({ receipt_date, vendor, item, amount, cost_type, memo, image_path })
      .select('id')
      .single()
    if (error) {
      return NextResponse.json(
        { ok: false, error: tableMissing(error.message) ? TABLE_HINT : error.message },
        { status: 400 },
      )
    }
    return NextResponse.json({ ok: true, id: (data as { id: number }).id, image_path })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : '등록 실패' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const sb = createServiceClient()
    const now = new Date()
    const year = Number(req.nextUrl.searchParams.get('year')) || now.getFullYear()
    const q = Number(req.nextUrl.searchParams.get('q')) || Math.floor(now.getMonth() / 3) + 1
    const start = `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`
    const endDate = new Date(year, (q - 1) * 3 + 3, 0)
    const end = endDate.toLocaleDateString('sv-SE')

    const { data, error } = await sb
      .from('simple_receipts')
      .select('*')
      .gte('receipt_date', start)
      .lte('receipt_date', end)
      .order('receipt_date', { ascending: false })
      .order('id', { ascending: false })
    if (error) {
      return NextResponse.json({
        receipts: [], total: 0, year, q,
        tableMissing: tableMissing(error.message),
        error: tableMissing(error.message) ? TABLE_HINT : error.message,
      })
    }
    // 서명 URL (1시간)
    const receipts = await Promise.all(
      (data ?? []).map(async (r) => {
        let imageUrl: string | null = null
        if (r.image_path) {
          const { data: signed } = await sb.storage
            .from('receipts')
            .createSignedUrl(r.image_path as string, 3600)
          imageUrl = signed?.signedUrl ?? null
        }
        return { ...r, imageUrl }
      }),
    )
    return NextResponse.json({
      receipts,
      total: receipts.reduce((s, r) => s + (r.amount as number), 0),
      year, q,
    })
  } catch (e) {
    return NextResponse.json({
      receipts: [], total: 0,
      error: e instanceof Error ? e.message : '조회 실패',
    })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sb = createServiceClient()
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 })
    const { data: row } = await sb
      .from('simple_receipts')
      .select('image_path')
      .eq('id', id)
      .maybeSingle()
    const { error } = await sb.from('simple_receipts').delete().eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (row?.image_path) {
      await sb.storage.from('receipts').remove([row.image_path as string])
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : '삭제 실패' },
      { status: 500 },
    )
  }
}
