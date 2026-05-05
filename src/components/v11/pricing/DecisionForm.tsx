'use client'
/**
 * 4단계 가격 의사결정 폼 (PRD #4 ③)
 *
 * 4개 섹션을 모두 채우면 "승인 요청" 가능.
 * 승인 후 90일 뒤 검증 (validation_notes + quality_score).
 *
 * 각 step은 JSONB로 저장 — 구조화된 키-값.
 */
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
import {
  Loader2,
  Save,
  CheckCircle,
  Trash2,
  AlertCircle,
  Star,
  Lock,
  Unlock,
} from 'lucide-react'
import {
  upsertDecision,
  approveDecision,
  validateDecision,
  deleteDecision,
} from '@/app/finance/pricing/actions'
import { cn } from '@/lib/utils'

export interface DecisionRow {
  id: number
  decision_date: string
  type: string
  target_product_id: number | null
  target_line_id: number | null
  target_client_id: number | null
  previous_price: number | null
  decided_price: number | null
  decision_rationale: string | null
  step1_strategy: Record<string, unknown> | null
  step2_analysis: Record<string, unknown> | null
  step3_decision: Record<string, unknown> | null
  step4_execution: Record<string, unknown> | null
  ceo_approved: boolean
  approved_at: string | null
  validation_due_date: string | null
  validation_completed: boolean
  validation_notes: string | null
  quality_score: number | null
}

const TYPE_LABEL: Record<string, string> = {
  new_product: '신제품 가격',
  price_increase: '가격 인상',
  price_decrease: '가격 인하',
  discount: '할인 정책',
  differentiation: '거래처 차별화',
}
const TYPE_VALUES = Object.keys(TYPE_LABEL)

interface Step1 {
  positioning?: string
  margin_target?: string
  why_now?: string
}
interface Step2 {
  cost?: string
  competitor?: string
  willingness_to_pay?: string
}
interface Step3 {
  candidates?: string
  simulation?: string
}
interface Step4 {
  effective_date?: string
  psychology?: string
  comm_plan?: string
}

