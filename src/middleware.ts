/**
 * Next.js 15 + Supabase SSR 미들웨어
 *
 * V2.2 — 개발 중에는 로그인 강제 없음.
 * 모든 페이지는 로그인 없이 접근 가능. 세션 쿠키만 갱신.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// 인증 강제 X — 개발 중 모든 페이지 접근 허용
const PROTECTED_PREFIXES: string[] = []

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 환경변수가 없으면 미들웨어를 통과시키고 끝 (v1.0 경로는 영향 없음)
  if (!url || !anon) {
    return response
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // 세션 갱신을 위해 getUser() 호출 (필수)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 보호 경로 + 미인증 → /login 으로 리다이렉트
  const pathname = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  // 정적 자산·이미지·favicon은 제외
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
