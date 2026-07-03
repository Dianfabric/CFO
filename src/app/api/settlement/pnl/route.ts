/**
 * GET /api/settlement/pnl?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * 본체(일계표) 기간 손익 재료 — 경영 계기판 손익 흐름용 경량 집계.
 * - sales:      SALE 합 (잔액 보정 제외) — 결산 API 와 동일 필터
 * - fabricCogs: '원단 매입원가' PURCHASE 합 (매출원가)
 * - expenses:   EXPENSE 합 (당일 지출 — 변동비 근사)
 * - shipping:   해외운송비 월 등록액의 영업일 비례 배분 (변동비)
 * - fixed:      고정비 월 등록액의 영업일 비례 배분
 * - interest:   대출 이자 (loan_payments, 영업외비용) — 테이블 없으면 0 + 플래그
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { EXCLUDE_BALANCE_CORRECTION } from '@/lib/sales-filter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bizDaysInMonth(y: number, m0: number): number {
  const days = new Date(y, m0 + 1, 0).getDate()
  let c = 0
  for (let d = 1; d <= days; d++) {
    const dow = new Date(y, m0, d).getDay()
    if (dow !== 0 && dow !== 6) c++
  }
  return c
}

function bizDaysInRange(start: Date, end: Date): number {
  let c = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const e = new Date(end)
  e.setHours(23, 59, 59, 999)
  while (cur <= e) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) c++
    cur.setDate(cur.getDate() + 1)
  }
  return c
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const startStr = sp.get('start')
    const endStr = sp.get('end')
    if (!startStr || !endStr) {
      return NextResponse.json({ error: 'start·end 파라미터가 필요합니다.' }, { status: 400 })
    }
    const rangeStart = new Date(startStr + 'T00:00:00')
    const rangeEnd = new Date(endStr + 'T23:59:59.999')

    // 범위에 걸친 월 목록 + 월별 영업일 겹침 비율 (고정비·운송비·이자 월 단위 배분)
    const months: { ym: string; ratio: number }[] = []
    const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    const endMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)
    while (cur <= endMonth) {
      const y = cur.getFullYear()
      const m0 = cur.getMonth()
      const mStart = new Date(y, m0, 1)
      const mEnd = new Date(y, m0 + 1, 0, 23, 59, 59)
      const oStart = rangeStart > mStart ? rangeStart : mStart
      const oEnd = rangeEnd < mEnd ? rangeEnd : mEnd
      const total = bizDaysInMonth(y, m0)
      months.push({
        ym: `${y}-${String(m0 + 1).padStart(2, '0')}`,
        ratio: total > 0 ? bizDaysInRange(oStart, oEnd) / total : 0,
      })
      cur.setMonth(cur.getMonth() + 1)
    }

    const supabase = await createClient()
    const [salesAgg, fabricAgg, expenseAgg, recurring, shipCat, loanRes] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'SALE', date: { gte: rangeStart, lte: rangeEnd }, ...EXCLUDE_BALANCE_CORRECTION },
        _sum: { totalAmount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          type: 'PURCHASE',
          date: { gte: rangeStart, lte: rangeEnd },
          description: { startsWith: '원단 매입원가' },
        },
        _sum: { totalAmount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'EXPENSE', date: { gte: rangeStart, lte: rangeEnd } },
        _sum: { totalAmount: true },
      }),
      prisma.recurringCost.findMany({ include: { costCategory: true } }),
      prisma.costCategory.findFirst({ where: { name: { contains: '해외' } } }),
      supabase.from('loan_payments').select('month_key, interest'),
    ])

    const monthlyOf = (c: (typeof recurring)[number]) =>
      c.frequency === 'MONTHLY' ? c.amount
        : c.frequency === 'QUARTERLY' ? Math.round(c.amount / 3)
          : c.frequency === 'YEARLY' ? Math.round(c.amount / 12) : 0
    const monthlyFixed = recurring.reduce((s, c) => s + monthlyOf(c), 0)
    const ratioSum = months.reduce((s, m) => s + m.ratio, 0)
    const fixed = Math.round(monthlyFixed * ratioSum)

    // 고정비 카테고리 분해 (임차료·인건비 등 — 등록된 카테고리명 기준)
    const fixedByCat = new Map<string, number>()
    for (const c of recurring) {
      const label = c.costCategory?.name ?? c.description
      fixedByCat.set(label, (fixedByCat.get(label) ?? 0) + Math.round(monthlyOf(c) * ratioSum))
    }
    const fixedBreakdown = [...fixedByCat.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    let shipping = 0
    if (shipCat) {
      const recs = await Promise.all(
        months.map((m) =>
          prisma.monthlyCost
            .findUnique({
              where: { costCategoryId_yearMonth: { costCategoryId: shipCat.id, yearMonth: m.ym } },
            })
            .then((r) => ({ m, r })),
        ),
      )
      for (const { m, r } of recs) if (r && r.amount) shipping += Math.round(r.amount * m.ratio)
    }

    // 대출 이자 (영업외비용) — 월 자료를 기간 비례 배분
    let interest = 0
    const interestMissing = !!loanRes.error
    if (!loanRes.error) {
      const byMonth = new Map<string, number>()
      for (const row of loanRes.data ?? []) {
        byMonth.set(row.month_key, (byMonth.get(row.month_key) ?? 0) + (row.interest ?? 0))
      }
      for (const m of months) interest += Math.round((byMonth.get(m.ym) ?? 0) * m.ratio)
    }

    return NextResponse.json({
      start: startStr,
      end: endStr,
      sales: salesAgg._sum.totalAmount ?? 0,
      fabricCogs: fabricAgg._sum.totalAmount ?? 0,
      expenses: expenseAgg._sum.totalAmount ?? 0,
      shipping,
      fixed,
      fixedBreakdown,
      monthlyFixed,
      interest,
      interestMissing,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '손익 집계 실패' })
  }
}
