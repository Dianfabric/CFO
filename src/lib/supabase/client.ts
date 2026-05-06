/**
 * Supabase 브라우저(클라이언트) 클라이언트
 *
 * 사용 위치: 'use client' 파일에서만.
 * 서버 컴포넌트에서는 ./server.ts 의 createClient()를 사용할 것.
 *
 * 환경변수가 없으면 throw 대신 null 반환 (graceful fail).
 * v1.0 기능 (Prisma 기반) 은 Supabase 없이도 동작.
 */
import { createBrowserClient } from '@supabase/ssr'

/** 환경변수 설정 여부 확인 (런타임). */
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    if (typeof window !== 'undefined') {
      // 한 번만 경고
      const w = window as unknown as { __dianSupabaseWarned?: boolean }
      if (!w.__dianSupabaseWarned) {
        console.warn(
          '[Dian] Supabase 환경변수 미설정 — v1.1 기능 (인증·DB) 일시 비활성. v1.0 기능은 정상.',
        )
        w.__dianSupabaseWarned = true
      }
    }
    return null
  }

  return createBrowserClient(url, anon)
}
