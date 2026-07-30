import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const EXHIBITION_PATH = '/finance/marketing/exhibitions'

function needsExhibitionAuth(pathname: string) {
  return pathname === EXHIBITION_PATH || pathname === `${EXHIBITION_PATH}/export`
}

export async function middleware(request: NextRequest) {
  if (!needsExhibitionAuth(request.nextUrl.pathname)) return NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return new NextResponse('CFO authentication is not configured.', { status: 503 })
  }

  const response = NextResponse.next({ request })
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return response

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
