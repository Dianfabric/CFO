import { NextRequest, NextResponse } from 'next/server'
import { rentalDb, todayISO } from '@/lib/rental/db'

export const dynamic = 'force-dynamic'

// POST /api/samples/rentals/return — 선택 반납
//   body: { rentalIds: string[] }
export async function POST(request: NextRequest) {
  try {
    const { rentalIds } = await request.json()
    if (!Array.isArray(rentalIds) || !rentalIds.length) {
      return NextResponse.json({ error: '반납할 대여 건을 선택해주세요' }, { status: 400 })
    }
    const db = rentalDb()
    const { data, error } = await db.from('rentals')
      .update({ returned_at: todayISO() })
      .in('id', rentalIds).is('returned_at', null)
      .select('id, book_code')
    if (error) throw new Error(error.message)
    return NextResponse.json({ returned: data?.length || 0, books: data?.map((r) => r.book_code) })
  } catch (e) {
    console.error('samples/rentals/return', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
