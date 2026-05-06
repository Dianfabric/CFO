'use client'
/**
 * 영업자료 자동생성 위저드 (5단계)
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
} from 'lucide-react'
import { createMaterial } from '@/app/finance/sales/materials/actions'
import type {
  Tier,
  Occupation,
  ToneSettings,
} from '@/lib/v11-sales-materials/types'

interface ClientRow {
  id: number
  name: string
  occupation: string | null
  tier: string | null
}
interface ProductRow {
  id: number
  name: string
}
interface FrameworkRow {
  id: number
  key: string
  name: string
  summary: string | null
  recommended_tiers: string[]
  recommended_occupations: string[]
}
interface AssetRow {
  id: number
  kind: string
  title: string | null
  source: string
}

interface Props {
  clients: ClientRow[]
  products: ProductRow[]
  frameworks: FrameworkRow[]
  assets: AssetRow[]
}

const TIERS: { key: Tier; label: string; desc: string }[] = [
  { key: 'value', label: '저가', desc: '20-30% 마진, 가격 강조' },
  { key: 'mid', label: '중가', desc: '35-45% 마진, 가성비' },
  { key: 'premium', label: '프리미엄', desc: '50-65%, 가치/디자이너' },
  { key: 'luxury', label: '럭셔리', desc: '70-85%, 할인 금지' },
]

const OCCUPATIONS: { key: Occupation; label: string }[] = [
  { key: 'interior_project', label: '인테리어 프로젝트' },
  { key: 'brand_furniture', label: '브랜드 가구' },
  { key: 'project_furniture', label: '프로젝트 가구' },
  { key: 'commercial_reupholster', label: '업소용 천갈이' },
  { key: 'curtain_styling', label: '커튼 스타일링' },
  { key: 'display', label: '디스플레이' },
]

export default function Wizard({ clients, products, frameworks, assets }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [clientId, setClientId] = useState<number | null>(null)
  const [tier, setTier] = useState<Tier | ''>('')
  const [occupation, setOccupation] = useState<Occupation | ''>('')
  const [persona, setPersona] = useState('')

  // Step 2
  const [productId, setProductId] = useState<number | null>(null)
  const [productName, setProductName] = useState('')
  const [material, setMaterial] = useState('')
  const [colorsInput, setColorsInput] = useState('')
  const [season, setSeason] = useState('')
  const [estimatedPrice, setEstimatedPrice] = useState('')
  const [category, setCategory] = useState('')

  // Step 3
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([])

  // Step 4
  const [selectedAssets, setSelectedAssets] = useState<number[]>([])
  const [sourceText, setSourceText] = useState('')
  const [refUrls, setRefUrls] = useState<string[]>([''])

  // Step 5
  const [slideCount, setSlideCount] = useState(7)
  const [videoDurations, setVideoDurations] = useState<number[]>([15, 30])
  const [tone, setTone] = useState<ToneSettings>({
    emotional: 6,
    formal: 6,
    visual_density: 7,
  })
  const [title, setTitle] = useState('')

  // 거래처 선택 시 자동 매핑
  const onSelectClient = (id: string) => {
    const cid = id ? Number(id) : null
    setClientId(cid)
    if (cid) {
      const c = clients.find((x) => x.id === cid)
      if (c) {
        if (c.tier) setTier(c.tier as Tier)
        if (c.occupation) setOccupation(c.occupation as Occupation)
      }
    }
  }

  // 프레임워크 추천 (티어·직업군 기반)
  const recommendedFrameworks = frameworks
    .map((f) => {
      let score = 0
      if (tier && f.recommended_tiers?.includes(tier)) score += 2
      if (occupation && f.recommended_occupations?.includes(occupation)) score += 1
      return { f, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((s) => s.f.key)

  // Step 3 진입 시 자동 추천 적용
  const goToStep = (n: number) => {
    if (n === 3 && selectedFrameworks.length === 0 && recommendedFrameworks.length > 0) {
      setSelectedFrameworks(recommendedFrameworks)
    }
    setStep(n)
  }

  const toggleFramework = (key: string) => {
    setSelectedFrameworks((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  const toggleAsset = (id: number) => {
    setSelectedAssets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleVideoDuration = (d: number) => {
    setVideoDurations((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  }

  const handleSubmit = () => {
    setError(null)
    const colors = colorsInput
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    const finalTitle = title.trim() || `${productName} 영업자료`

    if (!productName.trim()) {
      setError('Step 2 에서 제품명을 입력하세요.')
      setStep(2)
      return
    }
    if (selectedFrameworks.length === 0) {
      setError('Step 3 에서 프레임워크를 1개 이상 선택하세요.')
      setStep(3)
      return
    }
    if (videoDurations.length === 0) {
      setError('Step 5 에서 영상 길이를 1개 이상 선택하세요.')
      return
    }

    startTransition(async () => {
      const res = await createMaterial({
        title: finalTitle,
        target_client_id: clientId,
        target_tier: (tier || null) as Tier | null,
        target_occupation: (occupation || null) as Occupation | null,
        target_persona: persona.trim() || null,
        product_id: productId,
        product_name_input: productName,
        product_attrs: {
          material: material || undefined,
          colors,
          season: season || undefined,
          estimated_unit_price: estimatedPrice ? Number(estimatedPrice) : undefined,
          category: category || undefined,
        },
        framework_keys: selectedFrameworks,
        tone,
        slide_count: slideCount,
        video_durations: videoDurations,
        asset_ids: selectedAssets.length ? selectedAssets : undefined,
        source_text: sourceText.trim() || undefined,
        reference_urls: refUrls.filter((u) => u.trim()),
      })

      if (res.ok && res.id) {
        router.push(`/finance/sales/materials/${res.id}`)
      } else {
        setError(res.error ?? '생성 실패')
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step >= n
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {step > n ? '✓' : n}
            </div>
            <div className="hidden text-[11px] font-medium text-slate-600 md:block">
              {['대상', '제품', '프레임워크', '소스', '생성'][n - 1]}
            </div>
            {n < 5 && (
              <div
                className={`h-0.5 flex-1 ${
                  step > n ? 'bg-amber-600' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 — 대상 */}
      {step === 1 && (
        <Card>
          <CardContent className="space-y-4 py-5">
            <h2 className="text-base font-bold text-slate-900">Step 1 · 대상 선택</h2>
            <p className="text-xs text-slate-500">
              거래처를 선택하면 24셀(직업군) + 4티어가 자동 매핑됩니다.
            </p>

            <div>
              <Label className="text-xs">거래처 (옵션)</Label>
              <select
                value={clientId ?? ''}
                onChange={(e) => onSelectClient(e.target.value)}
                className="block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">— 미지정 (일반 발송용) —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.tier ? ` [${c.tier}]` : ''}
                    {c.occupation ? ` · ${c.occupation}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs">티어</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TIERS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTier(t.key)}
                    className={`rounded-md border p-2 text-left text-xs transition ${
                      tier === t.key
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-slate-900">{t.label}</div>
                    <div className="text-[10px] text-slate-500">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">직업군</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {OCCUPATIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setOccupation(o.key)}
                    className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                      occupation === o.key
                        ? 'border-amber-400 bg-amber-50 text-amber-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">대상 페르소나 (옵션)</Label>
              <Input
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="예: 30~40대 미니멀 인테리어 디자이너, 클라이언트 평균 예산 5천 이상"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — 제품 */}
      {step === 2 && (
        <Card>
          <CardContent className="space-y-4 py-5">
            <h2 className="text-base font-bold text-slate-900">Step 2 · 제품 정보</h2>
            <p className="text-xs text-slate-500">
              기존 제품에서 선택하거나 신제품을 직접 입력하세요.
            </p>

            <div>
              <Label className="text-xs">기존 제품 선택 (옵션)</Label>
              <select
                value={productId ?? ''}
                onChange={(e) => {
                  const pid = e.target.value ? Number(e.target.value) : null
                  setProductId(pid)
                  if (pid) {
                    const p = products.find((x) => x.id === pid)
                    if (p) setProductName(p.name)
                  }
                }}
                className="block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">— 신규 제품 직접 입력 —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs">제품명 *</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="예: 디안 SS26 — 리넨 워시드 컬렉션"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">소재</Label>
                <Input
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="예: 100% 워시드 리넨"
                />
              </div>
              <div>
                <Label className="text-xs">시즌</Label>
                <Input
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  placeholder="예: SS26"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">컬러군 (쉼표 구분)</Label>
              <Input
                value={colorsInput}
                onChange={(e) => setColorsInput(e.target.value)}
                placeholder="예: 아이보리, 그레이지, 모스, 인디고"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">카테고리</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="예: 소파원단 / 커튼원단"
                />
              </div>
              <div>
                <Label className="text-xs">추정 단가 (원/단위)</Label>
                <Input
                  type="number"
                  value={estimatedPrice}
                  onChange={(e) => setEstimatedPrice(e.target.value)}
                  placeholder="예: 35000"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — 프레임워크 */}
      {step === 3 && (
        <Card>
          <CardContent className="space-y-3 py-5">
            <h2 className="text-base font-bold text-slate-900">Step 3 · 심리·인지과학 프레임워크</h2>
            {recommendedFrameworks.length > 0 && (
              <p className="text-xs text-slate-500">
                ⭐ 티어·직업군 기반 추천:{' '}
                {recommendedFrameworks
                  .map((k) => frameworks.find((f) => f.key === k)?.name)
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}

            <div className="grid gap-2">
              {frameworks.map((f) => {
                const checked = selectedFrameworks.includes(f.key)
                const recommended = recommendedFrameworks.includes(f.key)
                return (
                  <label
                    key={f.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
                      checked
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFramework(f.key)}
                      className="mt-1 h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {f.name}
                        </span>
                        {recommended && (
                          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">
                            ⭐ 추천
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-400">
                          {f.key}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">{f.summary}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — 소스 */}
      {step === 4 && (
        <Card>
          <CardContent className="space-y-4 py-5">
            <h2 className="text-base font-bold text-slate-900">Step 4 · 소스 자료</h2>
            <p className="text-xs text-slate-500">
              자료 라이브러리에서 선택하거나 URL/텍스트를 직접 입력하세요. 모두 옵션입니다.
            </p>

            {assets.length > 0 ? (
              <div>
                <Label className="text-xs">라이브러리에서 선택</Label>
                <div className="mt-1 grid max-h-60 gap-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                  {assets.map((a) => (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer items-center gap-2 rounded p-1.5 text-xs transition ${
                        selectedAssets.includes(a.id)
                          ? 'bg-amber-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAssets.includes(a.id)}
                        onChange={() => toggleAsset(a.id)}
                      />
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">
                        {a.kind}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {a.source === 'overseas' ? '🌍' : '🇰🇷'}
                      </span>
                      <span className="flex-1 truncate text-slate-800">
                        {a.title ?? '(제목 없음)'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-[11px] italic text-slate-500">
                자료 라이브러리가 비어있습니다. 라이브러리 페이지에서 먼저 자료를 등록하면 위저드에서 선택할 수 있습니다.
              </div>
            )}

            <div>
              <Label className="text-xs">참고 텍스트 (해외 기사 본문, 인터뷰 발췌 등)</Label>
              <Textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={5}
                placeholder="해외 직조사 인터뷰, 디자인 매거진 기사 본문 등을 붙여넣으세요. 5000자 이내."
                maxLength={5000}
              />
              <p className="mt-0.5 text-[10px] text-slate-400">
                {sourceText.length} / 5000
              </p>
            </div>

            <div>
              <Label className="text-xs">참고 URL (선택)</Label>
              {refUrls.map((url, i) => (
                <div key={i} className="mt-1 flex gap-2">
                  <Input
                    value={url}
                    onChange={(e) =>
                      setRefUrls((prev) => prev.map((u, idx) => (idx === i ? e.target.value : u)))
                    }
                    placeholder="https://example.com/article"
                  />
                  {refUrls.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 shrink-0 px-0"
                      onClick={() =>
                        setRefUrls((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => setRefUrls((prev) => [...prev, ''])}
              >
                <Plus className="mr-1 h-3 w-3" />
                URL 추가
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5 — 생성 옵션 + 실행 */}
      {step === 5 && (
        <Card>
          <CardContent className="space-y-5 py-5">
            <h2 className="text-base font-bold text-slate-900">Step 5 · 생성 옵션</h2>

            <div>
              <Label className="text-xs">자료 제목 (옵션)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`기본: ${productName} 영업자료`}
              />
            </div>

            <div>
              <Label className="text-xs">슬라이드 수</Label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {[5, 7, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSlideCount(n)}
                    className={`rounded-md border py-2 text-xs font-medium transition ${
                      slideCount === n
                        ? 'border-amber-400 bg-amber-50 text-amber-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {n}장
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">영상 스크립트 길이 (다중 선택)</Label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {[15, 30, 60].map((d) => {
                  const checked = videoDurations.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleVideoDuration(d)}
                      className={`rounded-md border py-2 text-xs font-medium transition ${
                        checked
                          ? 'border-amber-400 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {d}초
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-700">톤 미세 조정</p>
              <ToneSlider
                label="감성도"
                left="정보 위주"
                right="감성 강조"
                value={tone.emotional}
                onChange={(v) => setTone({ ...tone, emotional: v })}
              />
              <ToneSlider
                label="격조"
                left="친근"
                right="격조"
                value={tone.formal}
                onChange={(v) => setTone({ ...tone, formal: v })}
              />
              <ToneSlider
                label="비주얼 밀도"
                left="텍스트 위주"
                right="비주얼 위주"
                value={tone.visual_density}
                onChange={(v) => setTone({ ...tone, visual_density: v })}
              />
            </div>

            <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">생성 미리보기</p>
              <ul className="mt-1 space-y-0.5 text-amber-800">
                <li>• 제품: {productName || '(미입력)'}</li>
                <li>
                  • 대상: {tier || '미지정'} · {occupation || '미지정'}
                </li>
                <li>
                  • 프레임워크 {selectedFrameworks.length}개:{' '}
                  {selectedFrameworks
                    .map((k) => frameworks.find((f) => f.key === k)?.name)
                    .filter(Boolean)
                    .join(', ') || '(없음)'}
                </li>
                <li>
                  • 슬라이드 {slideCount}장 · 영상 {videoDurations.join('·')}초
                </li>
                <li>• 자산 {selectedAssets.length}건</li>
              </ul>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={pending}
              className="w-full bg-amber-600 hover:bg-amber-700"
              size="lg"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claude 가 자료를 생성 중입니다... (10~30초)
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  자료 생성 시작
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToStep(Math.max(1, step - 1))}
          disabled={step === 1 || pending}
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          이전
        </Button>

        {step < 5 && (
          <Button size="sm" onClick={() => goToStep(Math.min(5, step + 1))}>
            다음
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

function ToneSlider({
  label,
  left,
  right,
  value,
  onChange,
}: {
  label: string
  left: string
  right: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span className="font-semibold text-slate-700">{label}</span>
        <span>{value}/10</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-amber-600"
      />
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  )
}
