'use client'

/**
 * AI Create — 상세페이지 위저드 폼 (Client Component)
 *
 * 단일 페이지 폼. 입력 → server action createRun() → /runs/[id] redirect.
 * "예시로 채우기" 버튼으로 premium/luxury 기본값 즉시 채울 수 있음.
 */
import { useState, useTransition } from 'react'
import { Sparkles, Loader2, AlertCircle, Wand2 } from 'lucide-react'
import type {
  WizardFormInput,
  DianTier,
  DianDivision,
  DianOccupation,
  PageLength,
} from '@/lib/v11-ai-create/types'

interface Props {
  submitAction: (input: WizardFormInput) => Promise<
    { ok: true; run_id: string } | { ok: false; error: string }
  >
  defaultFillPremium: WizardFormInput
  defaultFillLuxury: WizardFormInput
}

const TIER_OPTIONS: { value: DianTier; label: string; hint: string }[] = [
  { value: 'value', label: '저가', hint: '마진 20-30% · 가격 강조 OK' },
  { value: 'mid', label: '중가', hint: '마진 35-45% · 제한적 할인' },
  { value: 'premium', label: '프리미엄', hint: '마진 50-65% · 가치 강조' },
  { value: 'luxury', label: '럭셔리', hint: '마진 70-85% · Price upon request' },
]

const CATEGORY_OPTIONS: { value: DianDivision; label: string }[] = [
  { value: 'sofa', label: '소파원단' },
  { value: 'curtain', label: '커튼원단' },
  { value: 'wall', label: '벽원단' },
  { value: 'accessory', label: '소품원단' },
]

const OCCUPATION_OPTIONS: { value: DianOccupation; label: string }[] = [
  { value: 'interior_project', label: '인테리어 프로젝트' },
  { value: 'brand_furniture', label: '브랜드 가구' },
  { value: 'project_furniture', label: '프로젝트 가구' },
  { value: 'commercial_reupholster', label: '업소용 천갈이' },
  { value: 'curtain_styling', label: '커튼 스타일링' },
  { value: 'display', label: '디스플레이' },
]

const PAGE_LENGTH_OPTIONS: { value: PageLength; label: string; hint: string }[] = [
  { value: 'short', label: '짧게', hint: '약 7 섹션' },
  { value: 'medium', label: '중간', hint: '약 10 섹션' },
  { value: 'long', label: '길게', hint: '13 섹션 (full)' },
]

const EMPTY_INPUT: WizardFormInput = {
  product_name: '',
  category: 'curtain',
  material: '',
  colors: '',
  season: '',
  estimated_unit_price: null,
  target_occupations: [],
  target_tier: 'premium',
  key_selling_points: '',
  page_length: 'long',
  emotional: 7,
  formal: 8,
  visual_density: 7,
}

