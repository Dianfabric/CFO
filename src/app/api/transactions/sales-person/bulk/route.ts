import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 여러 거래에 담당자 일괄 지정
export async function POST(request: NextRequest) {
  try {
    const { transactionIds, salesPerson } = await request.json() as { transactionIds?: string[]; salesPerson?: string }
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'transactionIds 필요' }, { status: 400 })
    }
    const value = salesPerson?.trim() || null
    const result = await prisma.transaction.updateMany({
      where: { id: { in: transactionIds } },
      data: { salesPerson: value },
    })
    return NextResponse.json({ success: true, count: result.count, salesPerson: value })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
