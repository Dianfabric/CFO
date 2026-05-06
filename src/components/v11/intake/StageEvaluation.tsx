'use client'
/**
 * Stage 2 — 평가 폼
 * AI 추천을 받아 채워진 채로 시작하고, 직원이 수정 후 저장 → Stage 3 진입
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  Save,
  Wand2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import {
  saveEvaluation,
  runAIEvaluation,
} from '@/app/finance/operations/intake/actions'
import type { Division, Tier, Occupation } from '@/lib/v11-intake/types'

interface SampleRow {
  id: number
  division: string | null
  recommended_tier: string | null
  recommended_occupations: string[] | null
  competitive_score: number | null
  differentiator: string | null
  risk_note: string | null
  ai_evaluation: { reasoning?: string } | null
}

const DIVISIONS: { key: Division; label: string }[] = [
  { key: 'sofa', label: '소파' },
  { key: 'curtain', label: '커튼' },
  { key: 'wall', label: '벽' },
  { key: 'accessory', label: '소품' },
]

const TIERS: { key: Tier; label: string }[] = [
  { key: 'value', label: '저가' },
  { key: 'mid', label: '중가' },
  { key: 'premium', label: '프리미엄' },
  { key: 'luxury', label: '럭셔리' },
]

const OCCUPATIONS: { key: Occupation; label: string }[] = [
  { key: 'interior_project', label: '인테리어 프로젝트' },
  { key: 'brand_furniture', label: '브랜드 가구' },
  { key: 'project_furniture', label: '프로젝트 가구' },
  { key: 'commercial_reupholster', label: '천갈이' },
  { key: 'curtain_styling', label: '커튼 스타일링' },
  { key: 'display', label: '디스플레이' },
]

export default function StageEvaluation({ sample }: { sample: SampleRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [aiPending, setAiPending] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [division, setDivision] = useState<Division | ''>(
    (sample.division as Division) ?? '',
  )
  const [tier, setTier] = useState<Tier | ''>(
    (sample.recommended_tier as Tier) ?? '',
  )
  const [occupations, setOccupations] = useState<Occupation[]>(
    (sample.recommended_occupations as Occupation[]) ?? [],
  )
  const [score, setScore] = useState<number>(sample.competitive_score ?? 3)
  const [differentiator, setDifferentiator] = useState(sample.differentiator ?? '')
  const [riskNote, setRiskNote] = useState(sample.risk_note ?? '')

  const toggleOccupation = (k: Occupation) => {
    setOccupations((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    )
  }

  const handleAI = () => {
    setMsg(null)
    setAiPending(true)
    ;(async () => {
      const res = await runAIEvaluation(sample.id)
      setAiPending(false)
      if (res.ok) {
        setMsg({ ok: true, text: 'AI 평가 완료 — 결과를 새로 불러오는 중...' })
        router.refresh()
      } else {
        setMsg({ ok: false, text: res.error ?? 'AI 평가 실패' })
      }
    })()
  }

  const handleSubmit = (goNext: boolean) => {
    setMsg(null)
    if (!division || !tier) {
      setMsg({ ok: false, text: '제품군과 티어는 필수입니다.' })
      return
    }
    if (occupations.length === 0) {
      setMsg({ ok: false, text: '적합 직업군을 1개 이상 선택하세요.' })
      return
    }

    startTransition(async () => {
      const res = await saveEvaluation({
        sample_id: sample.id,
        division,
        recommended_tier: tier,
        recommended_occupations: occupations,
        competitive_score: score,
        differentiator: differentiator.trim() || undefined,
        risk_note: riskNote.trim() || undefined,
        go_next: goNext,
      })
      setMsg({
        ok: res.ok,
        text: res.ok
          ? goNext
            ? '평가 저장 + Stage 3 (기획) 으로 이동...'
            : '평가 저장 완료'
          : res.error ?? '저장 실패',
      })
      if (res.ok && goNext) {
        // Stage가 변경되면 페이지가 리렌더되어야 함
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900">Stage 2 · 평가</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAI}
          disabled={aiPending || pending}
        >
          {aiPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="mr-1 h-3.5 w-3.5" />
          )}
          AI 평가 다시 실행
        </Button>
      </div>

      {sample.ai_evaluation?.reasoning && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="py-3">
            <p className="text-[11px] font-bold uppercase text-amber-700">
              AI 평가 근거
            </p>
            <p className="mt-1 text-xs text-amber-900">{sample.ai_evaluation.reasoning}</p>
          </CardContent>
        </Card>
      )}

      <div>
        <Label className="text-xs">제품군 *</Label>
        <div className="mt-1 grid grid-cols-4 gap-2">
          {DIVISIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDivision(d.key)}
              className={`rounded-md border py-2 text-xs font-medium transition ${
                division === d.key
                  ? 'border-amber-400 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs">티어 *</Label>
        <div className="mt-1 grid grid-cols-4 gap-2">
          {TIERS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTier(t.key)}
              className={`rounded-md border py-2 text-xs font-medium transition ${
                tier === t.key
                  ? 'border-amber-400 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs">적합 직업군 (다중 선택) *</Label>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OCCUPATIONS.map((o) => {
            const checked = occupations.includes(o.key)
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => toggleOccupation(o.key)}
                className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                  checked
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {checked && '✓ '}
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <Label className="text-xs">경쟁력 점수 (1~5)</Label>
        <div className="mt-1 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-bold transition ${
                score >= n
                  ? 'border-amber-400 bg-amber-100 text-amber-900'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              ★
            </button>
          ))}
          <span className="ml-2 text-sm font-bold text-slate-700">{score}/5</span>
        </div>
      </div>

      <div>
        <Label className="text-xs">차별화 포인트 (한 줄)</Label>
        <Input
          value={differentiator}
          onChange={(e) => setDifferentiator(e.target.value)}
          placeholder="예: 벨기에 직조 결, 양면 사용 가능"
        />
      </div>

      <div>
        <Label className="text-xs">리스크 메모 (옵션)</Label>
        <Textarea
          value={riskNote}
          onChange={(e) => setRiskNote(e.target.value)}
          rows={2}
          placeholder="예: 단가 협상 어려움, 입고 안정성 미확인"
        />
      </div>

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
            msg.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSubmit(false)}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1 h-3.5 w-3.5" />
          )}
          저장만
        </Button>
        <Button onClick={() => handleSubmit(true)} disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="mr-1 h-3.5 w-3.5" />
          )}
          저장 + Stage 3 (기획) 으로
        </Button>
      </div>
    </div>
  )
}
