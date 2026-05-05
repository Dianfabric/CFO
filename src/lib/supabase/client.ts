/**
 * Supabase 브라우저(클라이언트) 클라이언트
 *
 * 사용 위치: 'use client' 파일에서만.
 * 서버 컴포넌트에서는 ./server.ts 의 createClient()를 사용할 것.
 */
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되어 있지 않습니다. .env.local 확인.',
    )
  }

  return createBrowserClient(url, anon)
}
