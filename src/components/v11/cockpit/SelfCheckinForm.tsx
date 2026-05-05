'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Save, Loader2, Star, AlertCircle } from 'lucide-react'
import { upsertSelfCheckin, type SelfCheckinInput } from '@/app/finance/cockpit/actions'
import { cn } from '@/lib/utils'

const HABITS = [
  {
    key: 'time_management',
    label: '시간 관리',
    desc: '내 시간을 어디에 쓰는지 알고 통제하는가? 골든 아워를 잘 사수했는가?',
  },
  {
    key: 'contribution',
    label: '기여 (Contribution)',
    desc: '내가 회사·고객·팀에 어떤 기여를 했는가? 내 결과의 질을 어떻게 측정하는가?',
  },
  {
    key: 'strengths',
    label: '강점 활용',
    desc: '내 강점에 집중했는가? 약점을 보완하느라 시간 낭비하지 않았는가?',
  },
  {
    key: 'priorities',
    label: '우선순위',
    desc: '가장 중요한 것을 먼저 했는가? 두 번째 중요한 일은 안 했는가?',
  },
  {
    key: 'decisions',
    label: '의사결정',
    desc: '의사결정을 정형화했는가? 충분히 검증했는가? 80%만 결정하고 미루지는 않았는가?',
  },
]

interface DefaultValues {
  checkin_date?: string
  period_type?: string
  time_management_score?: number | null
  time_management_note?: string | null
  contribution_score?: number | null
  contribution_note?: string | null
  strengths_score?: number | null
  strengths_note?: string | null
  priorities_score?: number | null
  priorities_note?: string | null
  decisions_score?: number | null
  decisions_note?: string | null
  overall_reflection?: string | null
}

export default function SelfCheckinForm({ defaults }: { defaults: DefaultValues }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(defaults.checkin_date ?? today)
  const [periodType, setPeriodType] = useState(defaults.period_type ?? 'weekly')
  const [scores, setScores] = useState<Record<string, number | null>>({
    time_management: defaults.time_management_score ?? null,
    contribution: defaults.contribution_score ?? null,
    strengths: defaults.strengths_score ?? null,
    priorities: defaults.priorities_score ?? null,
    decisions: defaults.decisions_score ?? null,
  })
  const [notes, setNotes] = useState<Record<string, string>>({
    time_management: defaults.time_management_note ?? '',
    contribution: defaults.contribution_note ?? '',
    strengths: defaults.strengths_note ?? '',
    priorities: defaults.priorities_note ?? '',
    decisions: defaults.decisions_note ?? '',
  })
  const [overall, setOverall] = useState(defaults.overall_reflection ?? '')

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const input: SelfCheckinInput = {
        checkin_date: date,
        period_type: periodType,
        time_management_score: scores.time_management,
        time_management_note: notes.time_management || null,
        contribution_score: scores.contribution,
        contribution_note: notes.contribution || null,
        strengths_score: scores.strengths,
        strengths_note: notes.strengths || null,
        priorities_score: scores.priorities,
        priorities_note: notes.priorities || null,
        decisions_score: scores.decisions,
        decisions_note: notes.decisions || null,
        overall_reflection: overall || null,
      }
      const res = await upsertSelfCheckin(input)
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      setSavedAt(new Date())
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2">
            <div className="space-y-0.5">
              <Label className="text-[11px]">점검일</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">주기</Label>
              <Select value={periodType} onValueChange={(v) => setPeriodType(v ?? 'weekly')}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">일일</SelectItem>
                  <SelectItem value="weekly">주간</SelectItem>
                  <SelectItem value="monthly">월간</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

      {HABITS.map((h) => (
        <Card key={h.key}>
          <CardHeader>
            <CardTitle className="text-sm">{h.label}</CardTitle>
            <CardDescription className="text-xs">{h.desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-[11px]">점수 (1~5)</Label>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      setScores((p) => ({ ...p, [h.key]: scores[h.key] === n ? null : n }))
                    }
                    className={cn(
                      'p-1 transition',
                      n <= (scores[h.key] ?? 0) ? 'text-amber-500' : 'text-slate-300',
                      'hover:text-amber-400',
                    )}
                  >
                    <Star
                      className={cn('h-5 w-5', n <= (scores[h.key] ?? 0) && 'fill-current')}
                    />
                  </button>
                ))}
                <span className="ml-2 text-xs text-slate-500">
                  {scores[h.key] ? `${scores[h.key]} / 5` : '미평가'}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-[11px]">메모 / 구체적 사례</Label>
              <Textarea
                value={notes[h.key]}
                onChange={(e) => setNotes((p) => ({ ...p, [h.key]: e.target.value }))}
                rows={2}
                placeholder="이번 점검 기간 동안의 구체적 사례·반성"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-sm">종합 회고</CardTitle>
          <CardDescription>이번 점검 기간 한 문단 요약</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
            rows={4}
            placeholder="가장 잘한 것 1개 / 개선할 것 1개 / 다음 기간 가장 중요한 1개"
          />
        </CardContent>
      </Card>
    </div>
  )
}
