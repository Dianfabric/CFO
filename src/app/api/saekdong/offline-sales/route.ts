/**
 * GET /api/saekdong/offline-sales
 *
 * 색동 오프라인 매출 — 경영 계기판에 업로드된 일계표 품목 중
 * 색동 쇼핑몰 상품명과 일치하는 매출만 집계. 입금·발행 상태 포함.
 */
import { NextResponse } from 'next/server'
import { getSaekdongOfflineSales } from '@/lib/saekdong-offline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // 업로드 즉시 반영되도록 캐싱 안 함

export async function GET() {
  const data = await getSaekdongOfflineSales(12)
  return NextResponse.json(data)
}
