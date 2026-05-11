'use client'

/**
 * 활성 사이클이 없을 때 표시되는 "12주 사이클 시작" 카드.
 * 버튼 클릭 → server action startCycle() → 자동 INSERT → 페이지 revalidate.
 * (Supabase SQL Editor 안 가도 됨)
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { startCycle } from '@/app/finance/cycle/actions'

interface Props {
  error?: string
}

export default function CycleStartCard({ error }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 환경변수 누락 에러는 별도 안내 (서버 자체가 동작 안 함)
  const isEnvMissing = error?.includes('NEXT_PUBLIC_SUPABASE') ||
                       error?.includes('환경변수')

  const handleStart = () => {
    setErrorMsg(null)
    startTransition(async () => {
      const result = await startCycle()
      if (result.ok) {
        router.refresh()
      } else {
        setErrorMsg(result.error)
      }
    })
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="py-5">
        <div className="flex items-start gap-3">
          {isEnvMissing ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          ) : (
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div className="flex-1 min-w-0">
            {isEnvMissing ? (
              <>
                <p className="text-sm font-semibold text-rose-900">
                  Supabase 환경변수가 설정되지 않았습니다.
                </p>
                <p className="mt-1 text-xs text-rose-800">
                  Vercel 대시보드 → Settings → Environment Variables 에서{' '}
                  <code className="rounded bg-white px-1.5 py-0.5 text-[11px]">NEXT_PUBLIC_SUPABASE_URL</code>
                  ,{' '}
                  <code className="rounded bg-white px-1.5 py-0.5 text-[11px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
                  {' '}등 5개 변수를 추가하고 redeploy 해주세요.
                </p>
                <p className="mt-2 text-[11px] text-rose-700">
                  자세한 에러: {error}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-amber-900">
                  활성 12주 사이클이 없습니다.
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  아래 버튼을 누르면 <strong>오늘부터 12주 (83일)</strong> 짜리 새 사이클이 시작됩니다.
                  매주 월요일마다 WAM 으로 진행 점검, 12주 후 회고로 다음 사이클을 준비하세요.
                </p>
                <div className="mt-4">
                  <Button
                    onClick={handleStart}
                    disabled={isPending}
                    className="gap-2"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        사이클 생성 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        12주 사이클 시작하기
                      </>
                    )}
                  </Button>
                </div>
                {errorMsg && (
                  <p className="mt-3 text-xs text-rose-700">
                    ⚠ {errorMsg}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
