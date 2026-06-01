'use client'

/**
 * 디안 CFO Sidebar (V2.1.1 — NVIDIA 톤 + 평면 리스트 복원)
 *
 * - dark surface (#000) — NVIDIA 톤 유지
 * - 메뉴는 v1.0 / v1.1 평면 리스트 (그룹화 X) — 추후 재통합 예정
 * - 활성 메뉴: NVIDIA Green 좌측 표식 + 흰 텍스트
 * - 라디우스 2px (NVIDIA spec)
 * - 모바일 (<md) hidden — MobileNav 가 처리
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import AuthPill from '@/components/v11/AuthPill'
import { v10MenuItems, v11MenuItems, isMenuActive } from '@/lib/v11-nav-menu'

// sessionStorage 키 — 페이지 전환마다 fetch 안 함
const LOGO_CACHE_KEY = 'dian:company-logo'

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  // SSR/CSR 일치 — 초기엔 null, 마운트 후 sessionStorage 에서 즉시 hydrate
  const [logoPath, setLogoPath] = useState<string | null>(null)

  // 회사 로고 — sessionStorage 캐시 + 백그라운드 갱신 (페이지 전환 지연 없음)
  useEffect(() => {
    // 1) sessionStorage 즉시 hydrate
    try {
      const cached = sessionStorage.getItem(LOGO_CACHE_KEY)
      if (cached) setLogoPath(cached)
    } catch {
      /* ignore */
    }

    // 2) 1세션에 1회만 백그라운드 fetch (탭 닫기 전까지 재호출 없음)
    if (typeof window !== 'undefined' && (window as { __dianLogoFetched?: boolean }).__dianLogoFetched) {
      return
    }
    ;(window as { __dianLogoFetched?: boolean }).__dianLogoFetched = true

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
        if (data?.logoPath) {
          setLogoPath(data.logoPath)
          try {
            sessionStorage.setItem(LOGO_CACHE_KEY, data.logoPath)
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <aside
      className={cn(
        'hidden md:flex h-screen flex-col transition-all duration-200 sticky top-0 shrink-0',
        'bg-black text-white',
        collapsed ? 'w-14' : 'w-56',
      )}
      style={{ borderRight: '1px solid var(--nv-hairline-strong)' }}
    >
      {/* Logo bar */}
      <div
        className="flex items-center justify-between px-4 h-14 shrink-0"
        style={{ borderBottom: '1px solid var(--nv-hairline-strong)' }}
      >
        <Link
          href="/"
          aria-label="DIAVIS 홈"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          {logoPath ? (
            <img
              src={logoPath}
              alt="디안"
              className={cn(
                'h-7 w-auto object-contain',
                collapsed ? 'mx-auto' : '',
              )}
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          ) : (
            <>
              <span
                className="inline-block shrink-0"
                style={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: 'var(--nv-primary)',
                }}
              />
              {!collapsed && (
                <span className="text-[15px] font-bold tracking-tight text-white">
                  DIAN<span style={{ color: 'var(--nv-primary)' }}>·</span>DIAVIS
                </span>
              )}
            </>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-white/60 hover:text-white transition-colors shrink-0"
          aria-label={collapsed ? '펼치기' : '접기'}
          style={{ borderRadius: '2px' }}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
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
                  prefetch
                  className={cn(
                    'relative flex items-center gap-2.5 px-3 py-1.5 transition-colors text-[13px] tracking-tight',
                    isActive
                      ? 'bg-white/8 text-white'
                      : 'text-white/65 hover:bg-white/4 hover:text-white',
                  )}
                  style={{ borderRadius: '2px' }}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && !collapsed && (
                    <span
                      className="absolute left-1.5 top-1/2 -translate-y-1/2"
                      style={{
                        width: '3px',
                        height: '14px',
                        backgroundColor: 'var(--nv-primary)',
                      }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'w-3.5 h-3.5 shrink-0',
                      collapsed ? '' : 'ml-2',
                      isActive ? 'text-white' : 'text-white/40',
                    )}
                    strokeWidth={1.6}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Divider + v1.1 라벨 */}
        <div className="my-3 px-2">
          <div style={{ borderTop: '1px solid var(--nv-hairline-strong)' }} />
          {!collapsed && (
            <div className="px-3 pt-3 pb-1">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--nv-primary)' }}
              >
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
                  prefetch
                  className={cn(
                    'relative flex items-center gap-2.5 px-3 py-1.5 transition-colors text-[13px] tracking-tight',
                    isActive
                      ? 'bg-white/8 text-white'
                      : 'text-white/65 hover:bg-white/4 hover:text-white',
                  )}
                  style={{ borderRadius: '2px' }}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && !collapsed && (
                    <span
                      className="absolute left-1.5 top-1/2 -translate-y-1/2"
                      style={{
                        width: '3px',
                        height: '14px',
                        backgroundColor: 'var(--nv-primary)',
                      }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'w-3.5 h-3.5 shrink-0',
                      collapsed ? '' : 'ml-2',
                      isActive ? 'text-white' : 'text-white/40',
                    )}
                    strokeWidth={1.6}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Auth */}
        <div
          className="mt-3 px-2 pt-2"
          style={{ borderTop: '1px solid var(--nv-hairline-strong)' }}
        >
          <AuthPill collapsed={collapsed} />
        </div>
      </nav>
    </aside>
  )
}
