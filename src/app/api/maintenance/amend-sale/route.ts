/**
 * GET /api/maintenance/amend-sale        — 정정 대상 미리보기 (dry-run)
 * GET /api/maintenance/amend-sale?apply=1 — 실제 정정
 *
 * 대표 지시 매출 정정 — 코드에 하드코딩된 목록만 수행 (임의 금액 변경 불가).
 * 거래 금액·품목을 정정하고, 연결된 미수금(AR)의 원금·잔액·상태를 함께 맞춘다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AMENDMENTS = [
  {
    // 2026-05-29 (주) 레스타 일계표 매출 — 실제 매출은 3,000만원만 인식 (대표 지시 2026-07-10)
    txId: 'cmreb5g9q000es5q0z9yf6qx8',
    expectTotal: 154435200, // 안전장치 — 현재 금액이 다르면 건너뜀
    newTotal: 30000000,
    itemName: '레스타 매출 정정 (원 154,435,200 → 30,000,000)',
    reason: '대표 지시 2026-07-10: 5/29 레스타 매출은 3,000만원만 인식',
  },
]

export async function GET(req: NextRequest) {
  try {
    const apply = req.nextUrl.searchParams.get('apply') === '1'
    const results: unknown[] = []

    for (const a of AMENDMENTS) {
      const tx = await prisma.transaction.findUnique({
        where: { id: a.txId },
        include: { items: true },
      })
      if (!tx) {
        results.push({ txId: a.txId, skipped: '거래 없음' })
        continue
      }
      if (tx.totalAmount !== a.expectTotal) {
        results.push({ txId: a.txId, skipped: `금액 불일치 (현재 ${tx.totalAmount.toLocaleString()} ≠ 기대 ${a.expectTotal.toLocaleString()}) — 이미 정정됐거나 대상 아님` })
        continue
      }
      const ar = await prisma.accountsReceivable.findFirst({
        where: { transactionId: a.txId },
        include: { payments: true },
      })
      const paid = ar?.payments.reduce((s, pm) => s + pm.amount, 0) ?? 0
      const newRemaining = Math.max(0, a.newTotal - paid)
      const newStatus = newRemaining === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OUTSTANDING'

      const plan = {
        txId: a.txId,
        date: tx.date.toISOString().slice(0, 10),
        description: tx.description,
        totalAmount: { before: tx.totalAmount, after: a.newTotal },
        items: { before: tx.items.length, after: 1 },
        ar: ar
          ? {
              id: ar.id,
              originalAmount: { before: ar.originalAmount, after: a.newTotal },
              paid,
              remainingAmount: { before: ar.remainingAmount, after: newRemaining },
              status: { before: ar.status, after: newStatus },
            }
          : null,
        reason: a.reason,
      }

      if (apply) {
        await prisma.$transaction([
          prisma.transactionItem.deleteMany({ where: { transactionId: a.txId } }),
          prisma.transaction.update({
            where: { id: a.txId },
            data: {
              totalAmount: a.newTotal,
              taxAmount: Math.round(a.newTotal * 0.1),
              notes: [tx.notes, a.reason].filter(Boolean).join(' | '),
              items: {
                create: [{ productName: a.itemName, quantity: 1, unitPrice: a.newTotal, amount: a.newTotal }],
              },
            },
          }),
          ...(ar
            ? [
                prisma.accountsReceivable.update({
                  where: { id: ar.id },
                  data: {
                    originalAmount: a.newTotal,
                    remainingAmount: newRemaining,
                    status: newStatus,
                    notes: [ar.notes, a.reason].filter(Boolean).join(' | '),
                  },
                }),
              ]
            : []),
        ])
      }
      results.push({ ...plan, applied: apply })
    }

    return NextResponse.json({ dryRun: !apply, results })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '정정 실패' }, { status: 500 })
  }
}
