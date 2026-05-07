'use client'

/**
 * 디안 CFO Sidebar (데스크탑 전용 — md: 이상)
 * 기준: docs/design-system/apple-spec.md
 * - 화이트 배경, ink 텍스트, 단일 Action Blue 액센트
 * - 활성 메뉴: parchment 표면 + ink 텍스트
 * - 호버: 텍스트 강조만
 *
 * 모바일 (md 미만) 에서는 hidden — MobileNav 가 햄버거 시트 제공.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import AuthPill from '@/components/v11/AuthPill'
import { v10MenuItems, v11MenuItems, isMenuActive } from '@/lib/v11-nav-menu'

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
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

  return (
    <aside
      className={cn(
        // 모바일(<md)에선 hidden, md(768px) 이상에서 표시
        'hidden md:flex h-screen bg-card flex-col transition-all duration-300 sticky top-0 border-r border-[var(--color-hairline)] shrink-0',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Logo bar — 메인 대시보드 (v1.0 /) 로 이동 */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--color-hairline)]">
        <Link
          href="/"
          aria-label="대시보드로 이동"
          className="flex items-center gap-2 press-scale rounded-md transition-opacity hover:opacity-80"
        >
          {logoPath ? (
            <img
              src={logoPath}
              alt="디안"
              className={cn('h-7 w-auto object-contain', collapsed ? 'mx-auto' : '')}
            />
          ) : (
            <TrendingUp className="w-4 h-4 text-foreground shrink-0" strokeWidth={2} />
          )}
          {!collapsed && !logoPath && (
            <span className="text-[16px] font-semibold tracking-[-0.022em] text-foreground">
              디안
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors press-scale shrink-0"
          aria-label={collapsed ? '펼치기' : '접기'}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {/* v1.0 메뉴 */}
        <ul className="space-y-px px-2">
          {v10MenuItems.map((item) => {
            const isActive = isMenuActive(item.href, pathname)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150 text-[14px] tracking-[-0.012em]',
                    isActive
                      ? 'bg-[var(--color-canvas-parchment)] text-foreground'
                      : 'text-[var(--color-ink-muted-80)] hover:text-foreground'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={cn(
                      'w-3.5 h-3.5 shrink-0',
                      isActive ? 'text-foreground' : 'text-[var(--color-ink-muted-48)]'
                    )}
                    strokeWidth={1.6}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="my-3 px-2">
          <div className="border-t border-[var(--color-hairline)]" />
          {!collapsed && (
            <div className="px-2.5 pt-2.5 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-muted-48)]">
                v1.1
              </span>
            </div>
          )}
        </div>

        {/* v1.1 메뉴 */}
        <ul className="space-y-px px-2">
          {v11MenuItems.map((item) => {
            const isActive = isMenuActive(item.href, pathname)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150 text-[14px] tracking-[-0.012em]',
                    isActive
                      ? 'bg-[var(--color-canvas-parchment)] text-foreground'
                      : 'text-[var(--color-ink-muted-80)] hover:text-foreground'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={cn(
                      'w-3.5 h-3.5 shrink-0',
                      isActive ? 'text-foreground' : 'text-[var(--color-ink-muted-48)]'
                    )}
                    strokeWidth={1.6}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="mt-3 px-2">
          <div className="border-t border-[var(--color-hairline)] pt-1.5">
            <AuthPill collapsed={collapsed} />
          </div>
        </div>
      </nav>
    </aside>
  )
}
