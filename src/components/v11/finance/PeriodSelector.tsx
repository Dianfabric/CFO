'use client'
/**
 * 기간 선택기 — URL 쿼리 파라미터로 상태 관리.
 * 서버 컴포넌트가 search params로 데이터 fetch.
 */
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Period = 'this_month' | 'last_month' | '90d' | 'ytd'

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'this_month', label: '이번 달' },
  { value: 'last_month', label: '지난 달' },
  { value: '90d', label: '최근 90일' },
  { value: 'ytd', label: '올해 누적' },
]

export default function PeriodSelector({ current = 'this_month' }: { current?: Period }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setPeriod(p: Period) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', p)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-xs">
      <Calendar className="ml-2 h-3.5 w-3.5 text-slate-400" />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setPeriod(o.value)}
          className={cn(
            'rounded px-3 py-1.5 font-medium transition',
            current === o.value
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
