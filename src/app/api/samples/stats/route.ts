import { NextResponse } from 'next/server'
import { rentalDb, todayISO } from '@/lib/rental/db'

export const dynamic = 'force-dynamic'

// GET /api/samples/stats — 상단 요약 타일
export async function GET() {
  try {
    const db = rentalDb()
    const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
      const { count: c, error } = await q
      if (error) throw new Error(error.message)
      return c ?? 0
    }
    const [total, rented, overdue, dueToday] = await Promise.all([
      count(db.from('sample_books').select('*', { count: 'exact', head: true })),
      count(db.from('rentals').select('*', { count: 'exact', head: true }).is('returned_at', null)),
      count(db.from('rentals').select('*', { count: 'exact', head: true }).is('returned_at', null).lt('due_at', todayISO())),
      count(db.from('rentals').select('*', { count: 'exact', head: true }).is('returned_at', null).eq('due_at', todayISO())),
    ])
    return NextResponse.json({ total, rented, overdue, dueToday })
  } catch (e) {
    console.error('samples/stats', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
