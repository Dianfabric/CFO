'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save, Loader2, AlertCircle, CheckCircle, XCircle, Star } from 'lucide-react'
import {
  updateLongTermVision,
  updateGoalAlignment,
  type LongTermVisionInput,
} from '@/app/finance/cycle/actions'
import { cn } from '@/lib/utils'

export interface VisionRow {
  five_year_vision: string | null
  three_year_vision: string | null
  three_year_milestones: string | null
  core_values: string | null
  non_negotiables: string | null
  origin_story: string | null
  bhag: string | null
}

export interface GoalCheck {
  id: number
  title: string
  category: string
  is_leading_indicator: boolean
  target_value: number | null
  current_value: number | null
  unit: string | null
  aligned_with_vision: boolean | null
  importance_score: number | null
  measurability_note: string | null
}

export default function VisionWorkbook({
  vision,
  goals,
}: {
  vision: VisionRow
  goals: GoalCheck[]
}) {
  return (
    <div className="space-y-4">
      <VisionSection vision={vision} />
      <AlignmentChecker goals={goals} />
    </div>
  )
}

function VisionSection({ vision }: { vision: VisionRow }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [form, setForm] = useState<LongTermVisionInput>({
    five_year_vision: vision.five_year_vision ?? '',
    three_year_vision: vision.three_year_vision ?? '',
    three_year_milestones: vision.three_year_milestones ?? '',
    core_values: vision.core_values ?? '',
    non_negotiables: vision.non_negotiables ?? '',
    origin_story: vision.origin_story ?? '',
    bhag: vision.bhag ?? '',
  })

  function set<K extends keyof LongTermVisionInput>(k: K, v: LongTermVisionInput[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updateLongTermVision(form)
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      setSavedAt(new Date())
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {savedAt && (
          <span className="text-[11px] text-emerald-600">
            저장됨 ({savedAt.toLocaleTimeString('ko-KR')})
          </span>
        )}
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Save className="mr-1 h-3.5 w-3.5" />
              비전 저장
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">5년 비전</CardTitle>
          <CardDescription>장기적 — 디안이 5년 후 어디 있을 것인가</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.five_year_vision ?? ''}
            onChange={(e) => set('five_year_vision', e.target.value)}
            rows={3}
            placeholder="예: 한국 인테리어 디자이너의 첫 번째 큐레이터 — 디자이너 80%가 디안의 룩북을 작업실에 비치"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">3년 비전</CardTitle>
          <CardDescription>중기 — 5년 비전으로 가는 중간 정착점</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={form.three_year_vision ?? ''}
            onChange={(e) => set('three_year_vision', e.target.value)}
            rows={3}
            placeholder="예: 럭셔리 라인 본격 출시. 인테리어 디자이너 300명 활성 거래처."
          />
          <div>
            <Label className="text-[11px]">측정 가능한 마일스톤 3~5개</Label>
            <Textarea
              value={form.three_year_milestones ?? ''}
              onChange={(e) => set('three_year_milestones', e.target.value)}
              rows={3}
              placeholder={`예:\n- 연 매출 30억\n- 인테리어 프로젝트 거래처 200곳 (현 50)\n- 럭셔리 라인 매출 5억`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">BHAG (큰 도전 목표)</CardTitle>
          <CardDescription>Collins — 10년 단위 큰 그림 (선택)</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.bhag ?? ''}
            onChange={(e) => set('bhag', e.target.value)}
            rows={2}
            placeholder="예: 한국 디자이너가 세계로 나갈 때 함께 가는 원단 파트너"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">핵심 가치 / 신념</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.core_values ?? ''}
            onChange={(e) => set('core_values', e.target.value)}
            rows={3}
            placeholder={`예:\n- 큐레이터의 시선\n- 디자이너 우선\n- 시간보다 기회비용`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">절대 양보하지 않는 것 (Non-Negotiables)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.non_negotiables ?? ''}
            onChange={(e) => set('non_negotiables', e.target.value)}
            rows={3}
            placeholder={`예:\n- 럭셔리 라인 할인 절대 금지\n- 약속한 납기 절대 어기지 않음\n- 거래처 피해 발생 시 즉시 조치`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">기원 / 시작 스토리</CardTitle>
          <CardDescription>회사가 왜 시작됐는가 — 직원·거래처 공유용</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.origin_story ?? ''}
            onChange={(e) => set('origin_story', e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>
    </>
  )
}

function AlignmentChecker({ goals }: { goals: GoalCheck[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function setAlignment(goalId: number, aligned: boolean) {
    startTransition(async () => {
      await updateGoalAlignment(goalId, { aligned_with_vision: aligned })
      router.refresh()
    })
  }
  function setImportance(goalId: number, score: number) {
    startTransition(async () => {
      await updateGoalAlignment(goalId, { importance_score: score })
      router.refresh()
    })
  }

  if (goals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">12주 목표 정합성 점검</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-slate-400">
            목표가 없습니다.{' '}
            <a href="/finance/cycle" className="text-blue-600 hover:underline">
              12주 대시보드
            </a>
            에서 추가하세요.
          </p>
        </CardContent>
      </Card>
    )
  }

  const alignedCount = goals.filter((g) => g.aligned_with_vision).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          12주 목표 정합성 점검 ({alignedCount}/{goals.length} 정렬)
        </CardTitle>
        <CardDescription>
          각 목표가 비전과 정렬되는지 + 중요도 평가 (PRD #1 ⑥)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {goals.map((g) => (
            <div
              key={g.id}
              className={cn(
                'rounded-md border p-3',
                g.aligned_with_vision === true
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : g.aligned_with_vision === false
                  ? 'border-rose-200 bg-rose-50/20'
                  : 'border-slate-200',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{g.title}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                      {g.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* 비전 정합성 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setAlignment(g.id, true)}
                      disabled={isPending}
                      className={cn(
                        'rounded px-2 py-1 text-[10px] flex items-center gap-1',
                        g.aligned_with_vision === true
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-emerald-100',
                      )}
                    >
                      <CheckCircle className="h-3 w-3" />
                      정렬
                    </button>
                    <button
                      onClick={() => setAlignment(g.id, false)}
                      disabled={isPending}
                      className={cn(
                        'rounded px-2 py-1 text-[10px] flex items-center gap-1',
                        g.aligned_with_vision === false
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-rose-100',
                      )}
                    >
                      <XCircle className="h-3 w-3" />
                      불일치
                    </button>
                  </div>

                  {/* 중요도 */}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setImportance(g.id, n)}
                        disabled={isPending}
                        className={cn(
                          'p-0.5',
                          n <= (g.importance_score ?? 0)
                            ? 'text-amber-500'
                            : 'text-slate-300 hover:text-amber-400',
                        )}
                      >
                        <Star
                          className={cn(
                            'h-3 w-3',
                            n <= (g.importance_score ?? 0) && 'fill-current',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
          💡 <strong>비전 정합성 체크리스트</strong>: 각 목표가 (1) 비전과 정렬되는가? (2) 자신·팀에게
          매우 중요한가? (3) 80% 달성으로 충분히 의미 있는가? (4) 측정 가능한가?
        </div>
      </CardContent>
    </Card>
  )
}
