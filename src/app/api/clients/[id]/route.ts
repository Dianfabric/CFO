import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        transactions: { orderBy: { date: 'desc' }, take: 20, include: { items: true } },
        accountsReceivable: { where: { status: { in: ['OUTSTANDING', 'PARTIAL', 'OVERDUE'] } } },
      },
    })
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const totalSales = await prisma.transaction.aggregate({
      where: { clientId: id, type: 'SALE' }, _sum: { totalAmount: true }, _count: true,
    })
    const totalAR = await prisma.accountsReceivable.aggregate({
      where: { clientId: id, status: { in: ['OUTSTANDING', 'PARTIAL', 'OVERDUE'] } },
      _sum: { remainingAmount: true },
    })

    return NextResponse.json({
      ...client,
      stats: {
        totalSales: totalSales._sum.totalAmount || 0,
        salesCount: totalSales._count || 0,
        totalReceivable: totalAR._sum.remainingAmount || 0,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const client = await prisma.client.update({ where: { id }, data: body })
    return NextResponse.json(client)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
