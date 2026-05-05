'use client'
/**
 * v1.1 사이드바용 사용자/로그아웃 표시 (Client Component)
 *
 * - Sidebar의 collapsed 상태를 prop으로 받음
 * - 브라우저 Supabase로 현재 사용자 조회
 * - 미인증: "로그인" 링크
 * - 인증됨: 이메일 + 로그아웃 버튼
 */
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogIn, LogOut, User as UserIcon, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AuthState {
  email: string | null
  role: string | null
}

export default function AuthPill({ collapsed = false }: { collapsed?: boolean }) {
  const [state, setState] = useState<AuthState>({ email: null, role: null })
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    let cancelled = false
    async function load() {
      const { data: userRes } = await supabase.auth.getUser()
      if (cancelled) return
      if (!userRes.user) {
        setState({ email: null, role: null })
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userRes.user.id)
        .maybeSingle()
      if (cancelled) return
      setState({ email: userRes.user.email ?? null, role: profile?.role ?? null })
    }
    load()

    // auth 상태 변화 (로그인/로그아웃) 감지
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setState({ email: null, role: null })
      else load()
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    })
  }

  if (!state.email) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
        title={collapsed ? '로그인' : undefined}
      >
        <LogIn className="h-4 w-4 shrink-0" />
        {!collapsed && <span>로그인</span>}
      </Link>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] text-slate-300">
        <UserIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{state.email}</div>
            {state.role && (
              <div className="truncate text-[10px] uppercase tracking-wide text-slate-500">
                {state.role}
              </div>
            )}
          </div>
        )}
      </div>
      <button
        onClick={handleSignOut}
        disabled={isPending}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
        title={collapsed ? '로그아웃' : undefined}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4 shrink-0" />
        )}
        {!collapsed && <span>{isPending ? '로그아웃 중...' : '로그아웃'}</span>}
      </button>
    </div>
  )
}
