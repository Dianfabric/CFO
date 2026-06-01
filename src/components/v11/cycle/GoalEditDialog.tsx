'use client'
/**
 * 목표 추가/편집 다이얼로그
 *
 * - 위대한 12주의 5개 이상 경고 표시
 * - 측정 단위 (KRW/count/%/days) 선택
 * - 선행/후행 지표 토글
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save, AlertCircle, Trash2 } from 'lucide-react'
import { upsertGoal, deleteGoal } from '@/app/finance/cycle/actions'

export interface GoalRow {
  id: number
  cycle_id: number
  category: string
  title: string
  description: string | null
  target_value: number | null
  unit: string | null
  current_value: number | null
  is_leading_indicator: boolean
  display_order: number
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'revenue', label: '매출' },
  { value: 'sales_activity', label: '영업 활동' },
  { value: 'marketing', label: '마케팅' },
  { value: 'operations', label: '운영' },
  { value: 'finance', label: '재무' },
]

const UNITS: { value: string; label: string }[] = [
  { value: 'count', label: '건' },
  { value: 'item', label: '개' },
  { value: 'KRW', label: '원' },
  { value: 'percent', label: '%' },
  { value: 'hours', label: '시간' },
  { value: 'ratio', label: '배' },
]

export default function GoalEditDialog({
  goal,
  cycleId,
  open,
  onOpenChange,
  goalsCount,
}: {
  goal: GoalRow | null
  cycleId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  goalsCount: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <GoalForm
          key={goal?.id ?? 'new'}
          goal={goal}
          cycleId={cycleId}
          goalsCount={goalsCount}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function GoalForm({
  goal,
  cycleId,
  goalsCount,
  onClose,
}: {
  goal: GoalRow | null
  cycleId: number
  goalsCount: number
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(goal?.title ?? '')
  const [category, setCategory] = useState(goal?.category ?? 'revenue')
  const [unit, setUnit] = useState(goal?.unit ?? 'KRW')
  const [target, setTarget] = useState<string>(
    goal?.target_value != null ? String(goal.target_value) : '',
  )
  const [current, setCurrent] = useState<string>(
    goal?.current_value != null ? String(goal.current_value) : '0',
  )
  const [description, setDescription] = useState(goal?.description ?? '')
  const [isLeading, setIsLeading] = useState(goal?.is_leading_indicator ?? false)

  const isNew = !goal
  const willExceedFiveWarning = isNew && goalsCount >= 5

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await upsertGoal({
        id: goal?.id,
        cycle_id: cycleId,
        category,
        title: title.trim(),
        description: description.trim() || null,
        target_value: target ? Number(target) : null,
        current_value: current ? Number(current) : 0,
        unit: unit || null,
        is_leading_indicator: isLeading,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!goal) return
    if (!confirm(`"${goal.title}" 목표를 삭제하시겠습니까?`)) return
    startTransition(async () => {
      const res = await deleteGoal(goal.id)
      if (!res.ok) {
        setError(res.error ?? '삭제 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isNew ? '새 목표 추가' : '목표 편집'}</DialogTitle>
        <DialogDescription>
          12주 안에 80% 이상 달성하면 의미 있는 목표를 정합니다.
        </DialogDescription>
      </DialogHeader>

      {willExceedFiveWarning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          ⚠️ 위대한 12주는 <strong>최대 5개</strong> 목표를 권장합니다. 현재 {goalsCount}개 ―
          단순화를 다시 한번 고려해 주세요.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="goal-title">목표 제목</Label>
          <Input
            id="goal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="예: 인테리어 프로젝트 매출 5,000만 달성"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>카테고리</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? 'revenue')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>측정 단위</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v ?? 'KRW')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="goal-target">목표 수치 (100%)</Label>
            <Input
              id="goal-target"
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
              placeholder="50000000"
            />
            {target && unit && (
              <p className="text-[11px] text-slate-500">
                80% 기준: <strong>{(Number(target) * 0.8).toLocaleString()}</strong> {unit}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-current">현재 수치</Label>
            <Input
              id="goal-current"
              type="number"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
            <p className="text-[11px] text-slate-400">매주 WAM에서 갱신</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="goal-desc">설명 / 배경</Label>
          <Textarea
            id="goal-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="이 목표가 왜 중요한가? 3년 비전과 어떻게 연결되는가?"
            rows={2}
          />
        </div>

        <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={isLeading}
            onChange={(e) => setIsLeading(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="font-semibold">선행지표 (Leading Indicator)</div>
            <div className="text-[11px] text-slate-500">
              체크: 활동·행동량 (예: 미팅 수, 콘텐츠 발행 수). 안 체크: 결과지표 (매출, 신규 거래처).
            </div>
          </div>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!isNew && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="mr-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              삭제
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                저장
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
