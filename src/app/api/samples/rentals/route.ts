import { NextRequest, NextResponse } from 'next/server'
import { rentalDb, todayISO, addDaysISO, RENTAL_DAYS } from '@/lib/rental/db'

export const dynamic = 'force-dynamic'

// POST /api/samples/rentals — 대여 일괄 등록
//   body: { clientId, items: [{ bookId, manager }] }
//   담당자는 필수. 이미 대여중인 북은 거부(409)하고 어떤 북인지 알려줌.
export async function POST(request: NextRequest) {
  try {
    const { clientId, items } = await request.json()
    if (!clientId || !Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: 'clientId와 items가 필요합니다' }, { status: 400 })
    }
    const noMgr = items.filter((i: { manager?: string }) => !i.manager?.trim())
    if (noMgr.length) {
      return NextResponse.json({ error: `담당자 미입력 ${noMgr.length}권 — 담당자는 필수입니다` }, { status: 400 })
    }

    const db = rentalDb()
    const bookIds = items.map((i: { bookId: string }) => i.bookId)

    // 이미 대여중인 북 확인
    const { data: conflicts, error: cfErr } = await db.from('rentals')
      .select('book_id, book_code').in('book_id', bookIds).is('returned_at', null)
    if (cfErr) throw new Error(cfErr.message)
    if (conflicts?.length) {
      return NextResponse.json({
        error: `이미 대여중인 샘플북이 있습니다: ${conflicts.map((c) => c.book_code).join(', ')}`,
        conflictBookIds: conflicts.map((c) => c.book_id),
      }, { status: 409 })
    }

    const { data: books, error: bErr } = await db.from('sample_books')
      .select('id, code, rental_count').in('id', bookIds)
    if (bErr) throw new Error(bErr.message)
    const bookMap = new Map((books || []).map((b) => [b.id, b]))
    const { data: client } = await db.from('clients').select('id, name').eq('id', clientId).single()
    if (!client) return NextResponse.json({ error: '거래처를 찾을 수 없습니다' }, { status: 404 })

    const rented = todayISO()
    const due = addDaysISO(rented, RENTAL_DAYS)
    const rows = items.map((i: { bookId: string; manager: string }) => ({
      book_id: i.bookId,
      client_id: clientId,
      book_code: bookMap.get(i.bookId)?.code || null,
      client_name: client.name,
      rented_at: rented,
      due_at: due,
      manager: i.manager.trim(),
      source: 'app',
    }))
    const { data: inserted, error: insErr } = await db.from('rentals').insert(rows).select()
    if (insErr) throw new Error(insErr.message)

    // 대여누적횟수 +1
    await Promise.all((books || []).map((b) =>
      db.from('sample_books').update({ rental_count: (b.rental_count || 0) + 1 }).eq('id', b.id)))

    return NextResponse.json({ rentals: inserted, dueAt: due })
  } catch (e) {
    console.error('samples/rentals POST', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
