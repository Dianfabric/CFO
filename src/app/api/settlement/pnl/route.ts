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
import { computeSoldCogsByDate, classifyPurchase } from '@/lib/body-cogs'

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
    const [salesAgg, purchases, expenseRows, mgmtRes, loanRes, sold, naidInvRes] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'SALE', date: { gte: rangeStart, lte: rangeEnd }, ...EXCLUDE_BALANCE_CORRECTION },
        _sum: { totalAmount: true },
      }),
      // 매입 전체 — 운송 성격은 변동비, 나머지는 매출원가로 분류
      prisma.transaction.findMany({
        where: { type: 'PURCHASE', date: { gte: rangeStart, lte: rangeEnd } },
        select: { totalAmount: true, description: true, items: { select: { productName: true } } },
      }),
      prisma.transaction.findMany({
        where: { type: 'EXPENSE', date: { gte: rangeStart, lte: rangeEnd } },
        select: { totalAmount: true, description: true, items: { select: { productName: true } } },
      }),
      // 고정비·변동비 = 관리회계 원장 (대표 결정 2026-07-10 — 구 RecurringCost 방식 파기)
      // 명세(summary)만 조회 — 분류시트(card/bank) 행까지 가져오면 다개월 범위에서
      // Supabase 1,000행 제한에 잘려 고정비가 축소 집계됨 (2026-07-10 반기 추가 때 발견)
      supabase
        .from('mgmt_ledger')
        .select('month_key, cost_type, nature, amount, major, category, source')
        .eq('flow', 'out')
        .eq('source', 'summary')
        .in('month_key', months.map((m) => m.ym)),
      supabase.from('loan_payments').select('month_key, interest'),
      // 판매 기준 원가 — 팔린 수량 × TMS 기준단가 × 환율 (대표 결정 2026-07-06)
      computeSoldCogsByDate(rangeStart, rangeEnd),
      // 법인 매출·매입 = 세금계산서가 정본 (대표 결정 2026-07-10)
      supabase
        .from('naid_invoices')
        .select('month_key, direction, supply_amount')
        .in('month_key', months.map((m) => m.ym)),
    ])

    // 매입 분류: 해외운임·관세 → 매출원가 / 국내 배송 → 변동비 / 원단 인보이스 → 재고 취득(제외)
    let freightCogs = 0
    let purchShipping = 0
    let invPurchase = 0
    // 해외운임 세부 — 항공(로드썬) / 배(글로지텍) / 관세·수입세금 (생키 갈라짐용)
    const freightByKind = new Map<string, number>()
    const freightKind = (desc: string | null): string => {
      const d = desc ?? ''
      if (/로드썬|항공/.test(d)) return '항공운임(로드썬)'
      if (/글로지텍/.test(d)) return '배운임(글로지텍)'
      if (/관세|통관|수입세금/.test(d)) return '관세·수입세금'
      return '기타 해외운임'
    }
    const addFreight = (desc: string | null, amount: number) => {
      freightCogs += amount
      const k = freightKind(desc)
      freightByKind.set(k, (freightByKind.get(k) ?? 0) + amount)
    }
    for (const pu of purchases) {
      const cls = classifyPurchase(pu.description, pu.items.map((i) => i.productName ?? ''))
      if (cls === 'cogs_freight') addFreight(pu.description, pu.totalAmount)
      else if (cls === 'domestic_ship') purchShipping += pu.totalAmount
      else if (cls === 'inventory') invPurchase += pu.totalAmount
      // legacy_auto('원단 매입원가' 구 자동 항목)는 이중계상 방지 위해 제외
    }
    // 경비(EXPENSE)는 해외운임 성격만 매출원가로 사용 — 나머지 일계표 경비는
    // 관리회계 원장과 중복이라 손익에서 제외 (변동비의 소스는 관리회계로 일원화)
    for (const ex of expenseRows) {
      const cls = classifyPurchase(ex.description, ex.items.map((i) => i.productName ?? ''))
      if (cls === 'cogs_freight') addFreight(ex.description, ex.totalAmount)
    }
    const fabricCogs = sold.soldCogs + freightCogs
    const freightBreakdown = [...freightByKind.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    // ── 관리회계 원장 → 고정비·변동비 (월 단위, 기간 비율 배분) ──
    const mgmtMissing = !!mgmtRes.error
    const mgmtRows = (mgmtRes.data ?? []) as {
      month_key: string; cost_type: string | null; nature: string | null; amount: number
      major: string | null; category: string | null; source: string
    }[]
    // 정본 = '관리회계' 명세 시트(source='summary', 대표 결정 2026-07-10).
    // nature: 판관비(고정/변동) 사용 · 영업외비용(대출이자) → 이자 · 법인/원금상환/운임은 제외
    const fixedByMonth = new Map<string, number>()
    const varByMonth = new Map<string, number>()
    const sumInterestByMonth = new Map<string, number>()
    const naidFixedByMonth = new Map<string, number>()
    const naidInterestByMonth = new Map<string, number>()
    const fixedByCat = new Map<string, number>()
    const mgmtMonths = new Set<string>()
    for (const r of mgmtRows) {
      if (r.source !== 'summary') continue
      mgmtMonths.add(r.month_key)
      if (r.nature === '영업외비용') {
        sumInterestByMonth.set(r.month_key, (sumInterestByMonth.get(r.month_key) ?? 0) + r.amount)
        continue
      }
      // 법인(엔에이아이디) 몫 — 이자와 운영비 분리 (대표 결정 2026-07-10: 전체 지표에 반영)
      if (r.nature === '법인') {
        const isInt = (r.major ?? '').includes('금융') || (r.category ?? '').includes('대출이자')
        const map = isInt ? naidInterestByMonth : naidFixedByMonth
        map.set(r.month_key, (map.get(r.month_key) ?? 0) + r.amount)
        continue
      }
      if (r.nature !== '판관비') continue
      if (r.cost_type === '고정') {
        fixedByMonth.set(r.month_key, (fixedByMonth.get(r.month_key) ?? 0) + r.amount)
      } else if (r.cost_type === '변동') {
        varByMonth.set(r.month_key, (varByMonth.get(r.month_key) ?? 0) + r.amount)
      }
    }
    // 법인 매출·매입 (세금계산서, 공급가 기준)
    const naidSalesByMonth = new Map<string, number>()
    const naidCogsByMonth = new Map<string, number>()
    for (const r of (naidInvRes.data ?? []) as { month_key: string; direction: string; supply_amount: number }[]) {
      const map = r.direction === 'sale' ? naidSalesByMonth : naidCogsByMonth
      map.set(r.month_key, (map.get(r.month_key) ?? 0) + r.supply_amount)
    }

    let fixed = 0
    let expensesSum = 0
    let naidFixed = 0
    let naidInterest = 0
    let naidSales = 0
    let naidCogs = 0
    for (const m of months) {
      fixed += Math.round((fixedByMonth.get(m.ym) ?? 0) * m.ratio)
      expensesSum += Math.round((varByMonth.get(m.ym) ?? 0) * m.ratio)
      naidFixed += Math.round((naidFixedByMonth.get(m.ym) ?? 0) * m.ratio)
      naidInterest += Math.round((naidInterestByMonth.get(m.ym) ?? 0) * m.ratio)
      naidSales += Math.round((naidSalesByMonth.get(m.ym) ?? 0) * m.ratio)
      naidCogs += Math.round((naidCogsByMonth.get(m.ym) ?? 0) * m.ratio)
    }
    // 고정비·변동비 분해 — 관리회계 대분류(major) 기준 (생키 갈라짐용)
    const monthSet = new Set(months.filter((m) => m.ratio > 0).map((m) => m.ym))
    const varByCat = new Map<string, number>()
    for (const r of mgmtRows) {
      if (r.source !== 'summary' || r.nature !== '판관비' || !monthSet.has(r.month_key)) continue
      if (r.cost_type !== '고정' && r.cost_type !== '변동') continue
      const ratio = months.find((m) => m.ym === r.month_key)?.ratio ?? 0
      if (r.cost_type === '고정') {
        const label = r.major || '기타 고정비'
        fixedByCat.set(label, (fixedByCat.get(label) ?? 0) + Math.round(r.amount * ratio))
      } else {
        const label = r.major || r.category || '기타 변동비'
        varByCat.set(label, (varByCat.get(label) ?? 0) + Math.round(r.amount * ratio))
      }
    }
    const toBreakdown = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([label, amount]) => ({ label, amount }))
        .filter((x) => x.amount > 0)
        .sort((a, b) => b.amount - a.amount)
    const fixedBreakdown = toBreakdown(fixedByCat)
    const varBreakdown = toBreakdown(varByCat)
    // 관리회계 미업로드 월 (기간에 걸친 달 중 원장이 빈 달)
    const mgmtMissingMonths = months.filter((m) => m.ratio > 0 && !mgmtMonths.has(m.ym)).map((m) => m.ym)

    // (구) MonthlyCost '해외' 월 등록액은 운임 인보이스 거래와 동일 금액이 이중 기록되어 제외
    // — 운임은 classifyPurchase 가 인보이스 거래에서 직접 집계 (2026-07-06 검증으로 확인)

    // 대출 이자 (영업외비용) — loan_payments 가 있는 달은 그 값, 없으면 관리회계 명세의 이자
    let interest = 0
    const interestMissing = !!loanRes.error
    const loanByMonth = new Map<string, number>()
    if (!loanRes.error) {
      for (const row of loanRes.data ?? []) {
        loanByMonth.set(row.month_key, (loanByMonth.get(row.month_key) ?? 0) + (row.interest ?? 0))
      }
    }
    for (const m of months) {
      const v = loanByMonth.has(m.ym) ? loanByMonth.get(m.ym)! : (sumInterestByMonth.get(m.ym) ?? 0)
      interest += Math.round(v * m.ratio)
    }

    return NextResponse.json({
      start: startStr,
      end: endStr,
      sales: salesAgg._sum.totalAmount ?? 0,
      fabricCogs, // = 판매 기준 원가(soldCogs) + 해외운임·관세(freightCogs)
      soldCogs: sold.soldCogs,
      freightCogs,
      freightBreakdown, // 해외운임 세부 — 항공/배/관세·수입세금
      varBreakdown, // 변동 판관비 대분류 분해 (관리회계)
      cogsCoverage: Math.round(sold.coveragePct * 10) / 10, // 단가표 매칭 커버리지 %
      invPurchase, // 원단 매입 인보이스 — 재고 취득 (손익 미반영, 참고)
      usdRate: sold.usdRate,
      expenses: expensesSum,
      shipping: purchShipping, // 국내 배송 (해외운임은 freightCogs 로)
      fixed,
      fixedBreakdown,
      // 엔에이아이디(법인): 매출·매입 = 세금계산서 / 운영비·이자 = 관리회계 명세
      naid: { sales: naidSales, cogs: naidCogs, fixed: naidFixed, interest: naidInterest },
      mgmtMissing,
      mgmtMissingMonths,
      interest,
      interestMissing,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '손익 집계 실패' })
  }
}
