/**
 * 샘플대여관리 DB — Fabric-image-storage Supabase 프로젝트 (CFO 자체 Supabase와 별개)
 * 서버 전용: service key 사용 (RLS 우회). 클라이언트 코드에서 import 금지.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function rentalDb(): SupabaseClient {
  // Vercel에 소문자로 등록된 경우까지 허용
  const url = process.env.RENTAL_SUPABASE_URL || process.env.rental_supabase_url
  const key = process.env.RENTAL_SUPABASE_SERVICE_KEY || process.env.rental_supabase_service_key
  if (!url || !key) {
    throw new Error(`환경변수 누락 — url:${url ? 'OK' : '없음'} key:${key ? 'OK' : '없음'}`)
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export const RENTAL_MANAGERS = ['유대현 과장', '팀장님', '부장님', '사장님', '조승경', '전새로미'] as const

export const BOOK_IMAGE_BUCKET = 'book-images'

/** 대여 기간(일) — 반납예정일 = 대여일 + RENTAL_DAYS */
export const RENTAL_DAYS = 7

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
