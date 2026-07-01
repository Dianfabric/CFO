'use client'

/**
 * 디안 CFO Header (V2.1 — NVIDIA utility bar)
 *
 * 설계:
 * - 검정 utility bar (NVIDIA primary-nav 컨셉) — 32-48px 높이
 * - 좌측: 모바일 햄버거
 * - 우측: 새 거래 (NVIDIA Green CTA) + 알림
 * - 데스크탑(≥md)에서는 사이드바가 이미 검정이라 시각적 연속
 */
import { Plus } from 'lucide-react'
import Link from 'next/link'
import MobileNav from './MobileNav'
import NotificationBell from './NotificationBell'

export default function Header() {
  return (
    <header
      className="bg-black h-12 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30"
      style={{ borderBottom: '1px solid var(--nv-hairline-strong)' }}
    >
      {/* 좌측 — 모바일에서만 햄버거 노출 */}
      <div className="flex items-center gap-2">
        <MobileNav />
      </div>

      {/* 우측 — 액션 */}
      <div className="flex items-center gap-2">
        <Link
          href="/transactions?new=true"
          className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-bold tracking-tight transition-colors"
          style={{
            backgroundColor: 'var(--nv-primary)',
            color: '#000000',
            borderRadius: '2px',
          }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
          <span className="hidden sm:inline">새 거래</span>
        </Link>
        <NotificationBell />
      </div>
    </header>
  )
}
