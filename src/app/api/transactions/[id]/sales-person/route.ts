import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 거래 1건의 담당자 수동 지정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { salesPerson } = await request.json() as { salesPerson?: string }
    const value = salesPerson?.trim() || null
    await prisma.transaction.update({
      where: { id },
      data: { salesPerson: value },
    })
    return NextResponse.json({ success: true, salesPerson: value })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
