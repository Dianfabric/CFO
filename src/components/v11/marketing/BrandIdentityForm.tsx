'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { updateBrandIdentity, type BrandIdentityInput } from '@/app/finance/marketing/actions'

export interface BrandIdentityRow extends BrandIdentityInput {
  id: number
  updated_at: string
}

export default function BrandIdentityForm({ data }: { data: BrandIdentityRow }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [form, setForm] = useState<BrandIdentityInput>({
    big_idea: data.big_idea ?? '',
    brand_persona: data.brand_persona ?? '',
    voice_tone: data.voice_tone ?? '',
    story_origin: data.story_origin ?? '',
    story_mission: data.story_mission ?? '',
    story_vision: data.story_vision ?? '',
    visual_primary_color: data.visual_primary_color ?? '',
    visual_secondary_color: data.visual_secondary_color ?? '',
    visual_accent_color: data.visual_accent_color ?? '',
    visual_font_heading: data.visual_font_heading ?? '',
    visual_font_body: data.visual_font_body ?? '',
    visual_image_style: data.visual_image_style ?? '',
    visual_logo_url: data.visual_logo_url ?? '',
    target_persona_primary: data.target_persona_primary ?? '',
    target_persona_secondary: data.target_persona_secondary ?? '',
  })

  function set<K extends keyof BrandIdentityInput>(k: K, v: BrandIdentityInput[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await updateBrandIdentity(form)
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      setSavedAt(new Date())
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {savedAt && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600">
            <CheckCircle className="h-3 w-3" />
            저장됨 ({savedAt.toLocaleTimeString('ko-KR')})
          </span>
        )}
        <Button type="submit" disabled={isPending}>
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

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 빅 아이디어 + 페르소나 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">1. 빅 아이디어 + 브랜드 페르소나</CardTitle>
          <CardDescription>
            러셀 — 한 문장 빅 아이디어 / 캐릭터화된 브랜드 페르소나
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="big">빅 아이디어 (한 문장)</Label>
            <Textarea
              id="big"
              value={form.big_idea ?? ''}
              onChange={(e) => set('big_idea', e.target.value)}
              rows={2}
              placeholder="예: 공간의 가치를 결정짓는 소재의 품격 — 디안은 디자이너를 위한 큐레이터입니다."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="persona">브랜드 페르소나</Label>
            <Textarea
              id="persona"
              value={form.brand_persona ?? ''}
              onChange={(e) => set('brand_persona', e.target.value)}
              rows={3}
              placeholder="예: 디안은 30~50대 인테리어 전문가의 친구이자 동반자. 한국 전통 가옥의 결을 현대 공간에 녹여내는 큐레이터의 시선."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tone">톤·매너 (Voice & Tone)</Label>
            <Textarea
              id="tone"
              value={form.voice_tone ?? ''}
              onChange={(e) => set('voice_tone', e.target.value)}
              rows={2}
              placeholder="예: 격조 있고 신뢰감 있게. 지나치게 가볍지 않으나 창의적 영감을 줄 수 있는 어조."
            />
          </div>
        </CardContent>
      </Card>

      {/* 브랜드 스토리 (3막) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">2. 브랜드 스토리 (3막)</CardTitle>
          <CardDescription>맥키 — 기원·사명·비전 3막 구조</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>기원 (Origin) — 우리는 왜 시작했는가</Label>
            <Textarea
              value={form.story_origin ?? ''}
              onChange={(e) => set('story_origin', e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>사명 (Mission) — 매일 무엇을 위해 일하는가</Label>
            <Textarea
              value={form.story_mission ?? ''}
              onChange={(e) => set('story_mission', e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>비전 (Vision) — 어디로 향하는가</Label>
            <Textarea
              value={form.story_vision ?? ''}
              onChange={(e) => set('story_vision', e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* 타겟 페르소나 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">3. 타겟 페르소나</CardTitle>
          <CardDescription>
            룬·비숍 — 핵심 고객 1차·2차 페르소나 정의
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>1차 페르소나 (Primary)</Label>
            <Textarea
              value={form.target_persona_primary ?? ''}
              onChange={(e) => set('target_persona_primary', e.target.value)}
              rows={3}
              placeholder="예: 30~45세 인테리어 디자이너, 1인 사업자 또는 5명 이하 스튜디오 대표. 프로젝트당 평균 5~10가지 원단 선택. 인스타·핀터레스트로 영감 수집. 가격보다 차별화된 디자인을 우선."
            />
          </div>
          <div className="space-y-1.5">
            <Label>2차 페르소나 (Secondary)</Label>
            <Textarea
              value={form.target_persona_secondary ?? ''}
              onChange={(e) => set('target_persona_secondary', e.target.value)}
              rows={3}
              placeholder="예: 가구 브랜드 MD·디스플레이 담당자. 시즌 단위 룩북 기반 사전 선정. 안정적 공급 + 가격 + 일관된 품질이 우선."
            />
          </div>
        </CardContent>
      </Card>

      {/* 시각 정체성 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">4. 시각 정체성</CardTitle>
          <CardDescription>컬러·폰트·이미지 스타일 가이드</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>주 컬러</Label>
              <Input
                value={form.visual_primary_color ?? ''}
                onChange={(e) => set('visual_primary_color', e.target.value)}
                placeholder="#1E1E1E"
              />
            </div>
            <div className="space-y-1.5">
              <Label>보조 컬러</Label>
              <Input
                value={form.visual_secondary_color ?? ''}
                onChange={(e) => set('visual_secondary_color', e.target.value)}
                placeholder="#F5EFE0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>강조 컬러</Label>
              <Input
                value={form.visual_accent_color ?? ''}
                onChange={(e) => set('visual_accent_color', e.target.value)}
                placeholder="#A8794D"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>제목 폰트</Label>
              <Input
                value={form.visual_font_heading ?? ''}
                onChange={(e) => set('visual_font_heading', e.target.value)}
                placeholder="예: Pretendard / Noto Serif KR"
              />
            </div>
            <div className="space-y-1.5">
              <Label>본문 폰트</Label>
              <Input
                value={form.visual_font_body ?? ''}
                onChange={(e) => set('visual_font_body', e.target.value)}
                placeholder="예: Pretendard"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>이미지 스타일 가이드</Label>
            <Textarea
              value={form.visual_image_style ?? ''}
              onChange={(e) => set('visual_image_style', e.target.value)}
              rows={2}
              placeholder="예: 자연광 위주, 따뜻한 토널 톤. 거친 텍스처 강조. 사람보다 공간·소재 중심. 정리된 미니멀 구도."
            />
          </div>
          <div className="space-y-1.5">
            <Label>로고 이미지 URL</Label>
            <Input
              value={form.visual_logo_url ?? ''}
              onChange={(e) => set('visual_logo_url', e.target.value)}
              placeholder="https://..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 컬러 미리보기 */}
      {(form.visual_primary_color ||
        form.visual_secondary_color ||
        form.visual_accent_color) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">컬러 미리보기</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {[
                ['주', form.visual_primary_color],
                ['보조', form.visual_secondary_color],
                ['강조', form.visual_accent_color],
              ]
                .filter(([, v]) => v)
                .map(([label, color]) => (
                  <div key={label} className="text-center">
                    <div
                      className="h-16 w-24 rounded-md border border-slate-200"
                      style={{ backgroundColor: color || '#fff' }}
                    />
                    <div className="mt-1 text-[10px] text-slate-500">
                      {label} · {color}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </form>
  )
}
