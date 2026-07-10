/**
 * GET /api/settlement/trend?unit=month|week|year
 *
 * 본체(일계표) 기간별 손익 추이 — 경영 그래프용 버킷 집계.
 * - month: 최근 12개월 · week: 최근 12주(월~일) · year: 데이터 시작 연도~올해
 * - 버킷마다: sales(잔액 보정 제외) / fabricCogs / expenses / shipping /
 *   fixed(영업일 배분) / interest(대출 이자)
 * 색동·디안몰 매출 합성은 클라이언트에서 (아임웹 공유 캐시 재사용).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { EXCLUDE_BALANCE_CORRECTION } from '@/lib/sales-filter'
import { computeSoldCogsByDate, classifyPurchase } from '@/lib/body-cogs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function ymd(d: Date): string {
  return d.toLocaleDateString('sv-SE')
}

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

/** 버킷이 걸친 월 목록 + 영업일 겹침 비율 (고정비·운송비·이자 월 단위 배분) */
function monthRatios(start: Date, end: Date): { ym: string; ratio: number }[] {
  const out: { ym: string; ratio: number }[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cur <= endMonth) {
    const y = cur.getFullYear()
    const m0 = cur.getMonth()
    const mStart = new Date(y, m0, 1)
    const mEnd = new Date(y, m0 + 1, 0, 23, 59, 59)
    const oStart = start > mStart ? start : mStart
    const oEnd = end < mEnd ? end : mEnd
    const total = bizDaysInMonth(y, m0)
    out.push({
      ym: `${y}-${String(m0 + 1).padStart(2, '0')}`,
      ratio: total > 0 ? bizDaysInRange(oStart, oEnd) / total : 0,
    })
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}

interface Bucket {
  key: string
  label: string
  start: string
  end: string
}

export async function GET(req: NextRequest) {
  try {
    const unit = (req.nextUrl.searchParams.get('unit') ?? 'month') as 'month' | 'week' | 'year'
    const now = new Date()
    now.setHours(23, 59, 59, 999)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const buckets: Bucket[] = []
    if (unit === 'week') {
      // 최근 12주 — 월요일 시작
      const dow = today.getDay()
      const thisMonday = new Date(today)
      thisMonday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
      for (let i = 11; i >= 0; i--) {
        const s = new Date(thisMonday)
        s.setDate(thisMonday.getDate() - i * 7)
        const e = new Date(s)
        e.setDate(s.getDate() + 6)
        const end = e > today ? today : e
        buckets.push({
          key: ymd(s),
          label: `${s.getMonth() + 1}/${s.getDate()}`,
          start: ymd(s),
          end: ymd(end),
        })
      }
    } else if (unit === 'year') {
      // 데이터 시작 연도 ~ 올해
      const first = await prisma.transaction.aggregate({ _min: { date: true } })
      const firstYear = first._min.date ? first._min.date.getFullYear() : today.getFullYear()
      for (let y = Math.max(firstYear, today.getFullYear() - 4); y <= today.getFullYear(); y++) {
        const s = new Date(y, 0, 1)
        const e = new Date(y, 11, 31)
        buckets.push({
          key: String(y),
          label: `${y}년`,
          start: ymd(s),
          end: ymd(e > today ? today : e),
        })
      }
    } else {
      // 최근 12개월
      for (let i = 11; i >= 0; i--) {
        const s = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const e = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)
        buckets.push({
          key: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`,
          label: `${String(s.getFullYear()).slice(2)}.${s.getMonth() + 1}`,
          start: ymd(s),
          end: ymd(e > today ? today : e),
        })
      }
    }

    const rangeStart = new Date(buckets[0].start + 'T00:00:00')
    const supabase = await createClient()
    const [txs, mgmtRes, loanRes, sold] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          date: { gte: rangeStart, lte: now },
          OR: [
            { type: { in: ['PURCHASE', 'EXPENSE'] } },
            { AND: [{ type: 'SALE' }, EXCLUDE_BALANCE_CORRECTION] },
          ],
        },
        select: {
          date: true, type: true, totalAmount: true, description: true,
          items: { select: { productName: true } },
        },
      }),
      // 고정비·변동비 = 관리회계 원장 (대표 결정 2026-07-10 — 구 RecurringCost 방식 파기)
      supabase.from('mgmt_ledger').select('month_key, cost_type, nature, amount, source').eq('flow', 'out'),
      supabase.from('loan_payments').select('month_key, interest'),
      // 판매 기준 원가 — 날짜별 (버킷 배분용)
      computeSoldCogsByDate(rangeStart, now),
    ])
    const soldDates = [...sold.byDate.entries()] // [YYYY-MM-DD, {cogs,...}]

    // 관리회계 명세(source='summary') → 월별 고정/변동 판관비 + 이자 (대표 결정 2026-07-10)
    const fixedByMonth = new Map<string, number>()
    const varByMonth = new Map<string, number>()
    const sumInterestByMonth = new Map<string, number>()
    const naidByMonth = new Map<string, number>() // 법인 비용(고정+이자) — naid 탭·통합용
    for (const r of (mgmtRes.data ?? []) as { month_key: string; cost_type: string | null; nature: string | null; amount: number; source: string }[]) {
      if (r.source !== 'summary') continue
      if (r.nature === '영업외비용') {
        sumInterestByMonth.set(r.month_key, (sumInterestByMonth.get(r.month_key) ?? 0) + r.amount)
        continue
      }
      if (r.nature === '법인') {
        naidByMonth.set(r.month_key, (naidByMonth.get(r.month_key) ?? 0) + r.amount)
        continue
      }
      if (r.nature !== '판관비') continue
      if (r.cost_type === '고정') fixedByMonth.set(r.month_key, (fixedByMonth.get(r.month_key) ?? 0) + r.amount)
      else if (r.cost_type === '변동') varByMonth.set(r.month_key, (varByMonth.get(r.month_key) ?? 0) + r.amount)
    }

    // (구) MonthlyCost '해외' 월 등록액은 운임 인보이스 거래와 이중 기록 — 제외 (인보이스가 기준)
    const bucketMonths = buckets.map((b) =>
      monthRatios(new Date(b.start + 'T00:00:00'), new Date(b.end + 'T23:59:59')),
    )
    const interestByMonth = new Map<string, number>()
    if (!loanRes.error) {
      for (const row of loanRes.data ?? []) {
        interestByMonth.set(row.month_key, (interestByMonth.get(row.month_key) ?? 0) + (row.interest ?? 0))
      }
    }

    // 거래를 버킷에 배분 — 원가 = 판매 기준(단가표) + 해외운임·관세, 국내 배송 = 변동비
    const result = buckets.map((b, bi) => {
      let sales = 0
      let fabricCogs = 0
      let expenses = 0
      let purchShipping = 0
      for (const t of txs) {
        const d = ymd(t.date)
        if (d < b.start || d > b.end) continue
        if (t.type === 'SALE') sales += t.totalAmount
        else if (t.type === 'EXPENSE') {
          // 일계표 경비는 해외운임 성격만 원가로 — 나머지는 관리회계 원장과 중복이라 제외
          const cls = classifyPurchase(t.description, t.items.map((i) => i.productName ?? ''))
          if (cls === 'cogs_freight') fabricCogs += t.totalAmount
        } else if (t.type === 'PURCHASE') {
          const cls = classifyPurchase(t.description, t.items.map((i) => i.productName ?? ''))
          if (cls === 'cogs_freight') fabricCogs += t.totalAmount
          else if (cls === 'domestic_ship') purchShipping += t.totalAmount
          // inventory(재고 취득)·legacy_auto(구 자동 원가)는 손익 사슬 제외
        }
      }
      // 판매 기준 원가 합산 (버킷 내 날짜)
      for (const [d, v] of soldDates) {
        if (d >= b.start && d <= b.end) fabricCogs += v.cogs
      }
      let fixed = 0
      let interest = 0
      let naidCost = 0
      for (const m of bucketMonths[bi]) {
        fixed += (fixedByMonth.get(m.ym) ?? 0) * m.ratio
        expenses += (varByMonth.get(m.ym) ?? 0) * m.ratio
        naidCost += (naidByMonth.get(m.ym) ?? 0) * m.ratio
        // 이자: loan_payments 가 있는 달은 그 값, 없으면 관리회계 명세의 이자
        const iv = interestByMonth.has(m.ym) ? interestByMonth.get(m.ym)! : (sumInterestByMonth.get(m.ym) ?? 0)
        interest += iv * m.ratio
      }
      expenses = Math.round(expenses)
      return {
        key: b.key,
        label: b.label,
        start: b.start,
        end: b.end,
        sales,
        fabricCogs,
        expenses,
        shipping: purchShipping, // 국내 배송 (해외운임은 fabricCogs 로)
        fixed: Math.round(fixed),
        interest: Math.round(interest),
        naidCost: Math.round(naidCost), // 법인 비용 (고정+이자)
      }
    })

    return NextResponse.json({ unit, buckets: result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '추이 집계 실패' })
  }
}
