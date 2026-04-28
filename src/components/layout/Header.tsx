'use client'

import { Bell, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function Header() {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <h2 className="text-sm text-slate-500">
          {new Date().toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/transactions?new=true">
          <Button size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            새 거래
          </Button>
        </Link>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
