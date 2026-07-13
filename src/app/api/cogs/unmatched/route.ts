/**
 * GET /api/cogs/unmatched?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * 원가 매칭 점검 — 기간 내 판매 중 TMS 단가표·수기 원가 모두로 원가가 안 잡히는 품목 목록.
 * body-cogs 의 computeSoldCogsByDate 를 그대로 재사용 → 손익 계산과 동일한 매칭 기준.
 */
import { NextRequest, NextResponse } from 'next/server'
import { computeSoldCogsByDate } from '@/lib/body-cogs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const startStr = sp.get('start')
    const endStr = sp.get('end')
    if (!startStr || !endStr) {
      return NextResponse.json({ error: 'start·end 필요' }, { status: 400 })
    }
    const start = new Date(startStr + 'T00:00:00')
    const end = new Date(endStr + 'T23:59:59.999')
    const sold = await computeSoldCogsByDate(start, end)

    return NextResponse.json({
      start: startStr,
      end: endStr,
      coveragePct: Math.round(sold.coveragePct * 10) / 10,
      matchedRev: sold.matchedRev,
      unmatchedRev: sold.unmatchedRev,
      soldCogs: sold.soldCogs,
      usdRate: sold.usdRate,
      unmatchedCount: sold.unmatchedItems.length,
      unmatchedItems: sold.unmatchedItems, // [{ name, qty, amount, txIds, lastDate }]
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '점검 실패' }, { status: 500 })
  }
}
