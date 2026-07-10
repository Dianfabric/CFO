/**
 * GET /api/maintenance/amend-sale        — 정정 대상 미리보기 (dry-run)
 * GET /api/maintenance/amend-sale?apply=1 — 실제 정정
 *
 * 5/29 (주) 레스타 딜 정정 (대표 지시 2026-07-10):
 * 물량(4,765m)은 전량 출고됐고, 결제만 디안(개인) 3,000만 + 나머지 법인(엔에이아이디) 분할.
 * - 디안 5/29 거래: 품목 수량·금액을 3,000만/154,435,200 비율로 축소
 *   → 판매 기준 원가 엔진이 수량 기준으로 디안 몫 원가를 자동 인식
 * - 연결 미수금(AR): 원금 3,000만으로 정정, 잔액·상태 재계산
 * - 법인 6월 매출(세금계산서 공급가 45,454,545 = 5,000만 VAT포함)의 매출원가:
 *   같은 딜 원단을 공급가 비율로 배분해 naid_invoices 매입 행으로 등록 (TMS 단가 × 환율)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getFabricPrices, findFabricCost, getUSDtoKRW } from '@/lib/googleSheets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TX_ID = 'cmreb5g9q000es5q0z9yf6qx8' // 2026-05-29 일계표 매출 - (주) 레스타
const DEAL_TOTAL = 154435200 // 원 공급가 (안전장치 — 다르면 건너뜀)
const DIAN_SHARE = 30000000 // 디안(개인) 결제분 공급가
const NAID_SUPPLY = 45454545 // 법인 6월 세금계산서 공급가 (5,000만 VAT포함)
const REASON = '대표 지시 2026-07-10: 레스타 딜 — 디안 3,000만 + 법인 분할 결제, 수량·원가 비율 배분'
const NAID_COGS_KEY = 'MANUAL-RESTA-COGS-2026-06' // naid_invoices 멱등 키

export async function GET(req: NextRequest) {
  try {
    const apply = req.nextUrl.searchParams.get('apply') === '1'

    const tx = await prisma.transaction.findUnique({
      where: { id: TX_ID },
      include: { items: true },
    })
    if (!tx) return NextResponse.json({ error: '거래 없음' }, { status: 404 })
    if (tx.totalAmount !== DEAL_TOTAL) {
      return NextResponse.json({
        dryRun: !apply,
        skipped: `금액 불일치 (현재 ${tx.totalAmount.toLocaleString()} ≠ 기대 ${DEAL_TOTAL.toLocaleString()}) — 이미 정정된 것으로 판단`,
      })
    }

    const rDian = DIAN_SHARE / DEAL_TOTAL
    const rNaid = NAID_SUPPLY / DEAL_TOTAL

    // ── 디안 품목 축소 (수량·금액 × 비율, 합계 = 3,000만 정확히) ──
    const scaled = tx.items.map((it) => ({
      productName: it.productName ?? '',
      quantity: Math.round(it.quantity * rDian * 100) / 100,
      unitPrice: it.unitPrice,
      amount: Math.round(it.amount * rDian),
    }))
    const diff = DIAN_SHARE - scaled.reduce((s, it) => s + it.amount, 0)
    const biggest = scaled.reduce((a, b) => (b.amount > a.amount ? b : a), scaled[0])
    biggest.amount += diff // 반올림 잔차는 최대 품목에 흡수

    // ── 법인 6월 매출원가 — 원단 품목만 (할인 라인 제외) TMS 단가 × 환율 × 법인 비율 ──
    const [prices, usdRate] = await Promise.all([getFabricPrices(), getUSDtoKRW()])
    const fabricItems = tx.items.filter((it) => it.amount > 0 && !/할인/.test(it.productName ?? ''))
    const costDetail = fabricItems.map((it) => {
      const usd = findFabricCost(it.productName ?? '', prices)
      return {
        name: it.productName,
        qtyTotal: it.quantity,
        qtyNaid: Math.round(it.quantity * rNaid * 100) / 100,
        unitCostUSD: usd,
        costKRW: Math.round(it.quantity * rNaid * usd * usdRate),
      }
    })
    const naidCogs = costDetail.reduce((s, d) => s + d.costKRW, 0)
    const unmatched = costDetail.filter((d) => d.unitCostUSD <= 0).map((d) => d.name)

    // ── AR 재계산 ──
    const ar = await prisma.accountsReceivable.findFirst({
      where: { transactionId: TX_ID },
      include: { payments: true },
    })
    const paid = ar?.payments.reduce((s, pm) => s + pm.amount, 0) ?? 0
    const newRemaining = Math.max(0, DIAN_SHARE - paid)
    const newStatus = newRemaining === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OUTSTANDING'

    const plan = {
      dian: {
        txId: TX_ID,
        totalAmount: { before: tx.totalAmount, after: DIAN_SHARE },
        ratio: Math.round(rDian * 10000) / 100 + '%',
        items: scaled,
        ar: ar
          ? { paid, remaining: { before: ar.remainingAmount, after: newRemaining }, status: { before: ar.status, after: newStatus } }
          : null,
      },
      naid: {
        supply: NAID_SUPPLY,
        ratio: Math.round(rNaid * 10000) / 100 + '%',
        usdRate,
        cogs: naidCogs,
        costDetail,
        unmatched,
      },
    }

    if (apply) {
      await prisma.$transaction([
        prisma.transactionItem.deleteMany({ where: { transactionId: TX_ID } }),
        prisma.transaction.update({
          where: { id: TX_ID },
          data: {
            totalAmount: DIAN_SHARE,
            taxAmount: Math.round(DIAN_SHARE * 0.1),
            notes: [tx.notes, REASON, `원 공급가 ${DEAL_TOTAL.toLocaleString()}`].filter(Boolean).join(' | '),
            items: { create: scaled },
          },
        }),
        ...(ar
          ? [
              prisma.accountsReceivable.update({
                where: { id: ar.id },
                data: {
                  originalAmount: DIAN_SHARE,
                  remainingAmount: newRemaining,
                  status: newStatus,
                  notes: [ar.notes, REASON].filter(Boolean).join(' | '),
                },
              }),
            ]
          : []),
      ])
      const supabase = await createClient()
      const { error } = await supabase.from('naid_invoices').upsert(
        [{
          approval_no: NAID_COGS_KEY,
          direction: 'purchase',
          issue_date: '2026-06-30',
          month_key: '2026-06',
          counterparty: '(주) 레스타 딜 원가 배분',
          supply_amount: naidCogs,
          tax_amount: 0,
          item: `레스타 5/29 원단 원가 — 법인 매출(공급 ${NAID_SUPPLY.toLocaleString()}) 비율 배분, 환율 ${usdRate}`,
        }],
        { onConflict: 'approval_no' },
      )
      if (error) {
        return NextResponse.json({ error: `디안 정정은 완료, 법인 원가 등록 실패: ${error.message}`, plan }, { status: 500 })
      }
    }

    return NextResponse.json({ dryRun: !apply, applied: apply, plan })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '정정 실패' }, { status: 500 })
  }
}
