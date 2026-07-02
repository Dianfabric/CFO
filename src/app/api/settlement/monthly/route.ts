/**
 * GET /api/settlement/monthly
 *
 * 디안 본체(Prisma 일계표 거래) 매출 시계열 — 통합 경영지표용.
 * 최근 12개월 월별 + 오늘/이번주/이번달/올해 합계 (KST, 잔액보정 제외).
 * 주의: 색동 오프라인 매출도 일계표에 포함되어 있음 (통합 합산 시 색동
 * 온라인만 더할 것 — 이중계상 방지).
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EXCLUDE_BALANCE_CORRECTION } from '@/lib/sales-filter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function kstYmd(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

export async function GET() {
  try {
    const now = new Date()
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    const txs = await prisma.transaction.findMany({
      where: {
        type: 'SALE',
        date: { gte: rangeStart },
        AND: [EXCLUDE_BALANCE_CORRECTION],
      },
      select: { date: true, totalAmount: true },
    })

    const todayStr = kstYmd(now)
    const thisYear = todayStr.slice(0, 4)
    const monthStart = todayStr.slice(0, 7) + '-01'
    // 이번 주 월요일 (KST)
    const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const dow = kstNow.getDay()
    const monday = new Date(kstNow)
    monday.setDate(kstNow.getDate() - (dow === 0 ? 6 : dow - 1))
    const mondayStr = kstYmd(monday)

    const byMonth = new Map<string, number>()
    let today = 0, thisWeek = 0, thisMonth = 0, thisYearTotal = 0
    for (const t of txs) {
      const day = kstYmd(t.date)
      const mo = day.slice(0, 7)
      byMonth.set(mo, (byMonth.get(mo) ?? 0) + t.totalAmount)
      if (day === todayStr) today += t.totalAmount
      if (day >= mondayStr) thisWeek += t.totalAmount
      if (day >= monthStart) thisMonth += t.totalAmount
      if (day.slice(0, 4) === thisYear) thisYearTotal += t.totalAmount
    }

    const monthly: { month: string; revenue: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = kstYmd(d).slice(0, 7)
      monthly.push({ month: key, revenue: byMonth.get(key) ?? 0 })
    }

    return NextResponse.json({
      monthly,
      today,
      thisWeek,
      thisMonth,
      thisYear: thisYearTotal,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({
      monthly: [],
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      thisYear: 0,
      fetchedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : '디안 본체 매출 조회 실패',
    })
  }
}
