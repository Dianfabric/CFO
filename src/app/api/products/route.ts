import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - 제품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const active = searchParams.get('active')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}
    if (category) where.category = category
    if (active !== null) where.isActive = active !== 'false'
    if (search) where.name = { contains: search }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Products GET Error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

// POST - 제품 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, category, unit, purchasePrice, sellingPrice, description } = body

    if (!name || !category || !unit) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name,
        category,
        unit,
        purchasePrice: purchasePrice || 0,
        sellingPrice: sellingPrice || 0,
        description: description || null,
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Products POST Error:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
