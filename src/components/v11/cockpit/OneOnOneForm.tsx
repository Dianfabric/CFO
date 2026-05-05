'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save, Loader2, Trash2, AlertCircle, Lock } from 'lucide-react'
import { updateOneOnOne, deleteOneOnOne } from '@/app/finance/cockpit/actions'

export interface OneOnOneRow {
  id: number
  counterpart_id: string | null
  counterpart_name: string | null
  meeting_date: string
  duration_minutes: number | null
  agenda: string | null
  rapport: string | null
  performance: string | null
  feedback_given: string | null
  feedback_received: string | null
  decisions: string | null
  next_steps: string | null
  notes: string | null
}

export default function OneOnOneForm({ note }: { note: OneOnOneRow }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [name, setName] = useState(note.counterpart_name ?? '')
  const [date, setDate] = useState(note.meeting_date)
  const [duration, setDuration] = useState(
    note.duration_minutes != null ? String(note.duration_minutes) : '',
  )
  const [agenda, setAgenda] = useState(note.agenda ?? '')
  const [rapport, setRapport] = useState(note.rapport ?? '')
  const [performance, setPerformance] = useState(note.performance ?? '')
  const [fbGiven, setFbGiven] = useState(note.feedback_given ?? '')
  const [fbReceived, setFbReceived] = useState(note.feedback_received ?? '')
  const [decisions, setDecisions] = useState(note.decisions ?? '')
  const [nextSteps, setNextSteps] = useState(note.next_steps ?? '')
  const [notes, setNotes] = useState(note.notes ?? '')

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updateOneOnOne({
        id: note.id,
        counterpart_name: name || null,
        meeting_date: date,
        duration_minutes: duration ? parseInt(duration, 10) : null,
        agenda: agenda || null,
        rapport: rapport || null,
        performance: performance || null,
        feedback_given: fbGiven || null,
        feedback_received: fbReceived || null,
        decisions: decisions || null,
        next_steps: nextSteps || null,
        notes: notes || null,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      setSavedAt(new Date())
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('이 1:1 노트를 영구 삭제하시겠습니까? 본인만 삭제할 수 있습니다.')) return
    startTransition(async () => {
      const res = await deleteOneOnOne(note.id)
      if (!res.ok) {
        setError(res.error ?? '삭제 실패')
        return
      }
      router.push('/finance/cockpit/one-on-one')
    })
  }

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2 text-sm text-emerald-800">
            <Lock className="h-4 w-4" />
            <span>본인만 조회·편집 가능 — RLS로 보호</span>
          </div>
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="text-[11px] text-emerald-600">
                저장됨 ({savedAt.toLocaleTimeString('ko-KR')})
              </span>
            )}
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="mr-1 h-3.5 w-3.5" />
                  저장
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">미팅 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>상대방 이름</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 김OO 마케팅 담당, 이OO 코치"
              />
            </div>
            <div className="space-y-1.5">
              <Label>미팅 일자</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>소요 시간 (분)</Label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="max-w-[120px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">캠벨 1:1 구조</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="아젠다" value={agenda} onChange={setAgenda} placeholder="이번 미팅의 주제" />
          <Field
            label="관계 형성 (Rapport)"
            value={rapport}
            onChange={setRapport}
            placeholder="안부·개인사·관심사"
            multiline
          />
          <Field
            label="성과 (Performance)"
            value={performance}
            onChange={setPerformance}
            placeholder="진행 사항·성과·막힘"
            multiline
          />
          <Field
            label="내가 준 피드백"
            value={fbGiven}
            onChange={setFbGiven}
            placeholder="구체적 행동·관찰 + 개선 제안"
            multiline
          />
          <Field
            label="내가 받은 피드백"
            value={fbReceived}
            onChange={setFbReceived}
            placeholder="상대가 나에게 준 피드백 (반드시 기록!)"
            multiline
          />
          <Field
            label="결정 사항"
            value={decisions}
            onChange={setDecisions}
            placeholder="이번 미팅에서 결정된 것들"
            multiline
          />
          <Field
            label="다음 단계"
            value={nextSteps}
            onChange={setNextSteps}
            placeholder="누가·무엇을·언제까지"
            multiline
          />
          <Field
            label="자유 메모"
            value={notes}
            onChange={setNotes}
            placeholder="기타"
            multiline
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          className="text-rose-600 hover:bg-rose-50"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          이 노트 삭제
        </Button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  )
}
