/**
 * GET /api/saekdong/notifications
 *
 * 색동 아임웹 쇼핑몰 최근 3일 신규 주문·후기 알림.
 * 개인정보 없이 금액·별점·후기요약·시각만. 3일 윈도우 라이브 계산 → 자연 만료.
 * 아임웹 호출 제한 보호: Supabase 공유 캐시 3분 TTL + 단일 갱신 락.
 */
import { NextResponse } from 'next/server'
import { getSaekdongNotices } from '@/lib/saekdong-imweb'
import { withApiCache } from '@/lib/saekdong-api-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // 캐싱은 Supabase 공유 캐시가 담당

export async function GET() {
  const data = await withApiCache('notices', 180, () => getSaekdongNotices(3))
  return NextResponse.json(data)
}
