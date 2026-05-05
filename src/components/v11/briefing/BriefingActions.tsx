'use client'
/**
 * 브리핑 생성/삭제 버튼 (Client Component)
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles, Trash2, Sunrise, Sunset } from 'lucide-react'
import {
  generateBriefing,
  deleteBriefing,
} from '@/app/finance/briefing/actions'

export function GenerateBriefingButton({
  type,
}: {
  type: 'morning' | 'evening'
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const res = await generateBriefing(type)
      if (!res.ok) {
        setError(res.error ?? '생성 실패')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleClick} disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Claude 호출 중... (10-20초)
          </>
        ) : (
          <>
            {type === 'morning' ? (
              <Sunrise className="mr-2 h-4 w-4" />
            ) : (
              <Sunset className="mr-2 h-4 w-4" />
            )}
            <Sparkles className="mr-1 h-3 w-3" />
            오늘 {type === 'morning' ? '모닝 브리핑' : '이브닝 노트'} 생성
          </>
        )}
      </Button>
      {error && (
        <p className="text-xs text-rose-600">{error}</p>
      )}
    </div>
  )
}

export function DeleteBriefingButton({ id }: { id: number }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm('이 브리핑을 삭제하시겠습니까? (재생성 가능)')) return
    startTransition(async () => {
      const res = await deleteBriefing(id)
      if (!res.ok) {
        alert(res.error ?? '삭제 실패')
        return
      }
      router.refresh()
    })
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleClick}
      disabled={isPending}
      className="h-7 text-rose-600 hover:bg-rose-50"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}
