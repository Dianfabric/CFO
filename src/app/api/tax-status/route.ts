import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 매출 거래(SALE)의 세금계산서 발행 상태 토글
// PENDING(미발행) | ISSUED(발행) | COMPLETED(완료)
const ALLOWED = new Set(['PENDING', 'ISSUED', 'COMPLETED'])

export async function POST(request: NextRequest) {
  try {
    const { transactionId, status } = await request.json()
    if (!transactionId) return NextResponse.json({ error: 'transactionId 필요' }, { status: 400 })
    if (!ALLOWED.has(status)) return NextResponse.json({ error: 'status 는 PENDING | ISSUED | COMPLETED' }, { status: 400 })

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { taxStatus: status === 'PENDING' ? null : status },
    })

    return NextResponse.json({ success: true, taxStatus: status })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[tax-status POST]', msg)
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 })
  }
}
