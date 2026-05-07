'use client'

/**
 * 디안 CFO Header — Apple sub-nav-frosted (반응형)
 * 기준: docs/design-system/apple-spec.md
 * - 모바일 (< lg): 좌측 햄버거 + 우측 압축 액션
 * - 데스크탑 (≥ lg): 좌측 비움 + 우측 액션 (사이드바가 이미 있으니 햄버거 불필요)
 */
import { Bell, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import MobileNav from './MobileNav'

export default function Header() {
  return (
    <header className="bg-frosted h-12 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 border-b border-[var(--color-hairline)]">
      {/* 좌측 — 모바일에서만 햄버거 노출 */}
      <div className="flex items-center gap-2">
        <MobileNav />
      </div>

      {/* 우측 — 액션. 모바일에선 텍스트 숨김, 아이콘만 */}
      <div className="flex items-center gap-1">
        <Link href="/transactions?new=true">
          <Button size="sm" className="gap-1 h-7 px-3 text-[12px]">
            <Plus className="w-3 h-3" strokeWidth={2.2} />
            <span className="hidden sm:inline">새 거래</span>
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="알림"
          className="relative text-[var(--color-ink-muted-48)] hover:text-foreground"
        >
          <Bell className="w-3.5 h-3.5" strokeWidth={1.6} />
        </Button>
      </div>
    </header>
  )
}
