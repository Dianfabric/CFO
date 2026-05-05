'use client'
/**
 * 니즈 카드 보드 (Kanban: new → shared → in_progress → addressed)
 */
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
  ThumbsUp,
  Trash2,
  ArrowRight,
  Lightbulb,
  Loader2,
  X,
} from 'lucide-react'
import {
  upsertNeedCard,
  moveNeedCardStatus,
  voteNeedCard,
  deleteNeedCard,
} from '@/app/finance/sales/needs/actions'
import { cn } from '@/lib/utils'

export interface NeedCardRow {
  id: number
  client_id: number | null
  category: string | null
  description: string
  discovery_method: string | null
  status: string
  votes: number | null
  created_at: string
  clients?: { name: string } | null
}

const STATUSES = [
  { value: 'new', label: '발견', color: 'border-blue-200 bg-blue-50' },
  { value: 'shared', label: '팀 공유', color: 'border-purple-200 bg-purple-50' },
  { value: 'in_progress', label: '대응 중', color: 'border-amber-200 bg-amber-50' },
  { value: 'addressed', label: '해결됨', color: 'border-emerald-200 bg-emerald-50' },
]

const CATEGORIES = ['소재', '컨셉', '컬러', '시즌', '가격', '사이즈', '기타']
const DISCOVERY = ['인터뷰', '관찰', 'DM', '미팅', '전시', '리뷰']

export default function NeedCardsBoard({
  cards,
  clients,
}: {
  cards: NeedCardRow[]
  clients: Array<{ id: number; name: string }>
}) {
  const [adding, setAdding] = useState(false)

  const byStatus = new Map<string, NeedCardRow[]>()
  for (const s of STATUSES) byStatus.set(s.value, [])
  for (const c of cards) {
    if (byStatus.has(c.status)) byStatus.get(c.status)!.push(c)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          니즈 카드 추가
        </Button>
      </div>

      {adding && <NewCardForm clients={clients} onClose={() => setAdding(false)} />}

      {/* Kanban 4 컬럼 */}
      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[900px] grid-cols-4 gap-3">
          {STATUSES.map((s) => {
            const list = byStatus.get(s.value) ?? []
            return (
              <div key={s.value} className="space-y-2">
                <div
                  className={cn(
                    'rounded-md px-2 py-1.5 text-center text-xs font-bold border',
                    s.color,
                  )}
                >
                  {s.label}
                  <span className="ml-1 text-[10px] opacity-70">({list.length})</span>
                </div>

                {list.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-[11px] text-slate-400">
                    비어있음
                  </div>
                ) : (
                  list.map((c) => <CardItem key={c.id} card={c} statuses={STATUSES} />)
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function NewCardForm({
  clients,
  onClose,
}: {
  clients: Array<{ id: number; name: string }>
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [discovery, setDiscovery] = useState('')
  const [clientId, setClientId] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await upsertNeedCard({
        description,
        category: category || null,
        discovery_method: discovery || null,
        client_id: clientId ? parseInt(clientId, 10) : null,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">새 니즈 카드</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>니즈 핵심 (한 문장)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={2}
              placeholder="예: 봄 시즌에 어두운 컬러도 트렌디한 디자인 원함"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>카테고리</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>발견 방법</Label>
              <Select value={discovery} onValueChange={(v) => setDiscovery(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {DISCOVERY.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>거래처 (선택)</Label>
              <Select value={clientId} onValueChange={(v) => setClientId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="">(없음)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2">
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
                '추가'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function CardItem({
  card,
  statuses,
}: {
  card: NeedCardRow
  statuses: typeof STATUSES
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const currentIdx = statuses.findIndex((s) => s.value === card.status)
  const nextStatus = statuses[currentIdx + 1]?.value

  function handleMove() {
    if (!nextStatus) return
    startTransition(async () => {
      await moveNeedCardStatus(card.id, nextStatus)
      router.refresh()
    })
  }

  function handleVote() {
    startTransition(async () => {
      await voteNeedCard(card.id)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('이 카드를 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deleteNeedCard(card.id)
      router.refresh()
    })
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-2.5 text-xs shadow-sm space-y-1.5">
      <div className="flex items-start gap-1.5">
        <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
        <p className="flex-1 text-slate-800 leading-snug">{card.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        {card.category && (
          <span className="rounded bg-purple-100 px-1 py-0.5 font-semibold text-purple-700">
            {card.category}
          </span>
        )}
        {card.discovery_method && (
          <span className="rounded bg-slate-100 px-1 py-0.5 text-slate-600">
            {card.discovery_method}
          </span>
        )}
        {card.clients?.name && (
          <span className="rounded bg-blue-50 px-1 py-0.5 text-blue-700">
            {card.clients.name}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={handleVote}
          disabled={isPending}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-emerald-600"
        >
          <ThumbsUp className="h-3 w-3" />
          {card.votes ?? 0}
        </button>
        <div className="flex items-center gap-1">
          {nextStatus && (
            <button
              type="button"
              onClick={handleMove}
              disabled={isPending}
              className="flex items-center gap-0.5 text-[10px] text-blue-600 hover:underline"
            >
              {statuses[currentIdx + 1].label} <ArrowRight className="h-2.5 w-2.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-[10px] text-rose-500 hover:text-rose-700"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
