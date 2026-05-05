'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
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
import { Plus, Trash2, Loader2, X, Pencil, AlertTriangle } from 'lucide-react'
import {
  upsertPromotion,
  deletePromotion,
  type PromotionInput,
} from '@/app/finance/pricing/actions'
import {
  PRICE_TIER_LABEL,
  CLIENT_TIER_LABEL,
  CLIENT_TIER_VALUES,
} from '@/lib/v11-labels'
import { cn } from '@/lib/utils'

export interface PromoRow {
  id: number
  name: string
  promo_type: string | null
  start_date: string | null
  end_date: string | null
  status: string
  target_tier: string | null
  target_client_tier: string | null
  discount_rate: number | null
  discount_amount: number | null
  min_quantity: number | null
  bundle_note: string | null
  exclude_luxury: boolean
  notes: string | null
  uses_count: number | null
}

const TYPES = [
  { value: 'percentage_off', label: '% 할인' },
  { value: 'fixed_off', label: '고정 금액 할인' },
  { value: 'bulk', label: '대량 할인' },
  { value: 'bundle', label: '번들 패키지' },
  { value: 'tier_upgrade', label: '티어 업그레이드' },
  { value: 'free_sample', label: '무료 샘플' },
]

const STATUSES = [
  { value: 'planning', label: '기획', color: 'bg-slate-100 text-slate-700' },
  { value: 'active', label: '진행 중', color: 'bg-blue-100 text-blue-700' },
  { value: 'expired', label: '종료', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: '취소', color: 'bg-rose-100 text-rose-700' },
]

const NONE = '__none__'

