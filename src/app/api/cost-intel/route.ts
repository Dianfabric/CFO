/**
 * GET /api/cost-intel?month=2026-05
 *
 * 비용 인텔리전스 (관리회계 원장 기반):
 * - 고정/변동 × 재량/비재량 매트릭스 — 어디서 아낄 수 있는지
 * - 재량 지출 상위 카테고리 (절감 풀)
 * - 구독료 트래커: 구독 항목별 월 추이·증감 — 해지·절감 후보
 * 회사 비용만 집계 (개인사용·매입·매출입금·내부이체 제외).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EXCLUDE_CATEGORIES = new Set([
  '매입(국내)', '매입(해외)', '매출자료', '개인송금', '내부이체', '법인송금', '분류보류',
])

interface Row {
  source: string
  entry_date: string
  month_key: string
  vendor: string
  amount: number
  flow: string
  category: string | null
  cost_type: string | null
  discretionary: string | null
}

function isCompanyExpense(r: Row): boolean {
  if (r.source === 'personal') return false
  if (r.flow !== 'out' && r.source === 'bank') return false
  if (r.category && EXCLUDE_CATEGORIES.has(r.category)) return false
  return true
}

export async function GET(req: NextRequest) {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('mgmt_ledger')
      .select('source, entry_date, month_key, vendor, amount, flow, category, cost_type, discretionary')
      .order('entry_date', { ascending: false })
      .limit(8000)
    if (error) {
      const missing = /find the table|does not exist/i.test(error.message)
      return NextResponse.json({
        months: [], tableMissing: missing,
        error: missing
          ? '관리회계 원장이 비어있습니다 — SQL 실행 후 관리회계 파일을 업로드하세요.'
          : error.message,
      })
    }
    const rows = (data ?? []) as Row[]
    const months = [...new Set(rows.map((r) => r.month_key))].sort().reverse()
    const month = req.nextUrl.searchParams.get('month') || months[0] || ''

    const cur = rows.filter((r) => r.month_key === month && isCompanyExpense(r))

    // 고정/변동 × 재량/비재량 매트릭스
    const quad = { fixed_nondisc: 0, fixed_disc: 0, var_nondisc: 0, var_disc: 0, unclassified: 0 }
    for (const r of cur) {
      const fixed = r.cost_type === '고정'
      const variable = r.cost_type === '변동'
      const disc = r.discretionary === '재량'
      const nondisc = r.discretionary === '비재량'
      if (fixed && nondisc) quad.fixed_nondisc += r.amount
      else if (fixed && disc) quad.fixed_disc += r.amount
      else if (variable && nondisc) quad.var_nondisc += r.amount
      else if (variable && disc) quad.var_disc += r.amount
      else quad.unclassified += r.amount
    }

    // 재량 지출 상위 카테고리 (절감 풀)
    const discByCat = new Map<string, number>()
    for (const r of cur) {
      if (r.discretionary !== '재량') continue
      const k = r.category ?? '기타'
      discByCat.set(k, (discByCat.get(k) ?? 0) + r.amount)
    }
    const discTop = [...discByCat.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)

    // 구독료 트래커 — 카테고리에 '구독' 포함, 항목(가맹점)별 월 추이
    const recent6 = months.slice(0, 6).reverse() // 오래된 → 최신
    const subRows = rows.filter(
      (r) => isCompanyExpense(r) && (r.category ?? '').includes('구독'),
    )
    const subMap = new Map<string, Map<string, number>>() // vendor → month → amount
    for (const r of subRows) {
      const v = r.vendor.replace(/\s+/g, ' ').trim()
      if (!subMap.has(v)) subMap.set(v, new Map())
      const mm = subMap.get(v)!
      mm.set(r.month_key, (mm.get(r.month_key) ?? 0) + r.amount)
    }
    const prevMonth = months[months.indexOf(month) + 1] ?? null
    const subs = [...subMap.entries()]
      .map(([vendor, mm]) => {
        const curAmt = mm.get(month) ?? 0
        const prevAmt = prevMonth ? (mm.get(prevMonth) ?? 0) : 0
        return {
          vendor,
          current: curAmt,
          previous: prevAmt,
          delta: curAmt - prevAmt,
          series: recent6.map((m) => mm.get(m) ?? 0),
        }
      })
      .filter((s) => s.current > 0 || s.previous > 0)
      .sort((a, b) => b.current - a.current)
    const subTotal = subs.reduce((s, x) => s + x.current, 0)
    const subPrevTotal = subs.reduce((s, x) => s + x.previous, 0)

    return NextResponse.json({
      months,
      month,
      quad,
      total: quad.fixed_nondisc + quad.fixed_disc + quad.var_nondisc + quad.var_disc + quad.unclassified,
      discTop,
      subs: subs.slice(0, 20),
      subTotal,
      subPrevTotal,
      subMonths: recent6,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({
      months: [],
      error: e instanceof Error ? e.message : '비용 인텔리전스 조회 실패',
    })
  }
}
