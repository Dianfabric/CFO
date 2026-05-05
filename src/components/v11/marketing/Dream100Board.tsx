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
import { Plus, Trash2, Loader2, X, Trophy, Star, ExternalLink } from 'lucide-react'
import { upsertDream100, deleteDream100, type Dream100Input } from '@/app/finance/marketing/actions'
import { cn } from '@/lib/utils'

export interface Dream100Row {
  id: number
  name: string
  prospect_type: string | null
  segment_hint: string | null
  current_status: string
  influence_score: number | null
  contact_handle: string | null
  contact_url: string | null
  follower_count: number | null
  last_contact_date: string | null
  next_action: string | null
  next_action_date: string | null
  notes: string | null
}

const PROSPECT_TYPES = [
  { value: 'influencer', label: '인플루언서' },
  { value: 'magazine', label: '잡지·매체' },
  { value: 'designer', label: '유명 디자이너' },
  { value: 'brand', label: '브랜드 (가구·인테리어)' },
  { value: 'agency', label: '인테리어 에이전시' },
  { value: 'media', label: '온라인 미디어' },
  { value: 'collab_partner', label: '협업 파트너' },
]

const STATUSES = [
  { value: 'identified', label: '발굴', color: 'bg-slate-100 text-slate-700' },
  { value: 'researched', label: '조사 완료', color: 'bg-blue-100 text-blue-700' },
  { value: 'contacted', label: '컨택 시도', color: 'bg-amber-100 text-amber-800' },
  { value: 'engaged', label: '대화 중', color: 'bg-purple-100 text-purple-700' },
  { value: 'collab', label: '협업 진행', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'declined', label: '거절·종료', color: 'bg-rose-100 text-rose-700' },
]

export default function Dream100Board({ items }: { items: Dream100Row[] }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Dream100Row | null>(null)
  const [filter, setFilter] = useState<string>('__all__')

  const filtered =
    filter === '__all__' ? items : items.filter((it) => it.current_status === filter)

  const counts = new Map<string, number>()
  for (const s of STATUSES) counts.set(s.value, 0)
  for (const it of items) counts.set(it.current_status, (counts.get(it.current_status) ?? 0) + 1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilter('__all__')}
            className={cn(
              'rounded px-2 py-1 text-[11px]',
              filter === '__all__'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            전체 ({items.length})
          </button>
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={cn(
                'rounded px-2 py-1 text-[11px]',
                filter === s.value
                  ? 'bg-slate-900 text-white'
                  : `${s.color} hover:opacity-80`,
              )}
            >
              {s.label} ({counts.get(s.value) ?? 0})
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          드림 100 추가
        </Button>
      </div>

      {(adding || editing) && (
        <D100Form
          item={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="col-span-3 py-8 text-center text-sm text-slate-400">
            {items.length === 0
              ? '아직 드림 100 표적이 없습니다. 첫 표적을 추가하세요.'
              : '필터 조건에 맞는 표적이 없습니다.'}
          </p>
        ) : (
          filtered.map((it) => {
            const status = STATUSES.find((s) => s.value === it.current_status)
            const type = PROSPECT_TYPES.find((p) => p.value === it.prospect_type)
            return (
              <Card
                key={it.id}
                className="cursor-pointer transition hover:border-amber-300"
                onClick={() => setEditing(it)}
              >
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-start gap-1.5">
                    <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-slate-800">
                        {it.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {type && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                            {type.label}
                          </span>
                        )}
                        {status && (
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              status.color,
                            )}
                          >
                            {status.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {it.influence_score && (
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: it.influence_score }).map((_, i) => (
                        <Star key={i} className="h-2.5 w-2.5 fill-current" />
                      ))}
                      <span className="ml-1 text-[10px] text-slate-500">
                        영향력 {it.influence_score}/10
                      </span>
                    </div>
                  )}

                  {it.contact_handle && (
                    <div className="text-[11px] text-slate-600">
                      {it.contact_handle}
                      {it.follower_count && (
                        <span className="ml-1 text-slate-400">
                          · {it.follower_count.toLocaleString()} 팔로워
                        </span>
                      )}
                    </div>
                  )}

                  {it.next_action && (
                    <div className="rounded-md bg-blue-50/50 px-2 py-1 text-[11px] text-blue-700">
                      → {it.next_action}{' '}
                      {it.next_action_date && (
                        <span className="text-blue-500">({it.next_action_date})</span>
                      )}
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

function D100Form({
  item,
  onClose,
}: {
  item: Dream100Row | null
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<Dream100Input>({
    id: item?.id,
    name: item?.name ?? '',
    prospect_type: item?.prospect_type ?? '',
    segment_hint: item?.segment_hint ?? '',
    current_status: item?.current_status ?? 'identified',
    influence_score: item?.influence_score ?? null,
    contact_handle: item?.contact_handle ?? '',
    contact_url: item?.contact_url ?? '',
    follower_count: item?.follower_count ?? null,
    last_contact_date: item?.last_contact_date ?? '',
    next_action: item?.next_action ?? '',
    next_action_date: item?.next_action_date ?? '',
    notes: item?.notes ?? '',
  })

  function set<K extends keyof Dream100Input>(k: K, v: Dream100Input[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await upsertDream100(form)
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
    if (!confirm('이 드림 100 표적을 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deleteDream100(item.id)
      onClose()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{item ? '편집' : '새 표적'}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>이름·브랜드 *</Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
                placeholder="예: 김OO 디자이너 / 까사미아 / 매거진 H"
              />
            </div>
            <div className="space-y-1.5">
              <Label>유형</Label>
              <Select
                value={form.prospect_type ?? ''}
                onValueChange={(v) => set('prospect_type', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECT_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>현재 상태</Label>
              <Select
                value={form.current_status}
                onValueChange={(v) => set('current_status', v ?? 'identified')}
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
              <Label>24셀 매치 (텍스트)</Label>
              <Input
                value={form.segment_hint ?? ''}
                onChange={(e) => set('segment_hint', e.target.value)}
                placeholder="예: 인테리어 프로젝트 × 소파"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>영향력 (1~10)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.influence_score ?? ''}
                onChange={(e) =>
                  set('influence_score', e.target.value ? parseInt(e.target.value, 10) : null)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>핸들·계정</Label>
              <Input
                value={form.contact_handle ?? ''}
                onChange={(e) => set('contact_handle', e.target.value)}
                placeholder="@kim_designer"
              />
            </div>
            <div className="space-y-1.5">
              <Label>팔로워</Label>
              <Input
                type="number"
                value={form.follower_count ?? ''}
                onChange={(e) =>
                  set('follower_count', e.target.value ? parseInt(e.target.value, 10) : null)
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>URL (선택)</Label>
            <Input
              value={form.contact_url ?? ''}
              onChange={(e) => set('contact_url', e.target.value)}
              placeholder="https://instagram.com/..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>마지막 컨택</Label>
              <Input
                type="date"
                value={form.last_contact_date ?? ''}
                onChange={(e) => set('last_contact_date', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>다음 행동 일자</Label>
              <Input
                type="date"
                value={form.next_action_date ?? ''}
                onChange={(e) => set('next_action_date', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>다음 행동</Label>
            <Input
              value={form.next_action ?? ''}
              onChange={(e) => set('next_action', e.target.value)}
              placeholder="예: 봄 룩북 DM 발송"
            />
          </div>

          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="협업 가능성·연결 인맥·과거 발행물 등"
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
