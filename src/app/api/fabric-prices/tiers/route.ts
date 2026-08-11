import { NextResponse } from 'next/server'
import { queryFabricPriceTiers } from '@/lib/fabric-knowledge'

// GET /api/fabric-prices/tiers — 현재 단가 마스터 기반 자동 단가표
export async function GET() {
  try {
    return NextResponse.json({ tiers: await queryFabricPriceTiers() })
  } catch (error) {
    console.error('fabric-price tiers GET Error:', error)
    return NextResponse.json({ error: '단가표를 불러오지 못했습니다.' }, { status: 500 })
  }
}
