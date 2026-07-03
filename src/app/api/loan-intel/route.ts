/**
 * GET /api/loan-intel?year=2025&entity=dian
 *
 * 대출·이자 현황 + 크로스체크:
 * - 은행별 연간 이자·원금 합계, 확인필요(OCR) 건수
 * - 월별 이자 시계열 (영업외비용 → 세전이익 정확도)
 * - 크로스체크: 관리회계 원장(이자·원리금 카테고리) 월별 합계와 비교
 *   → 차이 나는 달 = 통장 매칭 안 됨 (개인통장 납부 등) 경고
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sb = createServiceClient()
    const entity = req.nextUrl.searchParams.get('entity') === 'naid' ? 'naid' : 'dian'

    const { data: all, error } = await sb
      .from('loan_payments')
      .select('lender, pay_date, month_key, principal, interest, needs_review')
      .eq('entity', entity)
      .order('pay_date', { ascending: true })
      .limit(5000)
    if (error) {
      const missing = /find the table|does not exist/i.test(error.message)
      return NextResponse.json({
        years: [], tableMissing: missing,
        error: missing
          ? '대출 원장이 비어있습니다 — SQL 실행 후 대출 상환내역 파일을 업로드하세요.'
          : error.message,
      })
    }
    const rows = all ?? []
    const years = [...new Set(rows.map((r) => (r.month_key as string).slice(0, 4)))].sort().reverse()
    const year = req.nextUrl.searchParams.get('year') || years[0] || ''
    const cur = rows.filter((r) => (r.month_key as string).startsWith(year))

    // 은행별 집계
    const byLender = new Map<string, { interest: number; principal: number; review: number; last: string }>()
    for (const r of cur) {
      const c = byLender.get(r.lender as string) ?? { interest: 0, principal: 0, review: 0, last: '' }
      c.interest += r.interest as number
      c.principal += r.principal as number
      if (r.needs_review) c.review += 1
      if ((r.pay_date as string) > c.last) c.last = r.pay_date as string
      byLender.set(r.lender as string, c)
    }
    const lenders = [...byLender.entries()]
      .map(([lender, v]) => ({ lender, ...v }))
      .sort((a, b) => b.interest - a.interest)

    // 월별 이자 시계열
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
    const monthlyInterest = months.map((m) =>
      cur.filter((r) => r.month_key === m).reduce((s, r) => s + (r.interest as number), 0),
    )
    const monthlyPrincipal = months.map((m) =>
      cur.filter((r) => r.month_key === m).reduce((s, r) => s + (r.principal as number), 0),
    )

    // 크로스체크 — 관리회계 원장의 이자·원리금 지출과 비교 (테이블 없으면 생략)
    let crosscheck: { month: string; loan: number; ledger: number; diff: number }[] = []
    let ledgerAvailable = false
    const { data: ledger, error: ledErr } = await sb
      .from('mgmt_ledger')
      .select('month_key, amount, category, flow, source')
      .like('month_key', `${year}-%`)
      .limit(8000)
    if (!ledErr && ledger) {
      ledgerAvailable = true
      const ledgerByMonth = new Map<string, number>()
      for (const l of ledger) {
        if (l.source === 'personal' || l.flow !== 'out') continue
        const cat = String(l.category ?? '')
        if (!/이자|원리금|원금상환|대출/.test(cat)) continue
        ledgerByMonth.set(l.month_key as string, (ledgerByMonth.get(l.month_key as string) ?? 0) + (l.amount as number))
      }
      crosscheck = months
        .map((m, i) => {
          const loan = monthlyInterest[i] + monthlyPrincipal[i]
          const led = ledgerByMonth.get(m) ?? 0
          return { month: m, loan, ledger: led, diff: loan - led }
        })
        .filter((c) => c.loan > 0 || c.ledger > 0)
    }

    return NextResponse.json({
      years, year, entity,
      totalInterest: cur.reduce((s, r) => s + (r.interest as number), 0),
      totalPrincipal: cur.reduce((s, r) => s + (r.principal as number), 0),
      needsReview: cur.filter((r) => r.needs_review).length,
      lenders,
      months, monthlyInterest, monthlyPrincipal,
      crosscheck, ledgerAvailable,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({
      years: [],
      error: e instanceof Error ? e.message : '대출 현황 조회 실패',
    })
  }
}
