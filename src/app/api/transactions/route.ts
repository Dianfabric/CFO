import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - 거래 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const clientId = searchParams.get('clientId')
    const paymentStatus = searchParams.get('paymentStatus')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (clientId) where.clientId = clientId
    if (paymentStatus) where.paymentStatus = paymentStatus
    if (startDate || endDate) {
      where.date = {}
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate)
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate + 'T23:59:59')
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, unit: true } } } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ])

    return NextResponse.json({ transactions, total, page, limit })
  } catch (error) {
    console.error('Transactions GET Error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

// POST - 거래 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      date, type, clientId, description, paymentMethod,
      paymentStatus, channel, notes, items
    } = body

    if (!date || !type || !items || items.length === 0) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 })
    }

    // 총액 계산
    const totalAmount = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) =>
      sum + (item.quantity * item.unitPrice), 0)
    const taxAmount = Math.round(totalAmount * 0.1) // 부가세 10%

    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(date),
        type,
        clientId: clientId || null,
        description: description || null,
        totalAmount,
        taxAmount,
        paymentMethod: paymentMethod || 'CASH',
        paymentStatus: paymentStatus || 'PAID',
        channel: channel || 'B2B',
        notes: notes || null,
        items: {
          create: items.map((item: {
            productId?: string; productName?: string;
            quantity: number; unitPrice: number; notes?: string
          }) => ({
            productId: item.productId || null,
            productName: item.productName || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: Math.round(item.quantity * item.unitPrice),
            notes: item.notes || null,
          })),
        },
      },
      include: {
        client: true,
        items: { include: { product: true } },
      },
    })

    // 외상(CREDIT)인 경우 미수금 레코드 생성
    if (paymentMethod === 'CREDIT' && type === 'SALE' && clientId) {
      await prisma.accountsReceivable.create({
        data: {
          clientId,
          transactionId: transaction.id,
          originalAmount: totalAmount,
          remainingAmount: totalAmount,
          status: 'OUTSTANDING',
        },
      })
    }

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Transactions POST Error:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
