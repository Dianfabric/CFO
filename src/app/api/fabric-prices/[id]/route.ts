import { NextRequest, NextResponse } from 'next/server'
import { queryFabricDetail } from '@/lib/fabric-knowledge'

// GET /api/fabric-prices/[id] — 단일 원단 상세 (안전 컬럼 + 원본 jsonb)
// 읽기 전용. 내부 서버 엔드포인트.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const detail = await queryFabricDetail(id)
    if (!detail) {
      return NextResponse.json({ error: '원단을 찾을 수 없습니다.' }, { status: 404 })
    }
    return NextResponse.json(detail)
  } catch (error) {
    console.error('fabric-prices detail GET Error:', error)
    return NextResponse.json(
      { error: '원단 상세를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}
