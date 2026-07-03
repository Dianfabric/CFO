/**
 * GET /api/tax-prep?year=2026&q=2
 *
 * 분기별 세금 준비 현황:
 * - 매출세액(매출 세금계산서) − 매입세액(매입 세금계산서) = 예상 부가세(근사)
 * - 미발행 의심: 분기 매출 거래 중 계산서 확인 안 된 것
 * - 미수취 의심: 분기 매입 거래 중 매입 계산서 매칭 안 된 것
 * ※ 카드매입·현금영수증 등 기타 매입세액 미반영 — 영수증 자료 연동 예정.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function kstYmd(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

export async function GET(req: NextRequest) {
  try {
    const now = new Date()
    const kstNow = kstYmd(now)
    const year = Number(req.nextUrl.searchParams.get('year')) || Number(kstNow.slice(0, 4))
    const q =
      Number(req.nextUrl.searchParams.get('q')) ||
      Math.floor((Number(kstNow.slice(5, 7)) - 1) / 3) + 1
    const startMonth = (q - 1) * 3 // 0-base
    const start = new Date(year, startMonth, 1)
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59)
    const startYmd = kstYmd(start)
    const endYmd = kstYmd(end)

    const supabase = await createClient()
    const [salesInv, purchInv, salesTx, purchTx, bankIns] = await Promise.all([
      // 매출 세금계산서 (분기)
      prisma.taxInvoice.findMany({
        where: { issueDate: { gte: start, lte: end } },
        select: { supplyAmount: true, taxAmount: true },
      }),
      // 매입 세금계산서 (분기, Supabase — 테이블 없으면 null)
      supabase
        .from('purchase_tax_invoices')
        .select('supply_amount, tax_amount, matched_tx_id')
        .gte('issue_date', startYmd)
        .lte('issue_date', endYmd),
      // 분기 매출 거래 (미발행 의심 후보)
      prisma.transaction.findMany({
        where: {
          type: 'SALE',
          date: { gte: start, lte: end },
          totalAmount: { gt: 0 },
          taxStatus: null,
          taxInvoices: { none: {} },
          OR: [
            { description: null },
            {
              NOT: {
                OR: [
                  { description: { startsWith: '이월 매출 보정' } },
                  { description: { startsWith: '이월 매출 -' } },
                  { description: { startsWith: '선수금 placeholder' } },
                ],
              },
            },
          ],
        },
        include: { client: { select: { name: true } } },
        orderBy: { totalAmount: 'desc' },
      }),
      // 분기 매입 거래 (미수취 의심 후보)
      prisma.transaction.findMany({
        where: { type: 'PURCHASE', date: { gte: start, lte: end }, totalAmount: { gt: 0 } },
        include: { client: { select: { name: true } } },
        orderBy: { totalAmount: 'desc' },
      }),
      // 카드·토스 매출 (통장 정산 입금 — 계산서 없는 매출, 그 자체가 신고 자료)
      prisma.bankTransaction.findMany({
        where: { type: 'IN', txDateTime: { gte: start, lte: end } },
        select: { amount: true, rawCounterparty: true, rawDescription: true },
      }),
    ])

    const salesVat = salesInv.reduce((s, i) => s + i.taxAmount, 0)
    const salesSupply = salesInv.reduce((s, i) => s + i.supplyAmount, 0)

    const purchTableMissing = !!purchInv.error
    const purchRows = purchInv.data ?? []
    const purchaseVat = purchRows.reduce((s, i) => s + (i.tax_amount ?? 0), 0)
    const purchaseSupply = purchRows.reduce((s, i) => s + (i.supply_amount ?? 0), 0)
    const matchedPurchTxIds = new Set(
      purchRows.map((i) => i.matched_tx_id as string | null).filter(Boolean),
    )

    const unissued = salesTx.map((t) => ({
      id: t.id,
      date: kstYmd(t.date),
      client: t.client?.name ?? '거래처 미상',
      amount: t.totalAmount,
    }))
    const unreceived = purchTx
      .filter((t) => !matchedPurchTxIds.has(t.id))
      .map((t) => ({
        id: t.id,
        date: kstYmd(t.date),
        client: t.client?.name ?? '거래처 미상',
        amount: t.totalAmount,
      }))

    // 카드리더기·토스페이먼츠 정산 입금 (세금계산서 없는 매출 — 자체가 신고 자료)
    const CARD_TOSS_RE =
      /여신금융|신한카드|국민카드|KB국민카드|삼성카드|현대카드|롯데카드|비씨카드|BC카드|하나카드|우리카드|농협카드|NH카드|토스페이먼츠/
    const cardToss = bankIns.filter(
      (b) => CARD_TOSS_RE.test(b.rawCounterparty) || CARD_TOSS_RE.test(b.rawDescription),
    )

    return NextResponse.json({
      year,
      q,
      range: { start: startYmd, end: endYmd },
      cardTossSales: {
        count: cardToss.length,
        sum: cardToss.reduce((s, b) => s + b.amount, 0),
      },
      salesVat,
      salesSupply,
      salesInvoiceCount: salesInv.length,
      purchaseVat,
      purchaseSupply,
      purchaseInvoiceCount: purchRows.length,
      purchTableMissing,
      estVat: salesVat - purchaseVat,
      unissued: { count: unissued.length, sum: unissued.reduce((s, x) => s + x.amount, 0), top: unissued.slice(0, 5) },
      unreceived: { count: unreceived.length, sum: unreceived.reduce((s, x) => s + x.amount, 0), top: unreceived.slice(0, 5) },
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : '세금 준비 조회 실패',
    })
  }
}
