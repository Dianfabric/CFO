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
import { Plus, Trash2, Loader2, X, BookOpen, Pencil } from 'lucide-react'
import { upsertSampleBook, deleteSampleBook, type SampleBookInput } from '@/app/finance/operations/actions'
import { cn } from '@/lib/utils'

export interface BookRow {
  id: number
  name: string
  season: string | null
  year: number | null
  description: string | null
  cover_url: string | null
  status: string
  product_count: number | null
  send_count: number | null
}

const SEASONS = [
  { value: 'ss', label: 'SS (봄·여름)' },
  { value: 'fw', label: 'FW (가을·겨울)' },
  { value: 'limited', label: '한정 컬렉션' },
  { value: 'all', label: '전 시즌' },
]

export default function SampleBooksList({ books }: { books: BookRow[] }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<BookRow | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('active')

  const filtered = books.filter((b) => statusFilter === 'all' || b.status === statusFilter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {[
            { v: 'all', label: '전체' },
            { v: 'active', label: '활성' },
            { v: 'archived', label: '보관' },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setStatusFilter(f.v)}
              className={cn(
                'rounded px-2 py-1 text-[11px]',
                statusFilter === f.v
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          샘플북 추가
        </Button>
      </div>

      {(adding || editing) && (
        <BookForm
          book={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="col-span-3 py-8 text-center text-sm text-slate-400">
            {books.length === 0
              ? '아직 샘플북이 없습니다. 시즌별 큐레이션을 시작하세요.'
              : '필터 조건에 맞는 샘플북이 없습니다.'}
          </p>
        ) : (
          filtered.map((b) => {
            const season = SEASONS.find((s) => s.value === b.season)
            return (
              <Card
                key={b.id}
                className="cursor-pointer transition hover:border-purple-300"
                onClick={() => setEditing(b)}
              >
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-start gap-2">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-slate-800">{b.name}</h3>
                      <p className="text-[10px] text-slate-500">
                        {b.year}
                        {season && ` · ${season.label}`}
                        {b.status === 'archived' && ' · 보관'}
                      </p>
                    </div>
                    <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  </div>
                  {b.description && (
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {b.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between border-t pt-2 text-[11px]">
                    <span className="text-purple-700">
                      제품 {b.product_count ?? 0}개
                    </span>
                    {(b.send_count ?? 0) > 0 && (
                      <span className="text-blue-700">발송 {b.send_count}회</span>
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

function BookForm({
  book,
  onClose,
}: {
  book: BookRow | null
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const currentYear = new Date().getFullYear()
  const [form, setForm] = useState<SampleBookInput>({
    id: book?.id,
    name: book?.name ?? '',
    season: book?.season ?? '',
    year: book?.year ?? currentYear,
    description: book?.description ?? '',
    cover_url: book?.cover_url ?? '',
    status: book?.status ?? 'active',
  })

  function set<K extends keyof SampleBookInput>(k: K, v: SampleBookInput[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await upsertSampleBook(form)
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!book) return
    if (!confirm('이 샘플북을 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deleteSampleBook(book.id)
      onClose()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{book ? '샘플북 편집' : '새 샘플북'}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>이름 *</Label>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="예: 2026 SS 인테리어 룩북"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>연도</Label>
              <Input
                type="number"
                value={form.year ?? ''}
                onChange={(e) =>
                  set('year', e.target.value ? parseInt(e.target.value, 10) : null)
                }
                placeholder={String(currentYear)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>시즌</Label>
              <Select value={form.season ?? ''} onValueChange={(v) => set('season', v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {SEASONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>상태</Label>
              <Select
                value={form.status ?? 'active'}
                onValueChange={(v) => set('status', v ?? 'active')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="archived">보관</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>설명·컨셉</Label>
            <Textarea
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="이 샘플북의 큐레이션 컨셉·스토리·타겟"
            />
          </div>

          <div className="space-y-1.5">
            <Label>커버 이미지 URL (선택)</Label>
            <Input
              value={form.cover_url ?? ''}
              onChange={(e) => set('cover_url', e.target.value)}
              placeholder="https://..."
            />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2">
            {book && (
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
