import { NextRequest, NextResponse } from 'next/server'
import { rentalDb } from '@/lib/rental/db'

export const dynamic = 'force-dynamic'

// GET /api/samples/clients/:id — 거래처 상세 (정보 + 대여중 + 이력 + 문자이력)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = rentalDb()

    const [{ data: client, error: cErr }, { data: activeBooks, error: bErr }, { data: history, error: hErr }, { data: sms }] =
      await Promise.all([
        db.from('clients').select('*').eq('id', id).single(),
        db.from('book_status').select('*').eq('active_client_id', id).order('active_due_at'),
        db.from('rentals').select('*').eq('client_id', id).order('rented_at', { ascending: false }).limit(100),
        db.from('sms_logs').select('*').eq('client_id', id).order('sent_at', { ascending: false }).limit(30),
      ])
    if (cErr || !client) return NextResponse.json({ error: '거래처를 찾을 수 없습니다' }, { status: 404 })
    if (bErr) throw new Error(bErr.message)
    if (hErr) throw new Error(hErr.message)

    return NextResponse.json({ client, activeBooks: activeBooks || [], history: history || [], sms: sms || [] })
  } catch (e) {
    console.error('samples/clients/:id GET', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH /api/samples/clients/:id — 거래처 수정
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const allowed = ['name', 'phone', 'email', 'job_types', 'note'] as const
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) if (k in body) patch[k] = body[k]

    const db = rentalDb()
    const { data, error } = await db.from('clients').update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ client: data })
  } catch (e) {
    console.error('samples/clients/:id PATCH', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
