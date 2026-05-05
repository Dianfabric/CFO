'use client'
/**
 * 제품 라인 추가/편집 다이얼로그 (PRD #4 ② 가치 정의 워크북)
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Loader2, Save, AlertCircle, Trash2 } from 'lucide-react'
import {
  PRICE_TIER_LABEL,
  PRICE_TIER_VALUES,
  DIVISION_LABEL,
  DIVISION_VALUES,
} from '@/lib/v11-labels'
import {
  upsertProductLine,
  deleteProductLine,
} from '@/app/finance/positioning/actions'

export interface ProductLineRow {
  id: number
  name: string
  brand_name: string | null
  tier: string
  division: string
  value_essential: string | null
  value_extended: string | null
  value_roi_note: string | null
  active: boolean
}

export default function ProductLineEditDialog({
  line,
  defaultTier,
  defaultDivision,
  open,
  onOpenChange,
}: {
  line: ProductLineRow | null
  defaultTier?: string
  defaultDivision?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <FormBody
          key={line?.id ?? `new-${defaultTier}-${defaultDivision}`}
          line={line}
          defaultTier={defaultTier}
          defaultDivision={defaultDivision}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function FormBody({
  line,
  defaultTier = 'mid',
  defaultDivision = 'sofa',
  onClose,
}: {
  line: ProductLineRow | null
  defaultTier?: string
  defaultDivision?: string
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(line?.name ?? '')
  const [brandName, setBrandName] = useState(line?.brand_name ?? '')
  const [tier, setTier] = useState(line?.tier ?? defaultTier)
  const [division, setDivision] = useState(line?.division ?? defaultDivision)
  const [valueEssential, setValueEssential] = useState(line?.value_essential ?? '')
  const [valueExtended, setValueExtended] = useState(line?.value_extended ?? '')
  const [valueRoiNote, setValueRoiNote] = useState(line?.value_roi_note ?? '')

  const isNew = !line

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await upsertProductLine({
        id: line?.id,
        name,
        brand_name: brandName || null,
        tier,
        division,
        value_essential: valueEssential || null,
        value_extended: valueExtended || null,
        value_roi_note: valueRoiNote || null,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!line) return
    if (
      !confirm(
        `"${line.name}" 라인을 비활성화하시겠습니까?\n(완전 삭제가 아니라 active=false 처리. 기존 제품·거래는 유지됨)`,
      )
    )
      return
    startTransition(async () => {
      const res = await deleteProductLine(line.id)
      if (!res.ok) {
        setError(res.error ?? '비활성화 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isNew ? '새 제품 라인 추가' : '제품 라인 편집'}</DialogTitle>
        <DialogDescription>
          PRD #4 ② 가치 정의 워크북 — 라인이 어떤 본질적 가치를 주고, 가격이 정당한가?
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 라인명 + 브랜드명 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="line-name">라인명</Label>
            <Input
              id="line-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="예: 베이직, 시그니처, 헤리티지"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="line-brand">브랜드명 (선택)</Label>
            <Input
              id="line-brand"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="예: 디안 베이직"
            />
          </div>
        </div>

        {/* 티어 + 제품군 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>티어 (4티어 포지셔닝)</Label>
            <Select value={tier} onValueChange={(v) => setTier(v ?? defaultTier)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_TIER_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {PRICE_TIER_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>제품군</Label>
            <Select
              value={division}
              onValueChange={(v) => setDivision(v ?? defaultDivision)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIVISION_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {DIVISION_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 가치 정의 워크북 */}
        <div className="rounded-md border border-amber-100 bg-amber-50/40 p-3 text-[11px] text-amber-800">
          📘 <strong>가치 정의 워크북</strong> (PRD #4 ②) — 한 라인의 가격이 정당화되려면 어떤
          가치를 주는지 명문화해야 합니다.
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ve">필수 가치 (한 문장)</Label>
          <Input
            id="ve"
            value={valueEssential}
            onChange={(e) => setValueEssential(e.target.value)}
            placeholder="예: 내구성과 가격의 균형 / 디자이너 컬렉션 / 한정판 시그니처 컬러"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vx">확장 가치 (특징·차별점)</Label>
          <Textarea
            id="vx"
            value={valueExtended}
            onChange={(e) => setValueExtended(e.target.value)}
            rows={2}
            placeholder="예: 마틴데일 50,000회 이상 + 방염 처리 + 5년 무상 보증"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vr">ROI 메모 (가격 정당성)</Label>
          <Textarea
            id="vr"
            value={valueRoiNote}
            onChange={(e) => setValueRoiNote(e.target.value)}
            rows={2}
            placeholder="예: 일반 원단 대비 2배 가격이지만 수명 3배 → 결국 1.5배 절감"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!isNew && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="mr-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              비활성화
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                저장
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
