'use client'
/**
 * 자산 라이브러리 — URL/텍스트 등록 폼 + 삭제
 */
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Save, Trash2, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createAsset, deleteAsset } from '@/app/finance/sales/materials/actions'

interface AssetRow {
  id: number
  kind: string
  title: string | null
  description: string | null
  external_url: string | null
  body_text: string | null
  source: string
  tags: string[] | null
  created_at: string
}

interface Props {
  rows: AssetRow[]
}

export default function AssetForm({ rows }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const kind = fd.get('kind') as 'url' | 'text' | 'image' | 'pdf'

    if (kind === 'url' && !fd.get('external_url')) {
      setMsg({ ok: false, text: 'URL을 입력하세요.' })
      return
    }
    if (kind === 'text' && !fd.get('body_text')) {
      setMsg({ ok: false, text: '텍스트 본문을 입력하세요.' })
      return
    }

    startTransition(async () => {
      const res = await createAsset({
        kind,
        title: (fd.get('title') as string) || undefined,
        description: (fd.get('description') as string) || undefined,
        external_url: (fd.get('external_url') as string) || undefined,
        body_text: (fd.get('body_text') as string) || undefined,
        source: (fd.get('source') as 'domestic' | 'overseas') ?? 'domestic',
        tags: ((fd.get('tags') as string) ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
      setMsg({
        ok: res.ok,
        text: res.ok ? '자산 등록 완료' : res.error ?? '등록 실패',
      })
      if (res.ok) {
        setShowForm(false)
        form.reset()
      }
    })
  }

  const handleDelete = (id: number) => {
    if (!confirm('자산을 삭제합니다. 자료에서 참조 중이면 매핑이 끊깁니다. 계속할까요?')) return
    startTransition(async () => {
      const res = await deleteAsset(id)
      setMsg({
        ok: res.ok,
        text: res.ok ? '삭제 완료' : res.error ?? '삭제 실패',
      })
    })
  }

  return (
    <div className="space-y-3">
      {!showForm && (
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          자산 등록 (URL · 텍스트)
        </Button>
      )}

      {showForm && (
        <Card>
          <CardContent className="py-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">종류</Label>
                  <select
                    name="kind"
                    className="block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="url">URL (해외 사이트·기사 링크)</option>
                    <option value="text">텍스트 (본문 발췌)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">출처</Label>
                  <select
                    name="source"
                    className="block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="domestic">국내</option>
                    <option value="overseas">해외 🌍</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs">제목</Label>
                <Input
                  name="title"
                  placeholder="예: Loro Piana 2026 SS 콜렉션 인터뷰"
                />
              </div>

              <div>
                <Label className="text-xs">설명 (옵션)</Label>
                <Input
                  name="description"
                  placeholder="간단한 설명·요약"
                />
              </div>

              <div>
                <Label className="text-xs">URL (kind=url 일 때)</Label>
                <Input
                  name="external_url"
                  type="url"
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label className="text-xs">본문 (kind=text 일 때)</Label>
                <Textarea
                  name="body_text"
                  rows={5}
                  placeholder="해외 기사·인터뷰 본문을 붙여넣으세요. 위저드에서 자료 생성 시 참고됩니다."
                />
              </div>

              <div>
                <Label className="text-xs">태그 (쉼표 구분)</Label>
                <Input
                  name="tags"
                  placeholder="예: 리넨, 럭셔리, SS26"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3.5 w-3.5" />
                  )}
                  등록
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
            msg.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm italic text-slate-400">
              등록된 자산이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                          {r.kind}
                        </span>
                        <span className="text-[10px]">
                          {r.source === 'overseas' ? '🌍 해외' : '🇰🇷 국내'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(r.created_at).toLocaleDateString('ko-KR', {
                            year: '2-digit',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                        {r.title ?? '(제목 없음)'}
                      </p>
                      {r.description && (
                        <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">
                          {r.description}
                        </p>
                      )}
                      {r.external_url && (
                        <a
                          href={r.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex text-[11px] text-blue-600 hover:underline"
                        >
                          ↗ {r.external_url.slice(0, 60)}
                        </a>
                      )}
                      {r.body_text && (
                        <p className="mt-1 text-[11px] italic text-slate-500 line-clamp-2">
                          {r.body_text.slice(0, 200)}...
                        </p>
                      )}
                      {r.tags && r.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
