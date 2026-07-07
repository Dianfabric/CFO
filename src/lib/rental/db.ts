/**
 * 샘플대여관리 DB — Fabric-image-storage Supabase 프로젝트 (CFO 자체 Supabase와 별개)
 * 서버 전용: service key 사용 (RLS 우회). 클라이언트 코드에서 import 금지.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function rentalDb(): SupabaseClient {
  const url = process.env.RENTAL_SUPABASE_URL
  const key = process.env.RENTAL_SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('RENTAL_SUPABASE_URL / RENTAL_SUPABASE_SERVICE_KEY 환경변수가 필요합니다.')
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
