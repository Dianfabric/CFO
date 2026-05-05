'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { updateCycleRetro } from '@/app/finance/cycle/actions'

export interface RetroRow {
  id: number
  cycle_number: number
  start_date: string
  end_date: string
  vision_statement: string | null
  what_worked: string | null
  what_didnt: string | null
  lessons_learned: string | null
  next_cycle_focus: string | null
  reflection_notes: string | null
  retro_completed: boolean | null
}

export default function CycleRetroForm({ cycle }: { cycle: RetroRow }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [vision, setVision] = useState(cycle.vision_statement ?? '')
  const [worked, setWorked] = useState(cycle.what_worked ?? '')
  const [didnt, setDidnt] = useState(cycle.what_didnt ?? '')
  const [lessons, setLessons] = useState(cycle.lessons_learned ?? '')
  const [nextFocus, setNextFocus] = useState(cycle.next_cycle_focus ?? '')
  const [notes, setNotes] = useState(cycle.reflection_notes ?? '')
  const [completed, setCompleted] = useState(cycle.retro_completed ?? false)

  function handleSave(markCompleted = false) {
    setError(null)
    startTransition(async () => {
      const res = await updateCycleRetro({
        cycle_id: cycle.id,
        vision_statement: vision || null,
        what_worked: worked || null,
        what_didnt: didnt || null,
        lessons_learned: lessons || null,
        next_cycle_focus: nextFocus || null,
        reflection_notes: notes || null,
        retro_completed: markCompleted ? true : completed,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      if (markCompleted) setCompleted(true)
      setSavedAt(new Date())
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <Card
        className={
          completed ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/30'
        }
      >
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2 text-sm">
            {completed ? (
              <>
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-emerald-800">회고 완료</span>
              </>
            ) : (
              <span className="font-semibold text-amber-800">회고 작성 중</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="text-[11px] text-emerald-600">
                저장됨 ({savedAt.toLocaleTimeString('ko-KR')})
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => handleSave(false)} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="mr-1 h-3.5 w-3.5" />
                  임시 저장
                </>
              )}
            </Button>
            {!completed && (
              <Button size="sm" onClick={() => handleSave(true)} disabled={isPending}>
                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                회고 완료
              </Button>
            )}
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
          <CardTitle className="text-sm">사이클 비전 (이번 사이클 시작 시)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            rows={2}
            placeholder="이번 12주에 무엇을 이루고 싶었는가"
          />
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader>
          <CardTitle className="text-sm">잘 작동한 것 (What Worked)</CardTitle>
          <CardDescription>
            결과를 만든 활동·시스템·결정 — 다음 사이클에 계속할 것
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={worked}
            onChange={(e) => setWorked(e.target.value)}
            rows={4}
            placeholder="구체적 사례·숫자로"
          />
        </CardContent>
      </Card>

      <Card className="border-rose-200 bg-rose-50/30">
        <CardHeader>
          <CardTitle className="text-sm">잘 안 된 것 (What Didn&apos;t Work)</CardTitle>
          <CardDescription>
            기대 못 미친 것 — 다음 사이클에 그만하거나 바꿀 것
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={didnt}
            onChange={(e) => setDidnt(e.target.value)}
            rows={4}
            placeholder="원인까지 함께"
          />
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-sm">학습 (Lessons Learned)</CardTitle>
          <CardDescription>이번 사이클로부터 얻은 통찰 — 영구 자산</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={lessons}
            onChange={(e) => setLessons(e.target.value)}
            rows={4}
            placeholder="3~5가지로 압축"
          />
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="text-sm">다음 사이클 집중 (Next Focus)</CardTitle>
          <CardDescription>
            학습을 어떻게 다음 12주에 적용할 것인가
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={nextFocus}
            onChange={(e) => setNextFocus(e.target.value)}
            rows={4}
            placeholder="구체적 행동·우선순위·차별 행동"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">자유 메모</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="감정·환경·기타"
          />
        </CardContent>
      </Card>
    </div>
  )
}
