'use client'
/**
 * WAM 작성/편집 폼 (PRD #1 ④)
 *
 * - 점수표(Scorecard): 활성 사이클의 모든 목표 진행률 갱신
 * - 다음 주 우선순위: 자유 텍스트 행
 * - 블로커: 자유 텍스트
 * - 메모: 자유 텍스트
 *
 * 점수표 저장 시 goals.current_value도 동기화 옵션 제공.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Save,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { updateWAM, deleteWAM } from '@/app/finance/wam/actions'
import { cn } from '@/lib/utils'

export interface WAMRow {
  id: number
  cycle_id: number | null
  meeting_date: string
  week_number: number
  attendees: string[] | null
  scorecard: Record<string, ScoreEntry> | null
  next_week_priorities: string[] | null
  blockers: string | null
  notes: string | null
  created_at: string
}

interface ScoreEntry {
  current: number
  status: string // 'on_track' | 'at_risk' | 'behind'
  note?: string
}

export interface GoalLite {
  id: number
  category: string
  title: string
  target_value: number | null
  current_value: number | null
  unit: string | null
  is_leading_indicator: boolean
}

const STATUS_OPTIONS = [
  { value: 'on_track', label: '🟢 진행 중', tone: 'border-emerald-300 bg-emerald-50' },
  { value: 'at_risk', label: '🟡 주의', tone: 'border-amber-300 bg-amber-50' },
  { value: 'behind', label: '🔴 지연', tone: 'border-rose-300 bg-rose-50' },
]

export default function WAMForm({ wam, goals }: { wam: WAMRow; goals: GoalLite[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [meetingDate, setMeetingDate] = useState(wam.meeting_date)
  const [weekNumber, setWeekNumber] = useState<string>(String(wam.week_number))
  const [attendees, setAttendees] = useState<string>((wam.attendees ?? []).join(', '))
  const [priorities, setPriorities] = useState<string[]>(
    wam.next_week_priorities && wam.next_week_priorities.length > 0
      ? wam.next_week_priorities
      : [''],
  )
  const [blockers, setBlockers] = useState(wam.blockers ?? '')
  const [notes, setNotes] = useState(wam.notes ?? '')
  const [scorecard, setScorecard] = useState<Record<string, ScoreEntry>>(
    () => {
      const sc: Record<string, ScoreEntry> = {}
      for (const g of goals) {
        const existing = wam.scorecard?.[String(g.id)]
        sc[String(g.id)] = existing ?? {
          current: Number(g.current_value ?? 0),
          status: 'on_track',
          note: '',
        }
      }
      return sc
    },
  )
  const [applyToGoals, setApplyToGoals] = useState(true)

  function updateScore(goalId: number, patch: Partial<ScoreEntry>) {
    setScorecard((prev) => ({
      ...prev,
      [String(goalId)]: { ...prev[String(goalId)], ...patch } as ScoreEntry,
    }))
  }

  function addPriority() {
    setPriorities([...priorities, ''])
  }
  function setPriority(i: number, val: string) {
    setPriorities(priorities.map((p, idx) => (idx === i ? val : p)))
  }
  function removePriority(i: number) {
    setPriorities(priorities.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updateWAM({
        id: wam.id,
        meeting_date: meetingDate,
        week_number: parseInt(weekNumber, 10) || 1,
        attendees: attendees
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        scorecard,
        next_week_priorities: priorities.map((p) => p.trim()).filter(Boolean),
        blockers: blockers.trim() || null,
        notes: notes.trim() || null,
        apply_to_goals: applyToGoals,
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
    if (!confirm('이 WAM 회의록을 삭제하시겠습니까?')) return
    startTransition(async () => {
      const res = await deleteWAM(wam.id)
      if (!res.ok) {
        setError(res.error ?? '삭제 실패')
        return
      }
      router.push('/finance/wam')
    })
  }

  return (
    <div className="space-y-4">
      {/* 상단 액션 */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
              Week {weekNumber} / 12
            </span>
            <span className="text-xs text-slate-500">
              회의일: {meetingDate} · 목표 {goals.length}개 점검
            </span>
          </div>
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="text-[11px] text-emerald-600">
                저장됨 ({savedAt.toLocaleTimeString('ko-KR')})
              </span>
            )}
            <Button size="sm" onClick={handleSave} disabled={isPending}>
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
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 회의 메타 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">회의 정보</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="wam-date">회의일</Label>
            <Input
              id="wam-date"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wam-week">주차 (1~12)</Label>
            <Input
              id="wam-week"
              type="number"
              min={1}
              max={12}
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wam-att">참석자 (쉼표 구분)</Label>
            <Input
              id="wam-att"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="대표, 마케팅팀장"
            />
          </div>
        </CardContent>
      </Card>

      {/* 점수표 (Scorecard) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">목표 점수표 (Scorecard)</CardTitle>
          <CardDescription>
            12주 목표의 이번 주까지 진행 상황 + 상태 평가. 80% 기준선 통과 여부가 핵심.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              현재 사이클에 목표가 없습니다. 먼저{' '}
              <a href="/finance/cycle" className="text-blue-600 hover:underline">
                12주 대시보드
              </a>
              에서 목표를 추가하세요.
            </p>
          ) : (
            <div className="space-y-3">
              {goals.map((g) => {
                const score = scorecard[String(g.id)]
                const target = Number(g.target_value) || 0
                const cur = score?.current ?? 0
                const ratio = target > 0 ? (cur / target) * 100 : 0
                const passed80 = cur >= target * 0.8
                const statusOpt = STATUS_OPTIONS.find((o) => o.value === score?.status)

                return (
                  <div
                    key={g.id}
                    className={cn(
                      'rounded-md border p-3 transition',
                      statusOpt?.tone ?? 'border-slate-200 bg-white',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            {g.is_leading_indicator ? '선행' : '후행'} · {g.category}
                          </span>
                        </div>
                        <h3 className="mt-0.5 truncate font-semibold text-slate-800">
                          {g.title}
                        </h3>
                      </div>
                      {passed80 && (
                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">현재 수치</Label>
                        <Input
                          type="number"
                          value={cur}
                          onChange={(e) =>
                            updateScore(g.id, { current: Number(e.target.value) })
                          }
                          className="h-8 text-xs"
                        />
                        <p className="text-[10px] tabular-nums text-slate-500">
                          / {target.toLocaleString()} {g.unit ?? ''} ·{' '}
                          <strong
                            className={cn(passed80 ? 'text-emerald-600' : 'text-slate-700')}
                          >
                            {ratio.toFixed(0)}%
                          </strong>
                        </p>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px]">상태</Label>
                        <select
                          value={score?.status ?? 'on_track'}
                          onChange={(e) =>
                            updateScore(g.id, { status: e.target.value })
                          }
                          className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-1">
                        <Label className="text-[10px]">메모 (선택)</Label>
                        <Input
                          value={score?.note ?? ''}
                          onChange={(e) =>
                            updateScore(g.id, { note: e.target.value })
                          }
                          placeholder="이번 주 변화·이슈"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* 진행률 바 */}
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          'h-full transition-all',
                          passed80 ? 'bg-emerald-500' : ratio >= 50 ? 'bg-amber-500' : 'bg-rose-400',
                        )}
                        style={{ width: `${Math.min(ratio, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}

              <label className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 p-2 text-xs text-blue-800">
                <input
                  type="checkbox"
                  checked={applyToGoals}
                  onChange={(e) => setApplyToGoals(e.target.checked)}
                />
                <span>
                  저장 시 <code className="rounded bg-white px-1">goals.current_value</code>도 함께
                  갱신 — 12주 대시보드에 즉시 반영
                </span>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 다음 주 우선순위 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">다음 주 우선순위</CardTitle>
          <CardDescription>위대한 12주 — 단순화: 3~5개 행동만</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {priorities.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                  {i + 1}
                </span>
                <Input
                  value={p}
                  onChange={(e) => setPriority(i, e.target.value)}
                  placeholder="예: 인테리어 디자이너 5명에 샘플북 발송"
                  className="text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                  onClick={() => removePriority(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {priorities.length < 7 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPriority}
                className="w-full"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                항목 추가
              </Button>
            )}
            {priorities.length >= 5 && (
              <p className="text-[11px] text-amber-700">
                ⚠ 5개 초과 — 단순화를 위해 3~5개 권장
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 블로커 + 메모 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              블로커 / 위험 신호
            </CardTitle>
            <CardDescription>
              진행 막힘, 도움이 필요한 부분, 위기 신호
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              rows={4}
              placeholder="예: 원단 공급사 납기 지연 — 5월 대량 주문 영향. 해결책 필요."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-slate-500" />
              회의 메모 / 결정 사항
            </CardTitle>
            <CardDescription>
              자유 메모. 이후 사이클 회고 자료가 됨.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="예: 지난 주 신규 거래처 2건 (인테리어 프로젝트). 인스타 업로드 효과 확인."
            />
          </CardContent>
        </Card>
      </div>

      {/* 삭제 */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          className="text-rose-600 hover:bg-rose-50"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          이 회의록 삭제
        </Button>
      </div>
    </div>
  )
}