export default function DecisionForm({ decision }: { decision: DecisionRow }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const locked = decision.ceo_approved
  const validated = decision.validation_completed

  const [type, setType] = useState(decision.type)
  const [decisionDate, setDecisionDate] = useState(decision.decision_date)
  const [previousPrice, setPreviousPrice] = useState<string>(
    decision.previous_price != null ? String(decision.previous_price) : '',
  )
  const [decidedPrice, setDecidedPrice] = useState<string>(
    decision.decided_price != null ? String(decision.decided_price) : '',
  )
  const [rationale, setRationale] = useState(decision.decision_rationale ?? '')

  const initial1 = (decision.step1_strategy ?? {}) as Step1
  const initial2 = (decision.step2_analysis ?? {}) as Step2
  const initial3 = (decision.step3_decision ?? {}) as Step3
  const initial4 = (decision.step4_execution ?? {}) as Step4

  const [s1, setS1] = useState<Step1>(initial1)
  const [s2, setS2] = useState<Step2>(initial2)
  const [s3, setS3] = useState<Step3>(initial3)
  const [s4, setS4] = useState<Step4>(initial4)

  // 검증 상태
  const [valNotes, setValNotes] = useState(decision.validation_notes ?? '')
  const [valScore, setValScore] = useState<number>(decision.quality_score ?? 0)

  function isStepFilled(step: Record<string, unknown>): boolean {
    return Object.values(step).some((v) => v && String(v).trim().length > 0)
  }

  const completedSteps = [
    isStepFilled(s1 as unknown as Record<string, unknown>),
    isStepFilled(s2 as unknown as Record<string, unknown>),
    isStepFilled(s3 as unknown as Record<string, unknown>),
    isStepFilled(s4 as unknown as Record<string, unknown>),
  ]
  const completedCount = completedSteps.filter(Boolean).length
  const allComplete = completedCount === 4

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await upsertDecision({
        id: decision.id,
        type,
        decision_date: decisionDate,
        previous_price: previousPrice ? Number(previousPrice) : null,
        decided_price: decidedPrice ? Number(decidedPrice) : null,
        decision_rationale: rationale,
        step1_strategy: s1 as unknown as Record<string, unknown>,
        step2_analysis: s2 as unknown as Record<string, unknown>,
        step3_decision: s3 as unknown as Record<string, unknown>,
        step4_execution: s4 as unknown as Record<string, unknown>,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      setSavedAt(new Date())
      router.refresh()
    })
  }

  function handleApprove() {
    if (!allComplete) {
      setError('4단계가 모두 채워져야 승인 가능합니다.')
      return
    }
    if (!confirm('이 결정을 CEO 승인으로 확정하시겠습니까?\n승인 후 90일 후 검증이 필요합니다.')) return
    setError(null)
    startTransition(async () => {
      const res = await approveDecision(decision.id)
      if (!res.ok) {
        setError(res.error ?? '승인 실패')
        return
      }
      router.refresh()
    })
  }

  function handleValidate() {
    if (valScore < 1) {
      setError('품질 점수(1~5)를 선택해 주세요.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await validateDecision(decision.id, valNotes, valScore)
      if (!res.ok) {
        setError(res.error ?? '검증 실패')
        return
      }
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('이 결정을 삭제하시겠습니까?')) return
    startTransition(async () => {
      const res = await deleteDecision(decision.id)
      if (!res.ok) {
        setError(res.error ?? '삭제 실패')
        return
      }
      router.push('/finance/pricing')
    })
  }

  return (
    <div className="space-y-4">
      {/* 상단 상태 표시 */}
      <Card>
        <CardContent className="space-y-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {locked ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">
                  <Lock className="h-3 w-3" />
                  CEO 승인 완료
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                  <Unlock className="h-3 w-3" />
                  작성 중 (미승인)
                </span>
              )}
              {validated && (
                <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700">
                  <CheckCircle className="h-3 w-3" />
                  90일 검증 완료
                </span>
              )}
              <span className="text-[11px] text-slate-500">
                4단계 진행: <strong>{completedCount}/4</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {savedAt && (
                <span className="text-[11px] text-emerald-600">
                  저장됨 ({savedAt.toLocaleTimeString('ko-KR')})
                </span>
              )}
              {!locked && (
                <>
                  <Button size="sm" variant="outline" onClick={handleSave} disabled={isPending}>
                    <Save className="mr-1 h-3.5 w-3.5" />
                    저장
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={!allComplete || isPending}
                  >
                    <CheckCircle className="mr-1 h-3.5 w-3.5" />
                    CEO 승인
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* 진행 바 */}
          <div className="grid grid-cols-4 gap-1">
            {completedSteps.map((done, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full',
                  done ? 'bg-emerald-500' : 'bg-slate-200',
                )}
              />
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>유형</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? type)} disabled={locked}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {TYPE_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>결정일</Label>
              <Input
                type="date"
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
                disabled={locked}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>이전 가격 (원)</Label>
              <Input
                type="number"
                value={previousPrice}
                onChange={(e) => setPreviousPrice(e.target.value)}
                disabled={locked}
                placeholder="예: 25000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>결정 가격 (원)</Label>
              <Input
                type="number"
                value={decidedPrice}
                onChange={(e) => setDecidedPrice(e.target.value)}
                disabled={locked}
                placeholder="예: 28000"
              />
              {previousPrice && decidedPrice && (
                <p className="text-[11px] text-slate-500">
                  변화율:{' '}
                  <strong
                    className={
                      Number(decidedPrice) > Number(previousPrice)
                        ? 'text-rose-600'
                        : 'text-emerald-600'
                    }
                  >
                    {(((Number(decidedPrice) - Number(previousPrice)) /
                      Number(previousPrice)) *
                      100).toFixed(1)}
                    %
                  </strong>
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>결정 핵심 근거 (요약)</Label>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={2}
              disabled={locked}
              placeholder="한 문단 요약 — 4단계 상세는 아래에"
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 1 */}
      <StepSection
        step={1}
        title="전략 (Why)"
        description="포지셔닝과 이익 목표를 명확히 정합니다."
        complete={completedSteps[0]}
        locked={locked}
      >
        <Field
          label="포지셔닝"
          help="이 가격이 4티어 어디에 속하는가? 그 라인의 가치가 정당화되는가?"
          value={s1.positioning ?? ''}
          onChange={(v) => setS1({ ...s1, positioning: v })}
          disabled={locked}
        />
        <Field
          label="이익 목표"
          help="목표 마진율 또는 절대 이익 (예: 마진 50% 유지, 또는 라인 매출 1,000만원/월)"
          value={s1.margin_target ?? ''}
          onChange={(v) => setS1({ ...s1, margin_target: v })}
          disabled={locked}
        />
        <Field
          label="지금 변경하는 이유"
          help="왜 지금? 원가 상승? 시장 변화? 경쟁 대응? 한 문장으로 정리."
          value={s1.why_now ?? ''}
          onChange={(v) => setS1({ ...s1, why_now: v })}
          disabled={locked}
        />
      </StepSection>

      {/* Step 2 */}
      <StepSection
        step={2}
        title="시장 분석 (Where)"
        description="원가, 경쟁사, 고객 지불용의를 분석합니다."
        complete={completedSteps[1]}
        locked={locked}
      >
        <Field
          label="원가 분석"
          help="단위 원가 + 변동/고정 분리. (예: 매입 12,000 + 운송 1,500 + 가공 2,000 = 15,500)"
          value={s2.cost ?? ''}
          onChange={(v) => setS2({ ...s2, cost: v })}
          disabled={locked}
        />
        <Field
          label="경쟁사 가격"
          help="유사 라인 시장가 — 직접 경쟁 1~3개사 인용"
          value={s2.competitor ?? ''}
          onChange={(v) => setS2({ ...s2, competitor: v })}
          disabled={locked}
        />
        <Field
          label="고객 지불용의 (Willingness to Pay)"
          help="주요 거래처가 이 가격을 받아들일 가능성. 인터뷰·과거 데이터·인스타 반응 등."
          value={s2.willingness_to_pay ?? ''}
          onChange={(v) => setS2({ ...s2, willingness_to_pay: v })}
          disabled={locked}
        />
      </StepSection>

      {/* Step 3 */}
      <StepSection
        step={3}
        title="가격 결정 (What)"
        description="후보 가격을 비교하고 최종 가격을 결정합니다."
        complete={completedSteps[2]}
        locked={locked}
      >
        <Field
          label="후보 가격 (3개 권장)"
          help="예: A) 28,000 (마진 45%), B) 32,000 (마진 53%), C) 35,000 (마진 60%)"
          value={s3.candidates ?? ''}
          onChange={(v) => setS3({ ...s3, candidates: v })}
          disabled={locked}
          multiline
        />
        <Field
          label="시뮬레이션 결과"
          help="각 후보별 예상 매출·이익. 가격 탄력성 가정 명시. 위험 시나리오."
          value={s3.simulation ?? ''}
          onChange={(v) => setS3({ ...s3, simulation: v })}
          disabled={locked}
          multiline
        />
      </StepSection>

      {/* Step 4 */}
      <StepSection
        step={4}
        title="실행 (How)"
        description="시행일, 가격 심리학, 가치 소통 계획을 세웁니다."
        complete={completedSteps[3]}
        locked={locked}
      >
        <Field
          label="시행일"
          help="언제부터 새 가격이 적용되는가? 기존 거래는 어떻게 처리하는가?"
          value={s4.effective_date ?? ''}
          onChange={(v) => setS4({ ...s4, effective_date: v })}
          disabled={locked}
        />
        <Field
          label="가격 심리학 적용"
          help="문턱가격(9.99), 라운딩, 묶음 가격, anchor 가격, 비교 강조 등 어떤 기법?"
          value={s4.psychology ?? ''}
          onChange={(v) => setS4({ ...s4, psychology: v })}
          disabled={locked}
        />
        <Field
          label="가치 소통 계획"
          help="기존 거래처에게 어떻게 알릴 것인가? 공문? 미팅? 인스타 발표? 메시지 톤은?"
          value={s4.comm_plan ?? ''}
          onChange={(v) => setS4({ ...s4, comm_plan: v })}
          disabled={locked}
          multiline
        />
      </StepSection>

      {/* 90일 검증 (승인된 결정만) */}
      {locked && (
        <Card className={validated ? 'border-emerald-200 bg-emerald-50/50' : 'border-blue-200'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              {validated ? (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              ) : (
                <Star className="h-4 w-4 text-blue-500" />
              )}
              90일 검증 (결과의 질)
            </CardTitle>
            <CardDescription className="text-xs">
              검증 예정일: {decision.validation_due_date ?? '—'} · 결과 vs 예측 비교 + 1~5점 품질 점수
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="val-notes">검증 메모</Label>
              <Textarea
                id="val-notes"
                value={valNotes}
                onChange={(e) => setValNotes(e.target.value)}
                rows={3}
                disabled={validated}
                placeholder="실제 매출·이익이 예측 대비 어땠는가? 거래처 반응? 배운 점?"
              />
            </div>

            <div className="space-y-1.5">
              <Label>품질 점수 (1~5)</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => !validated && setValScore(n)}
                    disabled={validated}
                    className={cn(
                      'p-1 transition',
                      n <= valScore ? 'text-amber-500' : 'text-slate-300',
                      !validated && 'hover:text-amber-400',
                    )}
                  >
                    <Star className={cn('h-5 w-5', n <= valScore && 'fill-current')} />
                  </button>
                ))}
                <span className="ml-2 text-xs text-slate-500">
                  {valScore > 0 ? `${valScore} / 5` : '미평가'}
                </span>
              </div>
            </div>

            {!validated && (
              <Button onClick={handleValidate} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    검증 확정
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* 삭제 (미승인만) */}
      {!locked && (
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
            결정 삭제
          </Button>
        </div>
      )}
    </div>
  )
}

function StepSection({
  step,
  title,
  description,
  complete,
  locked,
  children,
}: {
  step: number
  title: string
  description: string
  complete: boolean
  locked: boolean
  children: React.ReactNode
}) {
  return (
    <Card
      className={cn(
        complete && 'border-emerald-200',
        !complete && 'border-slate-200',
        locked && 'opacity-90',
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              complete ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600',
            )}
          >
            {complete ? <CheckCircle className="h-3.5 w-3.5" /> : step}
          </span>
          Step {step}: {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

function Field({
  label,
  help,
  value,
  onChange,
  disabled,
  multiline,
}: {
  label: string
  help?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  multiline?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder={help}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={help}
        />
      )}
    </div>
  )
}
