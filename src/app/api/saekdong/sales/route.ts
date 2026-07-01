/**
 * GET /api/saekdong/sales
 *
 * 색동 아임웹 쇼핑몰 매출 집계 (오늘/이번주/이번달 + 일별 추이 + 제품별).
 * 개인정보 없이 금액·날짜·상품명만. 아임웹 호출 제한(5건/초) 보호 위해 캐싱.
 */
import { NextResponse } from 'next/server'
import { getSaekdongSales } from '@/lib/saekdong-imweb'

export const runtime = 'nodejs'
// 10분 캐싱 — 페이지 열 때마다 아임웹 재조회하지 않음
export const revalidate = 600

export async function GET() {
  const data = await getSaekdongSales(12) // 최근 12개월
  return NextResponse.json(data)
}
