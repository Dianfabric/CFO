'use client'

/**
 * 모바일 네비게이션 (V2.1.1 — NVIDIA 톤 + 평면 리스트 복원)
 * - 햄버거 트리거
 * - 검정 배경 sheet
 * - v1.0 / v1.1 평면 리스트
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
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
      .then(async (r) => {
        if (!r.ok) return null
        const text = await r.text()
        if (!text) return null
        try {
          return JSON.parse(text)
        } catch {
          return null
        }
      })
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
        className="md:hidden inline-flex h-9 w-9 items-center justify-center text-white hover:bg-white/10"
        aria-label="메뉴"
        style={{ borderRadius: '2px' }}
      >
        <Menu className="w-5 h-5" strokeWidth={1.8} />
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[280px] sm:w-[320px] p-0 bg-black flex flex-col text-white"
        style={{ borderRight: '1px solid var(--nv-hairline-strong)' }}
      >
        {/* Logo bar */}
        <div
          className="flex items-center px-5 h-14"
          style={{ borderBottom: '1px solid var(--nv-hairline-strong)' }}
        >
          <Link
            href="/"
            aria-label="DIAVIS 홈"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
            onClick={() => setOpen(false)}
          >
            {logoPath ? (
              <img
                src={logoPath}
                alt="디안"
                className="h-8 w-auto object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            ) : (
              <>
                <span
                  className="inline-block"
                  style={{
                    width: '14px',
                    height: '14px',
                    backgroundColor: 'var(--nv-primary)',
                  }}
                />
                <span className="text-[15px] font-bold tracking-tight text-white">
                  DIAN
                  <span style={{ color: 'var(--nv-primary)' }}>·</span>DIAVIS
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
                    prefetch
                    onClick={() => setOpen(false)}
                    className={cn(
                      'relative flex items-center gap-3 h-11 px-3 text-[14px] transition-colors tracking-tight',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/65 hover:bg-white/5 hover:text-white',
                    )}
                    style={{ borderRadius: '2px' }}
                  >
                    {isActive && (
                      <span
                        className="absolute left-1.5 top-1/2 -translate-y-1/2"
                        style={{
                          width: '3px',
                          height: '16px',
                          backgroundColor: 'var(--nv-primary)',
                        }}
                      />
                    )}
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 ml-2',
                        isActive ? 'text-white' : 'text-white/40',
                      )}
                      strokeWidth={1.6}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Divider + v1.1 라벨 */}
          <div className="my-3 px-3">
            <div style={{ borderTop: '1px solid var(--nv-hairline-strong)' }} />
            <div className="px-3 pt-3 pb-1">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--nv-primary)' }}
              >
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
                    prefetch
                    onClick={() => setOpen(false)}
                    className={cn(
                      'relative flex items-center gap-3 h-11 px-3 text-[14px] transition-colors tracking-tight',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/65 hover:bg-white/5 hover:text-white',
                    )}
                    style={{ borderRadius: '2px' }}
                  >
                    {isActive && (
                      <span
                        className="absolute left-1.5 top-1/2 -translate-y-1/2"
                        style={{
                          width: '3px',
                          height: '16px',
                          backgroundColor: 'var(--nv-primary)',
                        }}
                      />
                    )}
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 ml-2',
                        isActive ? 'text-white' : 'text-white/40',
                      )}
                      strokeWidth={1.6}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div
            className="mt-3 px-3 pt-2"
            style={{ borderTop: '1px solid var(--nv-hairline-strong)' }}
          >
            <AuthPill collapsed={false} />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
