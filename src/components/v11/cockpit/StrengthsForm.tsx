'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save, Loader2, Plus, X, Award, Clock, AlertCircle } from 'lucide-react'
import { updateStrengths, type StrengthsInput } from '@/app/finance/cockpit/actions'

export default function StrengthsForm({ defaults }: { defaults: StrengthsInput }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [strengths, setStrengths] = useState<string[]>(defaults.self_strengths ?? [])
  const [newStrength, setNewStrength] = useState('')
  const [description, setDescription] = useState(defaults.strengths_description ?? '')
  const [evidence, setEvidence] = useState(defaults.strengths_evidence ?? '')
  const [blindspots, setBlindspots] = useState(defaults.strengths_blindspots ?? '')
  const [goldenStart, setGoldenStart] = useState(defaults.golden_hours_start ?? '')
  const [goldenEnd, setGoldenEnd] = useState(defaults.golden_hours_end ?? '')

  function addStrength() {
    const v = newStrength.trim()
    if (!v) return
    setStrengths([...strengths, v])
    setNewStrength('')
  }

  function removeStrength(i: number) {
    setStrengths(strengths.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updateStrengths({
        self_strengths: strengths,
        strengths_description: description || null,
        strengths_evidence: evidence || null,
        strengths_blindspots: blindspots || null,
        golden_hours_start: goldenStart || null,
        golden_hours_end: goldenEnd || null,
      })
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
              저장
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

      {/* 강점 키워드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Award className="h-4 w-4 text-amber-500" />
            나의 강점 (3~5가지 권장)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {strengths.length === 0 ? (
              <span className="text-xs italic text-slate-400">아직 없음</span>
            ) : (
              strengths.map((s, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeStrength(i)}
                    className="hover:text-rose-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newStrength}
              onChange={(e) => setNewStrength(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addStrength()
                }
              }}
              placeholder="예: 패턴 인식, 큐레이션, 협상, 정량 분석..."
              className="text-xs"
            />
            <Button type="button" size="sm" variant="outline" onClick={addStrength}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              추가
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">강점 서술 (Description)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="각 강점을 한 문단으로 — 어떤 상황에서 발휘되는가?"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">증거·사례 (Evidence)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={4}
            placeholder="과거에 강점이 결과를 만들었던 구체적 사례 3개 이상 — 피드백 분석법"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">사각지대·약점 (Blindspots)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={blindspots}
            onChange={(e) => setBlindspots(e.target.value)}
            rows={3}
            placeholder="강점을 무력화하는 나쁜 습관·매너·약점. 시간 쓰지 말고 우회하거나 위임할 영역"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-blue-500" />
            골든 아워
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-slate-500">
            본인이 가장 집중되는 시간대 — 영업 활동·전략적 사고를 우선 배치
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <div className="space-y-1.5">
              <Label className="text-[11px]">시작 시각</Label>
              <Input
                type="time"
                value={goldenStart}
                onChange={(e) => setGoldenStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">종료 시각</Label>
              <Input
                type="time"
                value={goldenEnd}
                onChange={(e) => setGoldenEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
