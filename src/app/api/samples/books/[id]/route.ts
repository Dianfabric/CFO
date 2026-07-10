import { NextRequest, NextResponse } from 'next/server'
import { rentalDb } from '@/lib/rental/db'

export const dynamic = 'force-dynamic'

// GET /api/samples/books/:id — 샘플북 상세 + 대여 이력
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = rentalDb()
    const [{ data: book, error: bErr }, { data: history, error: hErr }] = await Promise.all([
      db.from('book_status').select('*').eq('id', id).single(),
      db.from('rentals').select('*').eq('book_id', id).order('rented_at', { ascending: false }).limit(50),
    ])
    if (bErr || !book) return NextResponse.json({ error: '샘플북을 찾을 수 없습니다' }, { status: 404 })
    if (hErr) throw new Error(hErr.message)
    return NextResponse.json({ book, history: history || [] })
  } catch (e) {
    console.error('samples/books/:id GET', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH /api/samples/books/:id — 샘플북 수정
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const allowed = ['code', 'brand', 'book_type', 'first_fabric', 'manager', 'note', 'barcode'] as const
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) if (k in body) patch[k] = body[k]

    const db = rentalDb()
    const { data, error } = await db.from('sample_books').update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ book: data })
  } catch (e) {
    console.error('samples/books/:id PATCH', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
