/**
 * GET /api/recon/suggestions
 *
 * 대사 센터 — 퍼지 매칭 제안 (매출↔세금계산서, 통장입금↔미수 거래처).
 */
import { NextResponse } from 'next/server'
import { getReconSuggestions } from '@/lib/recon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getReconSuggestions()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { tax: [], deposits: [], error: e instanceof Error ? e.message : '대사 제안 실패' },
      { status: 200 },
    )
  }
}
