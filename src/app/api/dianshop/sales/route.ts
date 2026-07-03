/**
 * GET /api/dianshop/sales — 디안 원단 쇼핑몰(아임웹 2호점) 매출 집계.
 * Supabase 공유 캐시 10분 TTL (?refresh=1 로 갱신).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getShopSales, DIAN_SHOP } from '@/lib/imweb-shop'
import { withApiCache } from '@/lib/saekdong-api-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('refresh') === '1'
  const data = await withApiCache('dianshop-sales', 600, () => getShopSales(DIAN_SHOP, 12), force)
  return NextResponse.json(data)
}
