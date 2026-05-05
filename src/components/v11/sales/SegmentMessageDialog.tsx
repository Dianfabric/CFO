'use client'
/**
 * 24셀 세그먼트 영업 메시지 편집 (PRD #2a ③)
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Save, AlertCircle } from 'lucide-react'
import { updateSegmentMessage } from '@/app/finance/sales/actions'
import { OCCUPATION_LABEL, DIVISION_LABEL } from '@/lib/v11-labels'

export interface SegmentRow {
  id: number
  occupation: string
  division: string
  core_message: string | null
  sales_sequence: string[] | null
  avg_cycle_days: number | null
  recommended_catalog: string | null
  typical_objections: string[] | null
  conversion_tips: string | null
}

export default function SegmentMessageDialog({
  segment,
  open,
  onOpenChange,
}: {
  segment: SegmentRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!segment) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <FormBody key={segment.id} segment={segment} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function FormBody({
  segment,
  onClose,
}: {
  segment: SegmentRow
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [coreMessage, setCoreMessage] = useState(segment.core_message ?? '')
  const [sequence, setSequence] = useState(
    (segment.sales_sequence ?? []).join('\n'),
  )
  const [cycleDays, setCycleDays] = useState<string>(
    segment.avg_cycle_days != null ? String(segment.avg_cycle_days) : '',
  )
  const [catalog, setCatalog] = useState(segment.recommended_catalog ?? '')
  const [objections, setObjections] = useState(
    (segment.typical_objections ?? []).join('\n'),
  )
  const [tips, setTips] = useState(segment.conversion_tips ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await updateSegmentMessage(segment.id, {
        core_message: coreMessage.trim() || null,
        sales_sequence: sequence
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        avg_cycle_days: cycleDays ? Number(cycleDays) : null,
        recommended_catalog: catalog.trim() || null,
        typical_objections: objections
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        conversion_tips: tips.trim() || null,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {OCCUPATION_LABEL[segment.occupation] ?? segment.occupation} ×{' '}
          {DIVISION_LABEL[segment.division] ?? segment.division}
        </DialogTitle>
        <DialogDescription>
          이 셀의 핵심 메시지·영업 시퀀스를 정하면 AI 추천이 더 정확해집니다.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="core">핵심 메시지 (한 줄)</Label>
          <Input
            id="core"
            value={coreMessage}
            onChange={(e) => setCoreMessage(e.target.value)}
            placeholder="예: 공간의 텍스처 컨셉 파트너"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="seq">영업 시퀀스 (한 줄에 한 단계)</Label>
          <Textarea
            id="seq"
            rows={5}
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            placeholder={`예:\n컨셉 미팅\n무드보드 송부\n샘플북 발송\n큐레이션 제안\n견적·발주`}
          />
          <p className="text-[11px] text-slate-400">
            각 행이 1단계. AI가 순서를 학습해 다음 행동을 추천합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cycle">평균 세일즈 사이클 (일)</Label>
            <Input
              id="cycle"
              type="number"
              min={1}
              max={730}
              value={cycleDays}
              onChange={(e) => setCycleDays(e.target.value)}
              placeholder="예: 42"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat">추천 카탈로그/룩북</Label>
            <Input
              id="cat"
              value={catalog}
              onChange={(e) => setCatalog(e.target.value)}
              placeholder="예: SS24 인테리어 룩북"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="obj">전형적 거절 사유 (한 줄에 한 개)</Label>
          <Textarea
            id="obj"
            rows={3}
            value={objections}
            onChange={(e) => setObjections(e.target.value)}
            placeholder={`예:\n예산이 정해져 있다\n기존 거래처와 계속 가고 싶다\n납기가 너무 길다`}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tips">전환 팁</Label>
          <Textarea
            id="tips"
            rows={3}
            value={tips}
            onChange={(e) => setTips(e.target.value)}
            placeholder="이 셀에서 효과적인 접근법, 강조 포인트, 가격 정책 등"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="mr-1 h-3.5 w-3.5" />
                저장
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
