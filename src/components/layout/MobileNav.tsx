'use client'

/**
 * 모바일 네비게이션 (md 미만에서만 활성)
 * - 햄버거 트리거 버튼
 * - 좌측 슬라이드 시트로 사이드바 메뉴 노출
 * - 메뉴 클릭 시 자동 닫힘
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, TrendingUp } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import AuthPill from '@/components/v11/AuthPill'
import { v10MenuItems, v11MenuItems, isMenuActive } from '@/lib/v11-nav-menu'

export default function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [logoPath, setLogoPath] = useState<string | null>(null)

  // 회사 로고
  useEffect(() => {
    let cancelled = false
    fetch('/api/company-profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data?.logoPath) setLogoPath(data.logoPath)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // 라우트 변경 시 자동 닫힘
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-[var(--color-canvas-parchment)] press-scale"
        aria-label="메뉴"
      >
        <Menu className="w-5 h-5" strokeWidth={1.8} />
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[280px] sm:w-[320px] p-0 bg-card flex flex-col"
      >
        {/* Logo bar */}
        <div className="flex items-center px-5 h-14 border-b border-[var(--color-hairline)]">
          <Link
            href="/"
            aria-label="대시보드로 이동"
            className="flex items-center gap-2 press-scale rounded-md transition-opacity hover:opacity-80"
            onClick={() => setOpen(false)}
          >
            {logoPath ? (
              <img src={logoPath} alt="디안" className="h-8 w-auto object-contain" />
            ) : (
              <>
                <TrendingUp className="w-4 h-4 text-foreground" strokeWidth={2} />
                <span className="text-[16px] font-semibold tracking-[-0.022em] text-foreground">
                  디안
                </span>
              </>
            )}
          </Link>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {/* v1.0 메뉴 */}
          <ul className="space-y-px px-3">
            {v10MenuItems.map((item) => {
              const isActive = isMenuActive(item.href, pathname)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      // 모바일은 터치 타겟 더 넉넉하게 (44px 충족)
                      'flex items-center gap-3 px-3 py-2.5 rounded-md text-[15px] tracking-[-0.012em]',
                      isActive
                        ? 'bg-[var(--color-canvas-parchment)] text-foreground'
                        : 'text-[var(--color-ink-muted-80)] hover:text-foreground'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0',
                        isActive ? 'text-foreground' : 'text-[var(--color-ink-muted-48)]'
                      )}
                      strokeWidth={1.6}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="my-3 px-3">
            <div className="border-t border-[var(--color-hairline)]" />
            <div className="px-3 pt-3 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-muted-48)]">
                v1.1 신규
              </span>
            </div>
          </div>

          {/* v1.1 메뉴 */}
          <ul className="space-y-px px-3">
            {v11MenuItems.map((item) => {
              const isActive = isMenuActive(item.href, pathname)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md text-[15px] tracking-[-0.012em]',
                      isActive
                        ? 'bg-[var(--color-canvas-parchment)] text-foreground'
                        : 'text-[var(--color-ink-muted-80)] hover:text-foreground'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0',
                        isActive ? 'text-foreground' : 'text-[var(--color-ink-muted-48)]'
                      )}
                      strokeWidth={1.6}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="mt-3 px-3">
            <div className="border-t border-[var(--color-hairline)] pt-2">
              <AuthPill collapsed={false} />
            </div>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