export default function PromotionsList({ items }: { items: PromoRow[] }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PromoRow | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          프로모션 추가
        </Button>
      </div>

      {(adding || editing) && (
        <PromoForm
          promo={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.length === 0 ? (
          <p className="col-span-2 py-8 text-center text-sm text-slate-400">
            아직 프로모션이 없습니다. 신중하게 — 한 번 시작하면 거두기 어렵습니다.
          </p>
        ) : (
          items.map((p) => {
            const status = STATUSES.find((s) => s.value === p.status)
            const type = TYPES.find((t) => t.value === p.promo_type)
            return (
              <Card
                key={p.id}
                className="cursor-pointer transition hover:border-blue-300"
                onClick={() => setEditing(p)}
              >
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-slate-800">{p.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                        {type && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                            {type.label}
                          </span>
                        )}
                        {status && (
                          <span className={cn('rounded px-1.5 py-0.5 font-semibold', status.color)}>
                            {status.label}
                          </span>
                        )}
                        {p.target_tier && (
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 font-semibold',
                              p.target_tier === 'luxury'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-700',
                            )}
                          >
                            {PRICE_TIER_LABEL[p.target_tier]}
                          </span>
                        )}
                      </div>
                    </div>
                    <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  </div>

                  {(p.start_date || p.end_date) && (
                    <p className="text-[11px] text-slate-500">
                      {p.start_date ?? '?'} ~ {p.end_date ?? '?'}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 border-t pt-2 text-[11px]">
                    {p.discount_rate != null && p.discount_rate > 0 && (
                      <span className="font-semibold text-blue-700">
                        {p.discount_rate}% 할인
                      </span>
                    )}
                    {p.discount_amount != null && p.discount_amount > 0 && (
                      <span className="font-semibold text-blue-700">
                        {p.discount_amount.toLocaleString()}원 할인
                      </span>
                    )}
                    {p.min_quantity && (
                      <span className="text-slate-500">
                        최소 {p.min_quantity}개
                      </span>
                    )}
                    {(p.uses_count ?? 0) > 0 && (
                      <span className="text-emerald-700">사용 {p.uses_count}회</span>
                    )}
                  </div>

                  {p.target_tier === 'luxury' && !p.exclude_luxury && (
                    <div className="flex items-center gap-1 rounded bg-rose-50 px-2 py-1 text-[10px] text-rose-700">
                      <AlertTriangle className="h-3 w-3" />
                      럭셔리 할인 — 정책 위반 가능성
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

function PromoForm({ promo, onClose }: { promo: PromoRow | null; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<PromotionInput>({
    id: promo?.id,
    name: promo?.name ?? '',
    promo_type: promo?.promo_type ?? '',
    start_date: promo?.start_date ?? '',
    end_date: promo?.end_date ?? '',
    status: promo?.status ?? 'planning',
    target_tier: promo?.target_tier ?? '',
    target_client_tier: promo?.target_client_tier ?? '',
    discount_rate: promo?.discount_rate ?? null,
    discount_amount: promo?.discount_amount ?? null,
    min_quantity: promo?.min_quantity ?? null,
    bundle_note: promo?.bundle_note ?? '',
    exclude_luxury: promo?.exclude_luxury ?? true,
    notes: promo?.notes ?? '',
  })

  function set<K extends keyof PromotionInput>(k: K, v: PromotionInput[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.target_tier === 'luxury' && !form.exclude_luxury) {
      if (
        !confirm(
          'PRD #4 정책: 럭셔리 라인은 할인 절대 금지입니다. 그래도 등록하시겠습니까?',
        )
      ) {
        return
      }
    }

    startTransition(async () => {
      const res = await upsertPromotion(form)
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!promo) return
    if (!confirm('이 프로모션을 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deletePromotion(promo.id)
      onClose()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{promo ? '프로모션 편집' : '새 프로모션'}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>프로모션명 *</Label>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="예: 봄 시즌 신규 디자이너 25% 할인"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>유형</Label>
              <Select value={form.promo_type ?? ''} onValueChange={(v) => set('promo_type', v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>상태</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set('status', v ?? 'planning')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>최소 수량</Label>
              <Input
                type="number"
                value={form.min_quantity ?? ''}
                onChange={(e) =>
                  set('min_quantity', e.target.value ? parseInt(e.target.value, 10) : null)
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>시작일</Label>
              <Input
                type="date"
                value={form.start_date ?? ''}
                onChange={(e) => set('start_date', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>종료일</Label>
              <Input
                type="date"
                value={form.end_date ?? ''}
                onChange={(e) => set('end_date', e.target.value)}
              />
            </div>
          </div>

          {/* 타겟팅 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>타겟 가격 티어</Label>
              <Select
                value={form.target_tier === '' || form.target_tier == null ? NONE : form.target_tier}
                onValueChange={(v) => set('target_tier', v === NONE ? null : v ?? null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>(전체)</SelectItem>
                  <SelectItem value="value">저가</SelectItem>
                  <SelectItem value="mid">중가</SelectItem>
                  <SelectItem value="premium">프리미엄</SelectItem>
                  <SelectItem value="luxury">럭셔리 ⚠</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>타겟 거래처 등급</Label>
              <Select
                value={
                  form.target_client_tier === '' || form.target_client_tier == null
                    ? NONE
                    : form.target_client_tier
                }
                onValueChange={(v) => set('target_client_tier', v === NONE ? null : v ?? null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>(전체)</SelectItem>
                  {CLIENT_TIER_VALUES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CLIENT_TIER_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 할인 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>할인율 (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.discount_rate ?? ''}
                onChange={(e) =>
                  set('discount_rate', e.target.value ? Number(e.target.value) : null)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>고정 할인 금액 (원)</Label>
              <Input
                type="number"
                value={form.discount_amount ?? ''}
                onChange={(e) =>
                  set('discount_amount', e.target.value ? Number(e.target.value) : null)
                }
              />
            </div>
          </div>

          {form.target_tier === 'luxury' && (
            <label className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-800">
              <input
                type="checkbox"
                checked={form.exclude_luxury}
                onChange={(e) => set('exclude_luxury', e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong>럭셔리 보호 활성화</strong>: 럭셔리는 할인 절대 금지 (PRD #4 정책)
              </span>
            </label>
          )}

          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="이 프로모션의 목적·근거"
            />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2">
            {promo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isPending}
                className="mr-auto text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                삭제
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '저장'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
