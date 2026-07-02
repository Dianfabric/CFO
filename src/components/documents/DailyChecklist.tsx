'use client'

/**
 * 1일 체크리스트 — 매일 확인·입력해야 할 일 (담당자 표시).
 *
 * 날짜 기반이라 매일 자동으로 미체크 상태에서 시작.
 * 예: 색동 선물 내역 — 선물을 준 날은 색동 신사업 페이지에서 잊기 전에 기록.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ListTodo, Loader2, Plus, Trash2, ExternalLink, CheckCircle2, Circle,
} from 'lucide-react'
import {
  listDailyChecklist, toggleDailyCheck, addChecklistItem, deleteChecklistItem,
} from '@/app/documents/checklist-actions'
import type { ChecklistItem } from '@/app/documents/checklist-actions'

export default function DailyChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ title: '', assignee: '대표', link: '', memo: '' })

  const load = useCallback(async () => {
    const res = await listDailyChecklist()
    setItems(res.items)
    setDate(res.date)
    setTableMissing(!!res.tableMissing)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = async (item: ChecklistItem) => {
    setBusyId(item.id)
    setError(null)
    // 낙관적 반영
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, checked: !item.checked } : x)))
    const res = await toggleDailyCheck(item.id, !item.checked)
    if (!res.ok) {
      // 실패 시 롤백
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, checked: item.checked } : x)))
      setError(res.error ?? '체크 실패')
    }
    setBusyId(null)
  }

  const add = async () => {
    if (!f.title.trim()) { setError('항목명을 입력하세요.'); return }
    setSaving(true)
    setError(null)
    const res = await addChecklistItem({
      title: f.title, assignee: f.assignee, link: f.link || null, memo: f.memo || null,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error ?? '추가 실패'); return }
    setItems((prev) => [
      ...prev,
      {
        id: res.id ?? Date.now(), title: f.title.trim(), memo: f.memo.trim() || null,
        link: f.link.trim() || null, assignee: f.assignee.trim() || '대표',
        sort_order: 99, checked: false,
      },
    ])
    setF({ title: '', assignee: '대표', link: '', memo: '' })
    setShowAdd(false)
  }

  const remove = async (id: number) => {
    if (!confirm('이 체크 항목을 삭제할까요?')) return
    setBusyId(id)
    const res = await deleteChecklistItem(id)
    setBusyId(null)
    if (!res.ok) { setError(res.error ?? '삭제 실패'); return }
    setItems((prev) => prev.filter((x) => x.id !== id))
  }

  const done = items.filter((i) => i.checked).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ListTodo className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />
          1일 체크리스트
          <span className="text-xs font-normal text-slate-400">
            · {date} · 매일 새로 시작
          </span>
          {items.length > 0 && (
            <span
              className="ml-auto text-xs font-bold tabular-nums"
              style={{ color: done === items.length ? 'var(--nv-success-deep, #4a7c00)' : 'var(--nv-mute)' }}
            >
              {done}/{items.length} 완료
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-400 py-4 text-center">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            불러오는 중...
          </p>
        ) : tableMissing ? (
          <p className="text-xs text-rose-600 bg-rose-50 rounded p-3">
            체크리스트 테이블이 없습니다 —{' '}
            <code>supabase/migrations/2026-07-02_daily_checklist.sql</code> 을 실행해 주세요.
          </p>
        ) : (
          <>
            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 rounded p-2">⚠ {error}</p>
            )}
            {items.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">
                체크 항목이 없습니다. 아래에서 추가하세요.
              </p>
            ) : (
              <div className="space-y-1.5">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-start gap-2.5 rounded-lg p-2.5"
                    style={{ backgroundColor: it.checked ? 'rgba(118,185,0,0.07)' : 'var(--nv-surface-soft, #f8fafc)' }}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(it)}
                      disabled={busyId === it.id}
                      className="mt-0.5 shrink-0"
                      title={it.checked ? '체크 해제' : '완료 체크'}
                    >
                      {busyId === it.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      ) : it.checked ? (
                        <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--nv-primary)' }} />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-sm font-medium ${it.checked ? 'line-through text-slate-400' : 'text-slate-800'}`}
                        >
                          {it.title}
                        </span>
                        {/* 담당자 */}
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: '2px' }}
                        >
                          {it.assignee}
                        </span>
                        {it.link && (
                          <Link
                            href={it.link}
                            className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:underline shrink-0"
                          >
                            바로가기 <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                      {it.memo && (
                        <p className="mt-0.5 text-[11px] text-slate-500">{it.memo}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(it.id)}
                      disabled={busyId === it.id}
                      className="shrink-0 p-1 text-slate-300 hover:text-slate-500"
                      title="항목 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 항목 추가 */}
            {showAdd ? (
              <div className="space-y-2 border-t pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="항목명 (예: 색동 선물 내역 입력)"
                    className="col-span-2 h-8 px-2 text-sm border rounded outline-none"
                    value={f.title}
                    onChange={(e) => setF({ ...f, title: e.target.value })}
                  />
                  <input
                    placeholder="담당자"
                    className="h-8 px-2 text-sm border rounded outline-none"
                    value={f.assignee}
                    onChange={(e) => setF({ ...f, assignee: e.target.value })}
                  />
                  <input
                    placeholder="링크 (선택, 예: /saekdong)"
                    className="h-8 px-2 text-sm border rounded outline-none"
                    value={f.link}
                    onChange={(e) => setF({ ...f, link: e.target.value })}
                  />
                  <input
                    placeholder="설명 (선택)"
                    className="col-span-2 h-8 px-2 text-sm border rounded outline-none"
                    value={f.memo}
                    onChange={(e) => setF({ ...f, memo: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={add}
                    disabled={saving}
                    className="h-8 px-3 text-xs font-bold inline-flex items-center gap-1"
                    style={{ backgroundColor: 'var(--nv-primary)', color: '#000', borderRadius: '2px' }}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    추가
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="h-8 px-3 text-xs font-bold border rounded text-slate-500"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="w-full h-8 text-xs font-bold border border-dashed rounded text-slate-400 hover:text-slate-600 hover:border-slate-400 transition inline-flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 체크 항목 추가
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
