/**
 * Supabase 서버 클라이언트 (Next.js 15 App Router)
 *
 * - Server Components, Route Handlers, Server Actions에서 사용.
 * - cookies()는 Next 15에서 async이므로 await 필수.
 *
 * SECURITY:
 *   anon key를 쓰는 createClient()는 RLS 정책을 따른다(권장).
 *   service_role key를 쓰는 createServiceClient()는 RLS를 우회하므로
 *   매우 신중하게 사용 (관리자 작업, 마이그레이션 스크립트 등에만).
 */
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되어 있지 않습니다.',
    )
  }

  const cookieStore = await cookies()

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Component에서 쿠키 set이 호출될 수 있음 (정상 동작).
          // middleware/Server Action/Route Handler에서는 set 가능.
        }
      },
    },
  })
}

/**
 * 관리자(service_role) 클라이언트 — RLS 우회.
 * 마이그레이션 / 스크립트 / 관리자 전용 API에서만 사용.
 * 절대 클라이언트 컴포넌트 / 클라이언트 코드에서 import 하지 말 것.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되어 있지 않습니다. (서버 전용)',
    )
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
