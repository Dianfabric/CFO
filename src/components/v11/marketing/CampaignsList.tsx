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
import { Plus, Trash2, Loader2, X, Pencil } from 'lucide-react'
import { upsertCampaign, deleteCampaign, type CampaignInput } from '@/app/finance/marketing/actions'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export interface CampaignRow {
  id: number
  name: string
  campaign_type: string | null
  start_date: string | null
  end_date: string | null
  status: string
  goal: string | null
  budget: number | null
  actual_spend: number | null
  metrics_views: number | null
  metrics_conversions: number | null
  metrics_revenue: number | null
  notes: string | null
  content_count?: number
  aggregated_views?: number
  roi_multiplier?: number | null
}

const TYPES = [
  { value: 'seasonal', label: '시즌 (SS·FW)' },
  { value: 'product_launch', label: '신제품 출시' },
  { value: 'event', label: '이벤트·전시' },
  { value: 'newsletter', label: '뉴스레터' },
  { value: 'collab', label: '협업·콜라보' },
  { value: 'paid_ads', label: '유료 광고' },
]

const STATUSES = [
  { value: 'planning', label: '기획', color: 'bg-slate-100 text-slate-700' },
  { value: 'active', label: '진행 중', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: '완료', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: '취소', color: 'bg-rose-100 text-rose-700' },
]

export default function CampaignsList({ items }: { items: CampaignRow[] }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CampaignRow | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          캠페인 추가
        </Button>
      </div>

      {(adding || editing) && (
        <CampaignForm
          item={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.length === 0 ? (
          <p className="col-span-2 py-8 text-center text-sm text-slate-400">
            아직 캠페인이 없습니다. 시즌·신제품·이벤트 단위로 캠페인을 만들어 콘텐츠를 묶으세요.
          </p>
        ) : (
          items.map((c) => {
            const status = STATUSES.find((s) => s.value === c.status)
            const type = TYPES.find((t) => t.value === c.campaign_type)
            return (
              <Card
                key={c.id}
                className="cursor-pointer transition hover:border-blue-300"
                onClick={() => setEditing(c)}
              >
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-slate-800">{c.name}</h3>
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
                      </div>
                    </div>
                    <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  </div>

                  {(c.start_date || c.end_date) && (
                    <p className="text-[11px] text-slate-500">
                      {c.start_date ?? '?'} ~ {c.end_date ?? '?'}
                    </p>
                  )}

                  {c.goal && (
                    <p className="text-[11px] text-slate-700 line-clamp-2">🎯 {c.goal}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 border-t pt-2 text-[11px]">
                    <div>
                      <div className="text-slate-400">예산</div>
                      <div className="font-semibold tabular-nums text-slate-800">
                        {c.budget ? formatKRW(Number(c.budget)) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">집행</div>
                      <div className="font-semibold tabular-nums text-slate-800">
                        {Number(c.actual_spend ?? 0) > 0
                          ? formatKRW(Number(c.actual_spend))
                          : '—'}
                      </div>
                    </div>
                    {Number(c.metrics_revenue ?? 0) > 0 && (
                      <div className="col-span-2">
                        <div className="text-slate-400">매출 / ROI</div>
                        <div className="font-semibold tabular-nums text-emerald-700">
                          {formatKRW(Number(c.metrics_revenue))}
                          {c.roi_multiplier != null && (
                            <span className="ml-1 text-[10px] text-amber-600">
                              · {c.roi_multiplier}x
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {(c.content_count ?? 0) > 0 && (
                      <div className="col-span-2 text-[10px] text-slate-500">
                        콘텐츠 {c.content_count}개 · 집계 조회 {c.aggregated_views ?? 0}회
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

function CampaignForm({
  item,
  onClose,
}: {
  item: CampaignRow | null
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<CampaignInput>({
    id: item?.id,
    name: item?.name ?? '',
    campaign_type: item?.campaign_type ?? '',
    start_date: item?.start_date ?? '',
    end_date: item?.end_date ?? '',
    status: item?.status ?? 'planning',
    goal: item?.goal ?? '',
    budget: item?.budget ?? null,
    actual_spend: item?.actual_spend ?? null,
    metrics_views: item?.metrics_views ?? null,
    metrics_conversions: item?.metrics_conversions ?? null,
    metrics_revenue: item?.metrics_revenue ?? null,
    notes: item?.notes ?? '',
  })

  function set<K extends keyof CampaignInput>(k: K, v: CampaignInput[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await upsertCampaign(form)
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!item) return
    if (!confirm('이 캠페인을 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deleteCampaign(item.id)
      onClose()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{item ? '캠페인 편집' : '새 캠페인'}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>캠페인명 *</Label>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="예: 2026 SS 인테리어 룩북 캠페인"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>유형</Label>
              <Select
                value={form.campaign_type ?? ''}
                onValueChange={(v) => set('campaign_type', v ?? '')}
              >
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

          <div className="space-y-1.5">
            <Label>목표 (한 문장)</Label>
            <Textarea
              value={form.goal ?? ''}
              onChange={(e) => set('goal', e.target.value)}
              rows={2}
              placeholder="예: 인테리어 디자이너 신규 50명 컨택 + 매출 5,000만"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>예산 (원)</Label>
              <Input
                type="number"
                value={form.budget ?? ''}
                onChange={(e) =>
                  set('budget', e.target.value ? Number(e.target.value) : null)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>실제 집행</Label>
              <Input
                type="number"
                value={form.actual_spend ?? ''}
                onChange={(e) =>
                  set('actual_spend', e.target.value ? Number(e.target.value) : null)
                }
              />
            </div>
          </div>

          {form.status === 'completed' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>총 조회</Label>
                <Input
                  type="number"
                  value={form.metrics_views ?? ''}
                  onChange={(e) =>
                    set('metrics_views', e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>전환 수</Label>
                <Input
                  type="number"
                  value={form.metrics_conversions ?? ''}
                  onChange={(e) =>
                    set('metrics_conversions', e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>발생 매출</Label>
                <Input
                  type="number"
                  value={form.metrics_revenue ?? ''}
                  onChange={(e) =>
                    set('metrics_revenue', e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2">
            {item && (
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
