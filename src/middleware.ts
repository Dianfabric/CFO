/**
 * CFO는 현재 내부 관리자 페이지를 로그인 없이 바로 열도록 운영한다.
 * 세션 인증 도입 전까지는 접근을 강제하지 않는다.
 */
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
