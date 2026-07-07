'use client'

import { useEffect, useState } from 'react'
import { api, fmtD, BookCard, type BookRow, type ClientRow, type RentalRow } from '../_lib/helpers'
import { NewClientDialog } from './widgets'

type SmsRow = { id: number; sms_type: string; message: string | null; status: string | null; sent_at: string }

export default function ClientsTab({ toast }: { toast: (m: string) => void }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<ClientRow[]>([])
  const [total, setTotal] = useState(0)
  const [detail, setDetail] = useState<{ client: ClientRow; activeBooks: BookRow[]; history: RentalRow[]; sms: SmsRow[] } | null>(null)
  const [showNew, setShowNew] = useState(false)

  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ clients: ClientRow[]; total: number }>(`/api/samples/clients?q=${encodeURIComponent(q)}&limit=200`)
        .then((r) => { setList(r.clients); setTotal(r.total) }).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [q, refresh])

  const [showEdit, setShowEdit] = useState(false)

  const openDetail = (id: string) => {
    api<{ client: ClientRow; activeBooks: BookRow[]; history: RentalRow[]; sms: SmsRow[] }>(`/api/samples/clients/${id}`)
      .then(setDetail).catch((e) => toast(`❌ ${e.message}`))
  }

  const removeClient = async () => {
    if (!detail) return
    if (!window.confirm(`'${detail.client.name}' 거래처를 삭제할까요?\n과거 대여 이력은 텍스트로 보존됩니다.`)) return
    try {
      await api(`/api/samples/clients/${detail.client.id}`, { method: 'DELETE' })
      toast(`🗑 ${detail.client.name} 삭제 완료`)
      setDetail(null)
      setRefresh((r) => r + 1)
    } catch (e) { toast(`❌ ${e instanceof Error ? e.message : e}`) }
  }

  const share = async () => {
    if (!detail) return
    const { client, activeBooks } = detail
    const lines = activeBooks.map((b) => {
      const days = b.active_rented_at ? Math.max(1, Math.round((Date.now() - new Date(b.active_rented_at).getTime()) / 86400000)) : 0
      return `· ${b.code}${b.first_fabric ? ` (${b.first_fabric})` : ''} — 대여 ${days}일차, ${fmtD(b.active_due_at)} 반납예정${b.image_url ? `\n  사진: ${b.image_url.split('?')[0]}` : ''}`
    })
    const text = `[DIAN] ${client.name}님 대여중인 샘플북 ${activeBooks.length}권\n${lines.join('\n')}\n\n반납 시 쇼룸 방문 또는 택배 발송 부탁드립니다.`
    if (navigator.share) {
      try { await navigator.share({ text }); toast('공유했습니다') } catch { /* 취소 */ }
    } else {
      await navigator.clipboard.writeText(text)
      toast('📋 공유 내용을 복사했습니다 — 문자/카톡에 붙여넣기 하세요')
    }
  }

  /* ── 상세 ── */
  if (detail) {
    const { client, activeBooks, history, sms } = detail
    return (
      <div>
        <button onClick={() => setDetail(null)} className="mb-3 text-sm font-bold text-slate-600 hover:text-slate-900">← 거래처 목록</button>
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-base font-extrabold">{client.name}</div>
              <div className="mt-1 text-sm text-slate-500">{client.phone}</div>
              {client.email && <div className="text-xs text-slate-400">{client.email}</div>}
              <div className="mt-2 flex gap-1.5">
                {(client.job_types || []).map((j) => (
                  <span key={j} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{j}</span>
                ))}
              </div>
              {client.note && <p className="mt-2 text-xs text-slate-500">{client.note}</p>}
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                <button onClick={() => setShowEdit(true)}
                  className="h-9 flex-1 rounded-md bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200">✏️ 정보 수정</button>
                <button onClick={removeClient}
                  className="h-9 flex-1 rounded-md bg-red-50 text-xs font-bold text-red-600 hover:bg-red-100">🗑 거래처 삭제</button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">문자 발송 이력</p>
              <div className="flex flex-col gap-2 text-[13px]">
                {sms.map((s) => (
                  <div key={s.id} className="flex gap-2">
                    <span className="shrink-0 text-xs text-slate-400">{fmtD(s.sent_at?.slice(0, 10))}</span>
                    <span className="truncate">{s.sms_type === 'welcome' ? '웰컴 문자' : s.sms_type === 'overdue' ? '연체 안내' : s.sms_type}</span>
                  </div>
                ))}
                {!sms.length && <span className="text-xs text-slate-400">발송 이력 없음</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">현재 대여중 ({activeBooks.length})</p>
                {activeBooks.length > 0 && (
                  <button onClick={share} className="h-8 rounded-md bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200">📤 대여 현황 공유</button>
                )}
              </div>
              {activeBooks.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {activeBooks.map((b) => <BookCard key={b.id} b={b} />)}
                </div>
              ) : <div className="py-8 text-center text-sm text-slate-400">대여중인 샘플북 없음</div>}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">대여 이력 ({history.length})</p>
              <div className="flex flex-col gap-3 border-l-2 border-slate-100 pl-4 text-[13px]">
                {history.map((r) => (
                  <div key={r.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-900" />
                    <span className="font-mono font-bold">{r.book_code}</span>{' '}
                    <span className="text-slate-500">
                      {fmtD(r.rented_at)} 대여 → {r.returned_at ? `${fmtD(r.returned_at)} 반납` : new Date(r.due_at) < new Date() ? '연체중' : '대여중'}
                    </span>
                  </div>
                ))}
                {!history.length && <span className="text-xs text-slate-400">이력 없음</span>}
              </div>
            </div>
          </div>
        </div>
        {showEdit && (
          <EditClientDialog client={client} onClose={() => setShowEdit(false)}
            onSaved={() => { setShowEdit(false); toast('✏️ 수정 완료'); openDetail(client.id); setRefresh((r) => r + 1) }} />
        )}
      </div>
    )
  }

  /* ── 목록 ── */
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 이름·전화 검색"
          className="h-10 w-full max-w-md rounded-md border border-slate-200 px-3 text-sm" />
        <button onClick={() => setShowNew(true)} className="ml-auto h-10 rounded-md bg-slate-900 px-4 text-sm font-bold text-white">+ 신규 거래처</button>
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">거래처 {total.toLocaleString()}곳</p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <button key={c.id} onClick={() => openDetail(c.id)}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 hover:shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{c.name}</div>
              <div className="text-xs text-slate-500">{c.phone}{c.job_types?.length ? ` · ${c.job_types.join('/')}` : ''}</div>
            </div>
            {c.overdue ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">연체 {c.overdue}</span>
              : c.active ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">대여 {c.active}</span> : null}
          </button>
        ))}
        {!list.length && <div className="col-span-full py-12 text-center text-sm text-slate-400">검색 결과 없음</div>}
      </div>
      {showNew && (
        <NewClientDialog onClose={() => setShowNew(false)}
          onCreated={(c) => { setShowNew(false); toast('거래처가 등록되었습니다'); openDetail(c.id); setRefresh((r) => r + 1) }} />
      )}
    </div>
  )
}

