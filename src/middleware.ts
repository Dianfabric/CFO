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
  // V2.2 — 인증 강제 해제. 모든 요청 그대로 통과.
  return NextResponse.next({ request })
}

export const config = {
  // 정적 자산·이미지·favicon은 제외
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
