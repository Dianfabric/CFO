import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 담당자 미지정 SALE 거래 목록 (오래된 순)
export async function GET() {
  try {
    const txs = await prisma.transaction.findMany({
      where: { type: 'SALE', salesPerson: null },
      include: {
        client: { select: { id: true, name: true } },
        items: { select: { productName: true, quantity: true, amount: true } },
      },
      orderBy: { date: 'asc' },
    })

    const result = txs.map(tx => ({
      id: tx.id,
      date: tx.date.toISOString().slice(0, 10),
      clientId: tx.clientId,
      clientName: tx.client?.name ?? '(거래처 없음)',
      totalAmount: tx.totalAmount,
      itemCount: tx.items.length,
      firstProduct: tx.items[0]?.productName ?? '',
      description: tx.description,
    }))

    return NextResponse.json({
      total: result.length,
      totalAmount: result.reduce((s, r) => s + r.totalAmount, 0),
      items: result,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