/* ── 거래처 정보 수정 ── */
function EditClientDialog({ client, onSaved, onClose }: {
  client: ClientRow
  onSaved: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: client.name, phone: client.phone || '', email: client.email || '',
    note: client.note || '', jobs: client.job_types || [],
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!form.name.trim()) { setErr('거래처 이름을 입력해주세요'); return }
    setSaving(true); setErr('')
    try {
      await api(`/api/samples/clients/${client.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, phone: form.phone, email: form.email, note: form.note, job_types: form.jobs }),
      })
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setSaving(false) }
  }

  const toggleJob = (j: string) =>
    setForm((f) => ({ ...f, jobs: f.jobs.includes(j) ? f.jobs.filter((x) => x !== j) : [...f.jobs, j] }))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[86vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-extrabold">거래처 정보 수정</h3>
        {([['거래처 이름 *', 'name'], ['전화번호', 'phone'], ['이메일', 'email'], ['비고', 'note']] as const).map(([label, key]) => (
          <div key={key} className="mb-2.5">
            <div className="mb-1 text-xs font-semibold text-slate-500">{label}</div>
            <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
          </div>
        ))}
        <div className="mb-3 flex gap-2">
          {['인테리어', '디자인'].map((j) => (
            <button key={j} onClick={() => toggleJob(j)}
              className={`h-8 rounded-full border px-3 text-xs font-semibold ${form.jobs.includes(j) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500'}`}
            >{j}</button>
          ))}
        </div>
        {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="h-10 flex-1 rounded-md border border-slate-200 text-sm font-semibold text-slate-600">취소</button>
          <button onClick={save} disabled={saving} className="h-10 flex-1 rounded-md bg-slate-900 text-sm font-bold text-white disabled:opacity-60">
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
