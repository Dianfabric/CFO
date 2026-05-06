'use client'
/**
 * 공지 작성/편집 폼
 */
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { upsertAnnouncement, deleteAnnouncement } from '@/app/finance/team/actions'
import type { AnnouncementInput } from '@/app/finance/team/actions'
import { Loader2, Save, Trash2, Plus, X } from 'lucide-react'

interface AnnRow {
  id: number
  title: string
  body: string | null
  importance: string
  target_channel: string
  include_in_daily: boolean
  include_in_weekly: boolean
  scheduled_date: string
  expires_at: string | null
  sent_at: string | null
}

interface Props {
  rows: AnnRow[]
}

export default function AnnouncementForm({ rows }: Props) {
  const [editing, setEditing] = useState<AnnRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const input: AnnouncementInput = {
      id: editing?.id,
      title: String(fd.get('title') ?? ''),
      body: (fd.get('body') as string) || null,
      importance: (fd.get('importance') as 'normal' | 'important' | 'urgent') ?? 'normal',
      target_channel:
        (fd.get('target_channel') as 'employees' | 'executives' | 'ceo') ?? 'employees',
      include_in_daily: fd.get('include_in_daily') === 'on',
      include_in_weekly: fd.get('include_in_weekly') === 'on',
      scheduled_date: (fd.get('scheduled_date') as string) || null,
      expires_at: (fd.get('expires_at') as string) || null,
    }

    if (!input.title.trim()) {
      setMsg({ ok: false, text: '제목을 입력하세요.' })
      return
    }

    startTransition(async () => {
      const res = await upsertAnnouncement(input)
      setMsg({
        ok: res.ok,
        text: res.ok ? '저장 완료' : res.error ?? '저장 실패',
      })
      if (res.ok) {
        setEditing(null)
        setShowForm(false)
        form.reset()
      }
    })
  }

  const handleDelete = (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    startTransition(async () => {
      const res = await deleteAnnouncement(id)
      setMsg({
        ok: res.ok,
        text: res.ok ? '삭제 완료' : res.error ?? '삭제 실패',
      })
    })
  }

  const startEdit = (r: AnnRow) => {
    setEditing(r)
    setShowForm(true)
  }

  const startNew = () => {
    setEditing(null)
    setShowForm(true)
  }

  const cancel = () => {
    setEditing(null)
    setShowForm(false)
  }

  return (
    <div className="space-y-3">
      {!showForm && (
        <Button size="sm" onClick={startNew}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          새 공지 작성
        </Button>
      )}

      {showForm && (
        <Card>
          <CardContent className="py-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label className="text-xs">제목</Label>
                <Input
                  name="title"
                  defaultValue={editing?.title ?? ''}
                  required
                  placeholder="예: 6월 첫째주 신상품 입고 안내"
                />
              </div>

              <div>
                <Label className="text-xs">본문</Label>
                <Textarea
                  name="body"
                  defaultValue={editing?.body ?? ''}
                  rows={3}
                  placeholder="자세한 내용을 입력하세요. (옵션)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">중요도</Label>
                  <select
                    name="importance"
                    defaultValue={editing?.importance ?? 'normal'}
                    className="block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="normal">일반</option>
                    <option value="important">중요</option>
                    <option value="urgent">긴급</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">대상 채널</Label>
                  <select
                    name="target_channel"
                    defaultValue={editing?.target_channel ?? 'employees'}
                    className="block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="employees">직원</option>
                    <option value="executives">임원</option>
                    <option value="ceo">CEO</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">발송 시작일</Label>
                  <Input
                    type="date"
                    name="scheduled_date"
                    defaultValue={
                      editing?.scheduled_date ?? new Date().toISOString().slice(0, 10)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">만료일 (옵션)</Label>
                  <Input
                    type="date"
                    name="expires_at"
                    defaultValue={editing?.expires_at ?? ''}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    name="include_in_daily"
                    defaultChecked={editing?.include_in_daily ?? true}
                  />
                  일일 디지스트에 포함
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    name="include_in_weekly"
                    defaultChecked={editing?.include_in_weekly ?? false}
                  />
                  주간 디지스트에 포함
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save className="mr-1 h-3.5 w-3.5" />
                      {editing ? '수정 저장' : '공지 등록'}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancel}
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
          className={`rounded-md border px-3 py-2 text-xs ${
            msg.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 목록 */}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm italic text-slate-400">
              등록된 공지가 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase text-slate-400">
                          {r.scheduled_date}
                        </span>
                        {r.importance === 'urgent' && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                            긴급
                          </span>
                        )}
                        {r.importance === 'important' && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            중요
                          </span>
                        )}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {r.target_channel}
                        </span>
                        {r.sent_at && (
                          <span className="text-[10px] text-emerald-600">✓ 발송됨</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                        {r.title}
                      </p>
                      {r.body && (
                        <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">
                          {r.body}
                        </p>
                      )}
                      <div className="mt-1 flex gap-2 text-[10px] text-slate-500">
                        {r.include_in_daily && <span>· 일일 포함</span>}
                        {r.include_in_weekly && <span>· 주간 포함</span>}
                        {r.expires_at && <span>· 만료 {r.expires_at}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => startEdit(r)}
                      >
                        편집
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
