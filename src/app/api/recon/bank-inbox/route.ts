/**
 * GET /api/recon/bank-inbox
 *
 * 통장 미처리 인박스 — 자동/퍼지 매칭 후에도 남은 UNMATCHED 입출금.
 * 매일 여기를 0건으로 만들면 통장 대사 완료. 최근 분류 내역(되돌리기용) 포함.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function kstYmd(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

export async function GET() {
  try {
    const d60 = new Date(Date.now() - 60 * 86400000)
    const [unmatched, classified] = await Promise.all([
      prisma.bankTransaction.findMany({
        where: { status: 'UNMATCHED', txDateTime: { gte: d60 } },
        orderBy: { txDateTime: 'desc' },
        take: 200,
      }),
      prisma.bankTransaction.findMany({
        where: {
          status: { in: ['INTERNAL', 'NON_AR'] },
          txCategory: { not: null },
          txDateTime: { gte: d60 },
        },
        orderBy: { txDateTime: 'desc' },
        take: 20,
      }),
    ])
    const map = (b: (typeof unmatched)[number]) => ({
      id: b.id,
      date: kstYmd(b.txDateTime),
      type: b.type as 'IN' | 'OUT',
      amount: b.amount,
      counterparty: b.rawCounterparty || b.rawDescription,
      description: b.rawDescription,
      category: b.txCategory,
    })
    return NextResponse.json({
      unmatched: unmatched.map(map),
      classified: classified.map(map),
    })
  } catch (e) {
    return NextResponse.json({
      unmatched: [],
      classified: [],
      error: e instanceof Error ? e.message : '통장 인박스 조회 실패',
    })
  }
}
