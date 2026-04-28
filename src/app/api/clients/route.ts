import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - 거래처 목록
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const type = searchParams.get('type')

    const where: Record<string, unknown> = { isActive: true }
    if (type) where.type = type
    if (search) where.name = { contains: search }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Clients GET Error:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

// POST - 거래처 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, businessNumber, contactName, phone, email, address, type, notes } = body

    if (!name) {
      return NextResponse.json({ error: '거래처명을 입력해주세요' }, { status: 400 })
    }

    const client = await prisma.client.create({
      data: {
        name,
        businessNumber: businessNumber || null,
        contactName: contactName || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        type: type || 'CUSTOMER',
        notes: notes || null,
      },
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error('Clients POST Error:', error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
