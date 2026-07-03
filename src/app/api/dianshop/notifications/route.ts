/**
 * GET /api/dianshop/notifications — 디안 원단 쇼핑몰 최근 3일 주문·후기.
 * Supabase 공유 캐시 3분 TTL.
 */
import { NextResponse } from 'next/server'
import { getShopNotices, DIAN_SHOP } from '@/lib/imweb-shop'
import { withApiCache } from '@/lib/saekdong-api-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await withApiCache('dianshop-notices', 180, () => getShopNotices(DIAN_SHOP, 3))
  return NextResponse.json(data)
}
