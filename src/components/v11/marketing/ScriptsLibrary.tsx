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
import { Plus, Trash2, Loader2, X, Star, Pencil } from 'lucide-react'
import { upsertScript, deleteScript, type ScriptInput } from '@/app/finance/marketing/actions'
import { OCCUPATION_LABEL, DIVISION_LABEL } from '@/lib/v11-labels'
import { cn } from '@/lib/utils'

export interface ScriptRow {
  id: number
  name: string
  target_segment_id: number | null
  hook: string | null
  story: string | null
  offer: string | null
  call_to_action: string | null
  context: string | null
  used_count: number | null
  effectiveness_score: number | null
  notes: string | null
  segments?: { occupation: string; division: string } | null
}

const NONE = '__none__'

export default function ScriptsLibrary({
  scripts,
  segments,
}: {
  scripts: ScriptRow[]
  segments: Array<{ id: number; occupation: string; division: string }>
}) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<ScriptRow | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          새 스크립트
        </Button>
      </div>

      {(adding || editing) && (
        <ScriptForm
          script={editing}
          segments={segments}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      {/* 스크립트 카드 그리드 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {scripts.length === 0 ? (
          <p className="col-span-2 py-8 text-center text-sm text-slate-400">
            아직 스크립트가 없습니다. 위에서 첫 Hook·Story·Offer 스크립트를 추가하세요.
          </p>
        ) : (
          scripts.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer transition hover:border-blue-300"
              onClick={() => setEditing(s)}
            >
              <CardContent className="space-y-2 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-slate-800">{s.name}</h3>
                    {s.segments && (
                      <p className="text-[11px] text-slate-500">
                        {OCCUPATION_LABEL[s.segments.occupation] ?? s.segments.occupation} ×{' '}
                        {DIVISION_LABEL[s.segments.division] ?? s.segments.division}
                      </p>
                    )}
                  </div>
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                </div>

                {s.hook && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-amber-600">Hook</div>
                    <p className="text-xs text-slate-700 line-clamp-2">{s.hook}</p>
                  </div>
                )}
                {s.offer && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-emerald-600">Offer</div>
                    <p className="text-xs text-slate-700 line-clamp-2">{s.offer}</p>
                  </div>
                )}

                <div className="flex items-center justify-between border-t pt-2 text-[10px]">
                  <span className="text-slate-500">사용 {s.used_count ?? 0}회</span>
                  {s.effectiveness_score && (
                    <span className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: s.effectiveness_score }).map((_, i) => (
                        <Star key={i} className="h-2.5 w-2.5 fill-current" />
                      ))}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function ScriptForm({
  script,
  segments,
  onClose,
}: {
  script: ScriptRow | null
  segments: Array<{ id: number; occupation: string; division: string }>
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<ScriptInput>({
    id: script?.id,
    name: script?.name ?? '',
    target_segment_id: script?.target_segment_id ?? null,
    hook: script?.hook ?? '',
    story: script?.story ?? '',
    offer: script?.offer ?? '',
    call_to_action: script?.call_to_action ?? '',
    context: script?.context ?? '',
    effectiveness_score: script?.effectiveness_score ?? null,
    notes: script?.notes ?? '',
  })

  function set<K extends keyof ScriptInput>(k: K, v: ScriptInput[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await upsertScript(form)
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!script) return
    if (!confirm('이 스크립트를 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deleteScript(script.id)
      onClose()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {script ? '스크립트 편집' : '새 Hook·Story·Offer 스크립트'}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>스크립트명 *</Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
                placeholder="예: 인테리어 디자이너 인스타 DM 1차 컨택"
              />
            </div>
            <div className="space-y-1.5">
              <Label>타겟 24셀</Label>
              <Select
                value={form.target_segment_id ? String(form.target_segment_id) : NONE}
                onValueChange={(v) =>
                  set('target_segment_id', v === NONE ? null : parseInt(v ?? '', 10))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>(미설정)</SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {OCCUPATION_LABEL[s.occupation] ?? s.occupation} ×{' '}
                      {DIVISION_LABEL[s.division] ?? s.division}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-amber-700">🎣 Hook (시선 끌기)</Label>
            <Textarea
              value={form.hook ?? ''}
              onChange={(e) => set('hook', e.target.value)}
              rows={2}
              placeholder="첫 한 문장 — 멈추게 해야 한다. 질문·통계·자극적 주장."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-purple-700">📖 Story (감정 연결)</Label>
            <Textarea
              value={form.story ?? ''}
              onChange={(e) => set('story', e.target.value)}
              rows={3}
              placeholder="공감·서사·변화의 순간 — 왜 이 메시지가 그들에게 의미 있는가."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-emerald-700">💎 Offer (가치 제안)</Label>
            <Textarea
              value={form.offer ?? ''}
              onChange={(e) => set('offer', e.target.value)}
              rows={2}
              placeholder="구체적 가치 + 위험 제거 + 시급성. 무엇을 / 왜 지금 / 무엇을 잃을 것인가."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-blue-700">📞 Call to Action</Label>
            <Input
              value={form.call_to_action ?? ''}
              onChange={(e) => set('call_to_action', e.target.value)}
              placeholder="DM 한 줄 / 상담 예약 / 견적 요청"
            />
          </div>

          <div className="space-y-1.5">
            <Label>맥락 / 사용 환경</Label>
            <Textarea
              value={form.context ?? ''}
              onChange={(e) => set('context', e.target.value)}
              rows={2}
              placeholder="언제·어떤 채널·어떤 상황에서 사용하는가"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>효과 점수 (1~5)</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set('effectiveness_score', n)}
                    className={cn(
                      'p-1',
                      n <= (form.effectiveness_score ?? 0)
                        ? 'text-amber-500'
                        : 'text-slate-300 hover:text-amber-400',
                    )}
                  >
                    <Star
                      className={cn(
                        'h-5 w-5',
                        n <= (form.effectiveness_score ?? 0) && 'fill-current',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

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
            {script && (
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
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
