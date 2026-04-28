import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - 제품 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await prisma.product.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ error: '제품을 찾을 수 없습니다' }, { status: 404 })
    return NextResponse.json(product)
  } catch (error) {
    console.error('Product GET Error:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

// PUT - 제품 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        category: body.category,
        unit: body.unit,
        purchasePrice: body.purchasePrice,
        sellingPrice: body.sellingPrice,
        description: body.description,
        isActive: body.isActive,
      },
    })
    return NextResponse.json(product)
  } catch (error) {
    console.error('Product PUT Error:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

// DELETE - 제품 비활성화
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Product DELETE Error:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
