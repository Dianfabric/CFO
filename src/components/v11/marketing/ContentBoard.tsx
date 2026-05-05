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
import {
  Plus,
  Trash2,
  Loader2,
  X,
  AtSign,
  FileText,
  Video,
  Mail,
  Image as ImageIcon,
} from 'lucide-react'
import { upsertContentItem, deleteContentItem, type ContentItemInput } from '@/app/finance/marketing/actions'
import { cn } from '@/lib/utils'

export interface ContentRow {
  id: number
  channel: string
  title: string
  publish_date: string | null
  status: string
  hook: string | null
  story: string | null
  offer: string | null
  caption: string | null
  url: string | null
  views: number | null
  likes: number | null
  notes: string | null
}

const CHANNELS = [
  { value: 'instagram', label: '인스타그램', icon: AtSign, color: 'text-pink-500' },
  { value: 'blog', label: '블로그', icon: FileText, color: 'text-blue-500' },
  { value: 'youtube', label: '유튜브', icon: Video, color: 'text-red-500' },
  { value: 'pinterest', label: '핀터레스트', icon: ImageIcon, color: 'text-rose-500' },
  { value: 'lookbook', label: '룩북', icon: ImageIcon, color: 'text-amber-500' },
  { value: 'newsletter', label: '뉴스레터', icon: Mail, color: 'text-emerald-500' },
]

const STATUSES = [
  { value: 'idea', label: '아이디어', color: 'bg-slate-100 text-slate-700' },
  { value: 'drafting', label: '작성 중', color: 'bg-amber-100 text-amber-800' },
  { value: 'scheduled', label: '예약됨', color: 'bg-blue-100 text-blue-700' },
  { value: 'published', label: '발행됨', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'archived', label: '보관', color: 'bg-slate-200 text-slate-600' },
]

export default function ContentBoard({ items }: { items: ContentRow[] }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<ContentRow | null>(null)

  const byStatus = new Map<string, ContentRow[]>()
  for (const s of STATUSES) byStatus.set(s.value, [])
  for (const it of items) {
    if (byStatus.has(it.status)) byStatus.get(it.status)!.push(it)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          콘텐츠 추가
        </Button>
      </div>

      {(adding || editing) && (
        <ContentForm
          item={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3">
          {STATUSES.map((s) => {
            const list = byStatus.get(s.value) ?? []
            return (
              <div key={s.value} className="space-y-2">
                <div className={cn('rounded-md px-2 py-1.5 text-center text-xs font-bold', s.color)}>
                  {s.label}
                  <span className="ml-1 text-[10px] opacity-70">({list.length})</span>
                </div>

                {list.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-3 text-center text-[11px] text-slate-400">
                    비어있음
                  </div>
                ) : (
                  list.map((it) => {
                    const ch = CHANNELS.find((c) => c.value === it.channel)
                    const Icon = ch?.icon ?? FileText
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => setEditing(it)}
                        className="block w-full rounded-md border border-slate-200 bg-white p-2 text-left text-xs hover:border-blue-300 hover:bg-blue-50/30"
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn('h-3 w-3 shrink-0', ch?.color ?? 'text-slate-500')} />
                          <span className="truncate font-semibold text-slate-800">{it.title}</span>
                        </div>
                        {it.publish_date && (
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            {it.publish_date}
                          </div>
                        )}
                        {it.status === 'published' && (it.likes ?? 0) > 0 && (
                          <div className="mt-1 flex gap-2 text-[10px] text-slate-500">
                            <span>👁 {it.views ?? 0}</span>
                            <span>♥ {it.likes ?? 0}</span>
                          </div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ContentForm({
  item,
  onClose,
}: {
  item: ContentRow | null
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<ContentItemInput>({
    id: item?.id,
    title: item?.title ?? '',
    channel: item?.channel ?? 'instagram',
    publish_date: item?.publish_date ?? '',
    status: item?.status ?? 'idea',
    hook: item?.hook ?? '',
    story: item?.story ?? '',
    offer: item?.offer ?? '',
    caption: item?.caption ?? '',
    url: item?.url ?? '',
    views: item?.views ?? 0,
    likes: item?.likes ?? 0,
    notes: item?.notes ?? '',
  })

  function set<K extends keyof ContentItemInput>(k: K, v: ContentItemInput[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await upsertContentItem(form)
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
    if (!confirm('이 콘텐츠를 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deleteContentItem(item.id)
      onClose()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {item ? '콘텐츠 편집' : '새 콘텐츠'}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>제목 *</Label>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
              placeholder="예: 봄 시즌 인테리어 룩북 — 베이지 톤 큐레이션"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>채널</Label>
              <Select value={form.channel} onValueChange={(v) => set('channel', v ?? 'instagram')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>상태</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v ?? 'idea')}>
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
              <Label>발행일 (예정)</Label>
              <Input
                type="date"
                value={form.publish_date ?? ''}
                onChange={(e) => set('publish_date', e.target.value)}
              />
            </div>
          </div>

          {/* HSO */}
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label>Hook (시선 끌기)</Label>
              <Input
                value={form.hook ?? ''}
                onChange={(e) => set('hook', e.target.value)}
                placeholder="첫 3초에 멈추게 하는 한 문장"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Story (감정 연결)</Label>
              <Textarea
                value={form.story ?? ''}
                onChange={(e) => set('story', e.target.value)}
                rows={2}
                placeholder="공감·서사 — 왜 이 콘텐츠가 의미 있는가"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Offer (가치 제안)</Label>
              <Textarea
                value={form.offer ?? ''}
                onChange={(e) => set('offer', e.target.value)}
                rows={2}
                placeholder="구체적 행동 유도 — DM·상담·견적 요청"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>캡션 (전체 본문)</Label>
            <Textarea
              value={form.caption ?? ''}
              onChange={(e) => set('caption', e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>URL (발행 후)</Label>
              <Input
                value={form.url ?? ''}
                onChange={(e) => set('url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            {form.status === 'published' && (
              <>
                <div className="space-y-1.5">
                  <Label>조회수</Label>
                  <Input
                    type="number"
                    value={form.views ?? 0}
                    onChange={(e) => set('views', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>좋아요</Label>
                  <Input
                    type="number"
                    value={form.likes ?? 0}
                    onChange={(e) => set('likes', parseInt(e.target.value) || 0)}
                  />
                </div>
              </>
            )}
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
              {isPending ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  저장 중...
                </>
              ) : (
                '저장'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