export default function WizardForm({
  submitAction,
  defaultFillPremium,
  defaultFillLuxury,
}: Props) {
  const [input, setInput] = useState<WizardFormInput>(EMPTY_INPUT)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function update<K extends keyof WizardFormInput>(key: K, value: WizardFormInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  function toggleOccupation(occ: DianOccupation) {
    setInput((prev) => {
      const has = prev.target_occupations.includes(occ)
      return {
        ...prev,
        target_occupations: has
          ? prev.target_occupations.filter((o) => o !== occ)
          : [...prev.target_occupations, occ],
      }
    })
  }

  function fillFrom(preset: WizardFormInput) {
    setInput(preset)
    setError(null)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await submitAction(input)
      // server action 이 성공 시 redirect throw → 여기 도달 안 함
      if (result && 'ok' in result && !result.ok) {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* ===== 예시로 채우기 ===== */}
      <div className="bg-card border border-[var(--color-hairline)] rounded-[14px] p-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[13px] tracking-[-0.012em] text-[var(--color-ink-muted-80)]">
          <Wand2 className="w-4 h-4 text-[var(--color-action)]" strokeWidth={1.8} />
          처음이라면, 예시로 채우기:
        </div>
        <button
          type="button"
          onClick={() => fillFrom(defaultFillPremium)}
          disabled={isPending}
          className="text-[13px] tracking-[-0.012em] text-[var(--color-action)] hover:underline disabled:opacity-50"
        >
          SS26 워시드 리넨 (Premium)
        </button>
        <span className="text-[var(--color-ink-muted-48)]">·</span>
        <button
          type="button"
          onClick={() => fillFrom(defaultFillLuxury)}
          disabled={isPending}
          className="text-[13px] tracking-[-0.012em] text-[var(--color-action)] hover:underline disabled:opacity-50"
        >
          SS26 Reserve (Luxury)
        </button>
      </div>

      {/* ===== 1. 제품 기본 ===== */}
      <Group title="제품 정보" hint="페이지에서 가장 자주 등장할 정보">
        <Field label="제품명" required>
          <input
            type="text"
            value={input.product_name}
            onChange={(e) => update('product_name', e.target.value)}
            placeholder="예: 디안 SS26 워시드 리넨"
            className={inputCls}
            disabled={isPending}
          />
        </Field>

        <Field label="카테고리" required>
          <Select
            value={input.category}
            onChange={(v) => update('category', v as DianDivision)}
            options={CATEGORY_OPTIONS}
            disabled={isPending}
          />
        </Field>

        <Field label="소재" required>
          <input
            type="text"
            value={input.material}
            onChange={(e) => update('material', e.target.value)}
            placeholder="예: 100% 워시드 리넨 (벨기에 직조)"
            className={inputCls}
            disabled={isPending}
          />
        </Field>

        <Field label="컬러" required hint="쉼표로 구분 — 예: 아이보리, 그레이지, 모스, 인디고">
          <input
            type="text"
            value={input.colors}
            onChange={(e) => update('colors', e.target.value)}
            placeholder="아이보리 (여명), 그레이지 (안개), ..."
            className={inputCls}
            disabled={isPending}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="시즌" required>
            <input
              type="text"
              value={input.season}
              onChange={(e) => update('season', e.target.value)}
              placeholder="예: SS26"
              className={inputCls}
              disabled={isPending}
            />
          </Field>

          <Field label="예상 단가 (원)" hint="luxury 는 비워둘 수 있음">
            <input
              type="number"
              value={input.estimated_unit_price ?? ''}
              onChange={(e) =>
                update(
                  'estimated_unit_price',
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              placeholder="55000"
              className={inputCls}
              disabled={isPending}
            />
          </Field>
        </div>
      </Group>

      {/* ===== 2. 24셀 + 4티어 ===== */}
      <Group title="포지셔닝" hint="24셀 매트릭스 + 4티어 매핑">
        <Field label="타겟 직업군" required hint="복수 선택 가능 — 페이지 톤에 반영">
          <div className="flex flex-wrap gap-2">
            {OCCUPATION_OPTIONS.map((opt) => {
              const selected = input.target_occupations.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleOccupation(opt.value)}
                  disabled={isPending}
                  className={`inline-flex h-9 items-center px-4 rounded-full text-[13px] tracking-[-0.012em] transition-all border ${
                    selected
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-card border-[var(--color-hairline)] text-foreground hover:border-foreground/40'
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="티어" required hint="페이지 톤·CTA·가격 정책이 자동 변주됨">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TIER_OPTIONS.map((opt) => {
              const selected = input.target_tier === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('target_tier', opt.value)}
                  disabled={isPending}
                  className={`text-left p-3 rounded-[12px] border transition-all ${
                    selected
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-card border-[var(--color-hairline)] hover:border-foreground/40'
                  } disabled:opacity-50`}
                >
                  <div className="text-[14px] font-semibold tracking-[-0.022em]">
                    {opt.label}
                  </div>
                  <div
                    className={`text-[11px] tracking-[-0.012em] mt-0.5 ${
                      selected ? 'text-background/70' : 'text-[var(--color-ink-muted-48)]'
                    }`}
                  >
                    {opt.hint}
                  </div>
                </button>
              )
            })}
          </div>
        </Field>
      </Group>

      {/* ===== 3. 셀링 포인트 ===== */}
      <Group title="셀링 포인트" hint="페이지에서 강조할 핵심 메시지 (줄 바꿈으로 구분)">
        <Field label="핵심 셀링 포인트">
          <textarea
            value={input.key_selling_points}
            onChange={(e) => update('key_selling_points', e.target.value)}
            placeholder={
              '벨기에 직조사 Libeco — 1858년부터 같은 손\n자연 워싱 4단계 — 첫 세탁 후의 결을 미리 만든다\n4가지 자연 컬러 — 여명·안개·숲·심해'
            }
            rows={5}
            className={textareaCls}
            disabled={isPending}
          />
        </Field>
      </Group>

      {/* ===== 4. 페이지 변주 ===== */}
      <Group title="페이지 변주" hint="길이 + 톤 슬라이더 — Claude 가 참고">
        <Field label="페이지 길이">
          <div className="grid grid-cols-3 gap-2">
            {PAGE_LENGTH_OPTIONS.map((opt) => {
              const selected = input.page_length === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('page_length', opt.value)}
                  disabled={isPending}
                  className={`text-center p-3 rounded-[12px] border transition-all ${
                    selected
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-card border-[var(--color-hairline)] hover:border-foreground/40'
                  } disabled:opacity-50`}
                >
                  <div className="text-[14px] font-semibold tracking-[-0.022em]">
                    {opt.label}
                  </div>
                  <div
                    className={`text-[11px] tracking-[-0.012em] mt-0.5 ${
                      selected ? 'text-background/70' : 'text-[var(--color-ink-muted-48)]'
                    }`}
                  >
                    {opt.hint}
                  </div>
                </button>
              )
            })}
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Slider
            label="감성"
            value={input.emotional}
            onChange={(v) => update('emotional', v)}
            disabled={isPending}
          />
          <Slider
            label="격식"
            value={input.formal}
            onChange={(v) => update('formal', v)}
            disabled={isPending}
          />
          <Slider
            label="시각 밀도"
            value={input.visual_density}
            onChange={(v) => update('visual_density', v)}
            disabled={isPending}
          />
        </div>
      </Group>

      {/* ===== 에러 ===== */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-[12px] bg-red-50 border border-red-200 text-red-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
          <p className="text-[13px] tracking-[-0.012em]">{error}</p>
        </div>
      )}

      {/* ===== 제출 ===== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
        <p className="text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] sm:mr-auto">
          예상 소요: 약 1-2분 (Claude API 응답 대기)
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-[15px] text-primary-foreground tracking-tight hover:bg-[#0058b3] active:scale-95 transition-all gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              생성 중...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" strokeWidth={2} />
              상세페이지 생성
            </>
          )}
        </button>
      </div>
    </form>
  )
}

// ============================================================
// 보조 컴포넌트
// ============================================================

const inputCls =
  'w-full h-11 rounded-[10px] bg-card border border-[var(--color-hairline)] px-4 text-[14px] tracking-[-0.012em] text-foreground placeholder:text-[var(--color-ink-muted-48)] focus:outline-none focus:border-foreground/40 transition-colors disabled:opacity-50'

const textareaCls =
  'w-full rounded-[10px] bg-card border border-[var(--color-hairline)] px-4 py-3 text-[14px] tracking-[-0.012em] text-foreground placeholder:text-[var(--color-ink-muted-48)] focus:outline-none focus:border-foreground/40 transition-colors resize-y disabled:opacity-50'

function Group({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-[var(--color-hairline)] rounded-[18px] p-6 sm:p-7 space-y-5">
      <div>
        <h3 className="text-[16px] font-semibold tracking-[-0.022em] text-foreground">
          {title}
        </h3>
        {hint && (
          <p className="text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] mt-1">
            {hint}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[13px] font-medium tracking-[-0.012em] text-foreground">
        {label}
        {required && <span className="text-[var(--color-action)] ml-1">*</span>}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] tracking-[-0.012em] text-[var(--color-ink-muted-48)]">
          {hint}
        </p>
      )}
    </div>
  )
}

function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      disabled={disabled}
      className={inputCls}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function Slider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[13px] font-medium tracking-[-0.012em] text-foreground">
          {label}
        </label>
        <span className="text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] font-mono">
          {value} / 10
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-[var(--color-action)] disabled:opacity-50"
      />
    </div>
  )
}
