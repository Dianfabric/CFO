import { NextRequest, NextResponse } from 'next/server'
import { rentalDb } from '@/lib/rental/db'

export const dynamic = 'force-dynamic'

// GET /api/samples/books — book_status 뷰 조회
//   ?q=검색어(코드/첫원단명/브랜드) &status=대여가능|대여중|연체중 &odMin=연체N일이상
//   &limit=&offset=  (기본 60)
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const q = (sp.get('q') || '').trim()
    const status = sp.get('status') || ''
    const odMin = Number(sp.get('odMin') || 0)
    const limit = Math.min(Number(sp.get('limit') || 60), 500)
    const offset = Number(sp.get('offset') || 0)

    const db = rentalDb()
    let query = db.from('book_status').select('*', { count: 'exact' })
    if (q) query = query.or(`code.ilike.%${q}%,first_fabric.ilike.%${q}%,brand.ilike.%${q}%`)
    if (status) query = query.eq('status', status)
    if (odMin > 0) query = query.gte('overdue_days', odMin)
    // 정렬: 연체중(연체 오래된 순) → 대여중 → 대여가능
    query = status === '연체중'
      ? query.order('overdue_days', { ascending: false }).order('code')
      : query
          .order('overdue_days', { ascending: false })
          .order('active_rental_id', { ascending: true, nullsFirst: false })
          .order('code', { ascending: true })
    const { data, count, error } = await query.range(offset, offset + limit - 1)
    if (error) throw new Error(error.message)
    return NextResponse.json({ books: data, total: count })
  } catch (e) {
    console.error('samples/books GET', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/samples/books — 샘플북 신규 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, brand, book_type, first_fabric, manager, note } = body
    if (!code?.trim()) return NextResponse.json({ error: '샘플북 이름은 필수입니다' }, { status: 400 })

    const db = rentalDb()
    const { data: dup } = await db.from('sample_books').select('id').eq('code', code.trim()).maybeSingle()
    if (dup) return NextResponse.json({ error: `이미 등록된 샘플북입니다: ${code}` }, { status: 409 })

    const { data, error } = await db.from('sample_books').insert({
      airtable_id: `app:${code.trim()}`, // 앱 생성분 구분용 (unique 제약 충족)
      code: code.trim(),
      brand: brand || null,
      book_type: book_type || null,
      first_fabric: first_fabric || null,
      manager: manager || null,
      note: note || null,
    }).select().single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ book: data })
  } catch (e) {
    console.error('samples/books POST', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
