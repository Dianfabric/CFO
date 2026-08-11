import { NextRequest, NextResponse } from 'next/server'
import { createManualFabric, queryFabricList, type CreateFabricInput } from '@/lib/fabric-knowledge'

// GET /api/fabric-prices — public.fabric_knowledge_master 목록·요약
// POST /api/fabric-prices — CFO 관리 화면에서 직접 등록한 대표 품목 1건
// 내부 관리 화면 전용 서버 엔드포인트. anon 클라이언트 노출 금지.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const result = await queryFabricList({
      query: searchParams.get('query') ?? undefined,
      brand: searchParams.get('brand') ?? undefined,
      priceStatus: searchParams.get('priceStatus') ?? undefined,
      matchStatus: searchParams.get('matchStatus') ?? undefined,
      active: searchParams.get('active') ?? undefined,
      page: Number(searchParams.get('page')) || 1,
      pageSize: Number(searchParams.get('pageSize')) || 100,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('fabric-prices GET Error:', error)
    return NextResponse.json(
      { error: '원단 단가 마스터를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateFabricInput
    const row = await createManualFabric(body)
    return NextResponse.json({ row }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : '원단을 등록하지 못했습니다.'
    const status = message.includes('필수') ? 400 : message.includes('이미 등록') ? 409 : 500
    if (status === 500) console.error('fabric-prices POST Error:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
