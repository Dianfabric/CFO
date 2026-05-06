'use client'
/**
 * 신규 입고 등록 폼 (Stage 1)
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertCircle, Sparkles, Plus } from 'lucide-react'
import { createIntake } from '@/app/finance/operations/intake/actions'

export default function IntakeForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [runAI, setRunAI] = useState(true)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const colors = ((fd.get('colors') as string) ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    const name = String(fd.get('name') ?? '').trim()
    if (!name) {
      setError('샘플명을 입력하세요.')
      return
    }
    const priceStr = String(fd.get('estimated_unit_price') ?? '').trim()

    startTransition(async () => {
      const res = await createIntake({
        name,
        supplier: String(fd.get('supplier') ?? '').trim() || undefined,
        source: (fd.get('source') as 'domestic' | 'overseas') ?? 'domestic',
        arrival_date: (fd.get('arrival_date') as string) || undefined,
        sample_count: Number(fd.get('sample_count')) || 1,
        unit: (fd.get('unit') as string) || 'roll',
        material: String(fd.get('material') ?? '').trim() || undefined,
        colors,
        estimated_unit_price: priceStr ? Number(priceStr) : null,
        notes: String(fd.get('notes') ?? '').trim() || undefined,
        run_ai_eval: runAI,
      })

      if (res.ok && res.id) {
        router.push(`/finance/operations/intake/${res.id}`)
      } else {
        setError(res.error ?? '등록 실패')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardContent className="space-y-4 py-5">
          <div>
            <Label className="text-xs">샘플명 *</Label>
            <Input
              name="name"
              placeholder="예: 벨기에 BR-1842 워시드 리넨"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">공급처</Label>
              <Input name="supplier" placeholder="예: Libeco, 두몽 직물" />
            </div>
            <div>
              <Label className="text-xs">출처</Label>
              <select
                name="source"
                defaultValue="domestic"
                className="block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="domestic">🇰🇷 국내</option>
                <option value="overseas">🌍 해외</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">입고일</Label>
              <Input
                type="date"
                name="arrival_date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <Label className="text-xs">수량</Label>
              <Input type="number" name="sample_count" defaultValue={1} min={1} />
            </div>
            <div>
              <Label className="text-xs">단위</Label>
              <select
                name="unit"
                defaultValue="roll"
                className="block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="roll">roll (롤)</option>
                <option value="sheet">sheet (시트)</option>
                <option value="meter">meter (미터)</option>
                <option value="set">set (세트)</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs">소재</Label>
            <Input name="material" placeholder="예: 100% 워시드 리넨, 리넨/코튼 80/20" />
          </div>

          <div>
            <Label className="text-xs">컬러군 (쉼표 구분)</Label>
            <Input name="colors" placeholder="예: 아이보리, 그레이지, 모스, 인디고" />
          </div>

          <div>
            <Label className="text-xs">추정 단가 (원/단위)</Label>
            <Input
              type="number"
              name="estimated_unit_price"
              placeholder="예: 35000"
              step={1000}
            />
          </div>

          <div>
            <Label className="text-xs">메모 (공급처 코멘트, 특이사항)</Label>
            <Textarea
              name="notes"
              rows={3}
              placeholder="공급처 코멘트, 시장 반응, 직조사 인터뷰 발췌 등"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/30">
        <CardContent className="py-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={runAI}
              onChange={(e) => setRunAI(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <div className="flex-1 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                <Sparkles className="h-3.5 w-3.5" />
                AI 자동 평가 (Claude Sonnet 4.5)
              </div>
              <p className="mt-0.5 text-amber-800">
                입고 등록 직후 AI가 24셀 매트릭스 매핑 + 티어 + 적합 직업군 + 차별화
                포인트를 자동 추천합니다. 직원이 검토·수정 가능. (5~10초 소요)
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {runAI ? 'AI 평가 중... (5~10초)' : '등록 중...'}
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            입고 등록 + Stage 2 (평가) 진행
          </>
        )}
      </Button>
    </form>
  )
}
