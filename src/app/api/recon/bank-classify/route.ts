/**
 * POST /api/recon/bank-classify
 *
 * 통장 미처리 내역 분류(이유 기록) — 거래처 입금이 아닌 건들.
 * 개인송금·내부이체 → INTERNAL, 그 외(카드대금·급여·세금 등) → NON_AR.
 * undo: true 면 분류 해제 → 인박스로 복귀.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INTERNAL_CATEGORIES = new Set(['개인송금', '내부이체'])

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { bankId: string; category?: string; undo?: boolean }
    if (!body.bankId) {
      return NextResponse.json({ ok: false, error: 'bankId 필요' }, { status: 400 })
    }
    if (body.undo) {
      await prisma.bankTransaction.update({
        where: { id: body.bankId },
        data: { status: 'UNMATCHED', txCategory: null },
      })
      return NextResponse.json({ ok: true })
    }
    const category = (body.category ?? '').trim()
    if (!category) {
      return NextResponse.json({ ok: false, error: 'category 필요' }, { status: 400 })
    }
    await prisma.bankTransaction.update({
      where: { id: body.bankId },
      data: {
        txCategory: category,
        status: INTERNAL_CATEGORIES.has(category) ? 'INTERNAL' : 'NON_AR',
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : '분류 실패' },
      { status: 500 },
    )
  }
}
