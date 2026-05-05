'use client'
/**
 * 7단계 변경 빠른 버튼 — 거래처 카드 클릭 시 모달로 단계 이동
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'
import { upsertActivity } from '@/app/finance/sales/actions'
import {
  SALES_STAGE_LABEL,
  SALES_STAGE_VALUES,
  SALES_STAGE_COLOR,
} from '@/lib/v11-labels'
import { cn } from '@/lib/utils'

export default function StageChangeButton({
  clientId,
  clientName,
  currentStage,
}: {
  clientId: number
  clientName: string
  currentStage: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(newStage: string) {
    setError(null)
    startTransition(async () => {
      // 활동 1건 자동 등록 + 단계 전환 트리거가 clients.current_stage 갱신
      const res = await upsertActivity({
        client_id: clientId,
        activity_type: 'follow_up',
        activity_date: new Date().toISOString().split('T')[0],
        outcome: `${SALES_STAGE_LABEL[currentStage ?? '']} → ${SALES_STAGE_LABEL[newStage]}`,
        stage_before: currentStage ?? null,
        stage_after: newStage,
        notes: '7단계 트래커에서 단계 이동',
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-blue-600 hover:underline"
      >
        단계 이동 →
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{clientName} — 단계 이동</DialogTitle>
            <DialogDescription>
              현재:{' '}
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                  SALES_STAGE_COLOR[currentStage ?? ''] ?? 'bg-slate-100 text-slate-600',
                )}
              >
                {SALES_STAGE_LABEL[currentStage ?? ''] ?? '미설정'}
              </span>
              · 새 단계 선택 시 활동 1건이 자동 기록됩니다
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            {SALES_STAGE_VALUES.map((s) => {
              const isCurrent = s === currentStage
              return (
                <Button
                  key={s}
                  variant={isCurrent ? 'default' : 'outline'}
                  size="sm"
                  disabled={isCurrent || isPending}
                  onClick={() => handleChange(s)}
                  className="justify-start"
                >
                  {SALES_STAGE_LABEL[s]}
                  {isCurrent && <span className="ml-auto text-[10px]">현재</span>}
                </Button>
              )
            })}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            {isPending && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                저장 중...
              </span>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
