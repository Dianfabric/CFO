/**
 * GET /api/saekdong/notifications
 *
 * 색동 아임웹 쇼핑몰 최근 3일 신규 주문·후기 알림.
 * 개인정보 없이 금액·별점·후기요약·시각만. 3일 윈도우 라이브 계산 → 자연 만료.
 */
import { NextResponse } from 'next/server'
import { getSaekdongNotices } from '@/lib/saekdong-imweb'

export const runtime = 'nodejs'
// 3분 캐싱 — 벨을 자주 눌러도 아임웹 재조회 최소화 (주문/후기 알림은 3분 신선도면 충분)
export const revalidate = 180

export async function GET() {
  const data = await getSaekdongNotices(3) // 최근 3일
  return NextResponse.json(data)
}
