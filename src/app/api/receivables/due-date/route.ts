/**
 * POST /api/receivables/due-date  { clientId, dueDate: 'YYYY-MM-DD' | null }
 *
 * 거래처의 미결제 미수 건에 결제 예정일을 일괄 설정 (거래처 단위 관리).
 * 지나면 페이지에서 연체(D+n) 표시, 재입력하면 상태 리셋.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { clientId, dueDate } = (await req.json()) as { clientId?: string; dueDate?: string | null }
    if (!clientId) return NextResponse.json({ error: 'clientId 필요' }, { status: 400 })
    const due = dueDate ? new Date(dueDate + 'T00:00:00') : null
    const res = await prisma.accountsReceivable.updateMany({
      where: { clientId, remainingAmount: { gt: 0 } },
      data: { dueDate: due },
    })
    return NextResponse.json({ ok: true, updated: res.count })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '저장 실패' }, { status: 500 })
  }
}
