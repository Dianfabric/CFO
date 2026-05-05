'use client'
/**
 * 영업 활동 입력 폼 (인라인 카드)
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Save, Loader2, AlertCircle, X } from 'lucide-react'
import {
  SALES_ACTIVITY_LABEL,
  SALES_ACTIVITY_VALUES,
  SALES_STAGE_LABEL,
  SALES_STAGE_VALUES,
} from '@/lib/v11-labels'
import { upsertActivity } from '@/app/finance/sales/actions'

interface ClientLite {
  id: number
  name: string
  current_stage: string | null
}

const NONE = '__none__'

export default function ActivityForm({
  clients,
  onClose,
}: {
  clients: ClientLite[]
  onClose?: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const [clientId, setClientId] = useState<string>('')
  const [activityType, setActivityType] = useState<string>('call')
  const [activityDate, setActivityDate] = useState<string>(today)
  const [duration, setDuration] = useState<string>('')
  const [outcome, setOutcome] = useState<string>('')
  const [valueGen, setValueGen] = useState<string>('')
  const [nextAction, setNextAction] = useState<string>('')
  const [nextDate, setNextDate] = useState<string>('')
  const [stageBefore, setStageBefore] = useState<string>(NONE)
  const [stageAfter, setStageAfter] = useState<string>(NONE)
  const [notes, setNotes] = useState<string>('')

  // 거래처 선택 시 현재 단계 자동 채움
  function handleClientChange(v: string) {
    setClientId(v)
    const c = clients.find((x) => String(x.id) === v)
    if (c?.current_stage) {
      setStageBefore(c.current_stage)
      // 다음 단계 자동 추천 (같은 단계 유지가 default)
      if (stageAfter === NONE) setStageAfter(c.current_stage)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cid = parseInt(clientId, 10)
    if (!Number.isFinite(cid)) {
      setError('거래처를 선택해 주세요.')
      return
    }

    startTransition(async () => {
      const res = await upsertActivity({
        client_id: cid,
        activity_type: activityType,
        activity_date: activityDate,
        duration_minutes: duration ? parseInt(duration, 10) : null,
        outcome: outcome.trim() || null,
        value_generated: valueGen ? Number(valueGen) : null,
        next_action: nextAction.trim() || null,
        next_action_date: nextDate || null,
        stage_before: stageBefore === NONE ? null : stageBefore,
        stage_after: stageAfter === NONE ? null : stageAfter,
        notes: notes.trim() || null,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      router.refresh()
      onClose?.()
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">새 영업 활동 기록</CardTitle>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 거래처 + 활동 유형 + 날짜 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1 space-y-1.5">
              <Label>거래처 *</Label>
              <Select value={clientId} onValueChange={(v) => handleClientChange(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {clients.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      등록된 거래처 없음
                    </SelectItem>
                  ) : (
                    clients.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>활동 유형 *</Label>
              <Select
                value={activityType}
                onValueChange={(v) => setActivityType(v ?? 'call')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALES_ACTIVITY_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {SALES_ACTIVITY_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>날짜 *</Label>
              <Input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 시간 + 발생 매출 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>소요 시간 (분)</Label>
              <Input
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="예: 30"
              />
            </div>
            <div className="space-y-1.5">
              <Label>활동 발생 매출 (있으면)</Label>
              <Input
                type="number"
                min={0}
                value={valueGen}
                onChange={(e) => setValueGen(e.target.value)}
                placeholder="원"
              />
            </div>
          </div>

          {/* 결과 */}
          <div className="space-y-1.5">
            <Label>결과 한 줄</Label>
            <Input
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="예: 디자이너 미팅 — 다음 주 샘플 발송 약속"
            />
          </div>

          {/* 단계 전환 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>이전 단계</Label>
              <Select
                value={stageBefore}
                onValueChange={(v) => setStageBefore(v ?? NONE)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>(미설정)</SelectItem>
                  {SALES_STAGE_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {SALES_STAGE_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>이후 단계</Label>
              <Select
                value={stageAfter}
                onValueChange={(v) => setStageAfter(v ?? NONE)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>(변경 없음)</SelectItem>
                  {SALES_STAGE_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {SALES_STAGE_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {stageAfter !== NONE && stageAfter !== stageBefore && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              ℹ️ 거래처의 7단계가 자동으로{' '}
              <strong>{SALES_STAGE_LABEL[stageAfter]}</strong>로 변경됩니다.
            </div>
          )}

          {/* 다음 행동 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>다음 행동</Label>
              <Input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="예: 봄 시즌 룩북 발송"
              />
            </div>
            <div className="space-y-1.5">
              <Label>다음 행동 일자</Label>
              <Input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
              />
            </div>
          </div>

          {/* 메모 */}
          <div className="space-y-1.5">
            <Label>상세 메모</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="대화 핵심·발견·이슈 등"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                취소
              </Button>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="mr-1 h-3.5 w-3.5" />
                  활동 기록
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
