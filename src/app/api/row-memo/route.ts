import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_TYPES = ['SALE', 'PAYMENT', 'BANK', 'TAX']

export async function POST(request: NextRequest) {
  try {
    const { rowType, rowId, text } = await request.json()
    if (!rowType || !rowId) return NextResponse.json({ error: 'rowType / rowId 필수' }, { status: 400 })
    if (!VALID_TYPES.includes(rowType)) return NextResponse.json({ error: 'rowType invalid' }, { status: 400 })

    const trimmed = (text ?? '').trim()
    if (trimmed === '') {
      // 빈 값이면 삭제
      await prisma.rowMemo.deleteMany({ where: { rowType, rowId } })
      return NextResponse.json({ success: true, action: 'deleted' })
    }
    await prisma.rowMemo.upsert({
      where: { rowType_rowId: { rowType, rowId } },
      update: { text: trimmed },
      create: { rowType, rowId, text: trimmed },
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 })
  }
}
