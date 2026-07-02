/**
 * GET /api/saekdong/payment-check
 *
 * 색동 쇼핑몰 매출(아임웹, 2026-07-01~) ↔ 통장 입금(경영 계기판 업로드) 자동 대사.
 * 입금 확인된 매출은 목록에서 자동 제외, 미확인만 반환.
 */
import { NextResponse } from 'next/server'
import { getSaekdongPayCheck } from '@/lib/saekdong-paycheck'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // 통장 업로드 즉시 반영

export async function GET() {
  const data = await getSaekdongPayCheck()
  return NextResponse.json(data)
}
