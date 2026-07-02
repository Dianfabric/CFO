/**
 * GET /api/saekdong/payment-check
 *
 * 색동 쇼핑몰 매출(아임웹, 2026-07-01~) ↔ 통장 입금(경영 계기판 업로드) 자동 대사.
 * 입금 확인된 매출은 목록에서 자동 제외, 미확인만 반환.
 */
import { NextResponse } from 'next/server'
import { getSaekdongPayCheck } from '@/lib/saekdong-paycheck'
import { withApiCache } from '@/lib/saekdong-api-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // 캐싱은 Supabase 공유 캐시가 담당

export async function GET() {
  // 3분 TTL — 아임웹 호출 제한 보호. 통장 업로드 반영은 최대 3분 지연.
  const data = await withApiCache('paycheck', 180, () => getSaekdongPayCheck())
  return NextResponse.json(data)
}
