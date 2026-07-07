import { NextRequest, NextResponse } from 'next/server'
import { rentalDb } from '@/lib/rental/db'

export const dynamic = 'force-dynamic'

// GET /api/samples/clients — 거래처 목록
//   ?q=이름/전화 검색 &renting=1 대여중인 거래처만(반납 탭) &limit=&offset=
//   각 거래처에 activeCount / overdueCount 포함
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const q = (sp.get('q') || '').trim()
    const renting = sp.get('renting') === '1'
    const limit = Math.min(Number(sp.get('limit') || 100), 800)
    const offset = Number(sp.get('offset') || 0)

    const db = rentalDb()

    // 대여중 집계 (활성 rental 전체 — 최대 수백 건이라 한 번에)
    const { data: active, error: aErr } = await db.from('book_status')
      .select('active_client_id, status')
      .not('active_rental_id', 'is', null)
    if (aErr) throw new Error(aErr.message)
    const agg = new Map<string, { active: number; overdue: number }>()
    for (const r of active || []) {
      if (!r.active_client_id) continue
      const cur = agg.get(r.active_client_id) || { active: 0, overdue: 0 }
      cur.active++
      if (r.status === '연체중') cur.overdue++
      agg.set(r.active_client_id, cur)
    }

    if (renting) {
      const ids = [...agg.keys()]
      if (!ids.length) return NextResponse.json({ clients: [], total: 0 })
      let query = db.from('clients').select('*', { count: 'exact' }).in('id', ids)
      if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      const { data, count, error } = await query.order('name')
      if (error) throw new Error(error.message)
      const clients = (data || [])
        .map((c) => ({ ...c, ...agg.get(c.id) }))
        .sort((a, b) => (b.overdue || 0) - (a.overdue || 0) || (b.active || 0) - (a.active || 0))
      return NextResponse.json({ clients, total: count })
    }

    let query = db.from('clients').select('*', { count: 'exact' })
    if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    const { data, count, error } = await query.order('name').range(offset, offset + limit - 1)
    if (error) throw new Error(error.message)
    const clients = (data || []).map((c) => ({ ...c, ...(agg.get(c.id) || { active: 0, overdue: 0 }) }))
    return NextResponse.json({ clients, total: count })
  } catch (e) {
    console.error('samples/clients GET', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/samples/clients — 거래처 신규 등록
export async function POST(request: NextRequest) {
  try {
    const { name, phone, email, job_types, note } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: '거래처 이름은 필수입니다' }, { status: 400 })

    const db = rentalDb()
    const { data, error } = await db.from('clients').insert({
      airtable_id: `app:${name.trim()}:${Date.now()}`,
      name: name.trim(),
      phone: phone || null,
      email: email || null,
      job_types: Array.isArray(job_types) ? job_types : [],
      note: note || null,
    }).select().single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ client: data })
  } catch (e) {
    console.error('samples/clients POST', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
