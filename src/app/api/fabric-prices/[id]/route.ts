import { NextRequest, NextResponse } from 'next/server'
import { queryFabricDetail, updateFabricPrice, type CreateFabricInput } from '@/lib/fabric-knowledge'

// GET /api/fabric-prices/[id] — 단일 원단 상세 (안전 컬럼 + 원본 jsonb)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const detail = await queryFabricDetail(id)
    if (!detail) return NextResponse.json({ error: '원단을 찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (error) {
    console.error('fabric-prices detail GET Error:', error)
    return NextResponse.json({ error: '원단 상세를 불러오지 못했습니다.' }, { status: 500 })
  }
}

// PATCH /api/fabric-prices/[id] — 상세 드로어에서 핵심 마스터 필드 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json() as CreateFabricInput
    const updated = await updateFabricPrice(id, body)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('fabric-prices detail PATCH Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '원단 정보를 저장하지 못했습니다.' },
      { status: 400 },
    )
  }
}
