/**
 * GET /api/saekdong/sales
 *
 * 색동 아임웹 쇼핑몰 매출 집계 (오늘/이번주/이번달/올해 + 월별 + 제품별 + 카테고리별).
 * 개인정보 없이 금액·날짜·상품명만.
 *
 * 아임웹 호출 제한(5건/초) 보호: Supabase 공유 캐시 10분 TTL + 단일 갱신 락.
 * ?refresh=1 이면 TTL 무시하고 갱신 (락은 유지 — 동시 갱신은 안 됨).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSaekdongSales } from '@/lib/saekdong-imweb'
import { withApiCache } from '@/lib/saekdong-api-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // 캐싱은 Supabase 공유 캐시가 담당

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('refresh') === '1'
  const data = await withApiCache('sales', 600, () => getSaekdongSales(12), force)
  return NextResponse.json(data)
}
