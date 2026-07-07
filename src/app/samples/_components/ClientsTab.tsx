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

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ clients: ClientRow[]; total: number }>(`/api/samples/clients?q=${encodeURIComponent(q)}&limit=200`)
        .then((r) => { setList(r.clients); setTotal(r.total) }).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const openDetail = (id: string) => {
    api<{ client: ClientRow; activeBooks: BookRow[]; history: RentalRow[]; sms: SmsRow[] }>(`/api/samples/clients/${id}`)
      .then(setDetail).catch((e) => toast(`❌ ${e.message}`))
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
      <div className="mx-auto max-w-4xl">
        <button onClick={() => setDetail(null)} className="mb-3 text-sm font-bold text-slate-600 hover:text-slate-900">← 거래처 목록</button>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
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
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
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
      </div>
    )
  }

  /* ── 목록 ── */
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 이름·전화 검색"
          className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm" />
        <button onClick={() => setShowNew(true)} className="h-10 rounded-md bg-slate-900 px-4 text-sm font-bold text-white">+ 신규 거래처</button>
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">거래처 {total.toLocaleString()}곳</p>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {list.map((c) => (
          <button key={c.id} onClick={() => openDetail(c.id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{c.name}</div>
              <div className="text-xs text-slate-500">{c.phone}{c.job_types?.length ? ` · ${c.job_types.join('/')}` : ''}</div>
            </div>
            {c.overdue ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">연체 {c.overdue}</span>
              : c.active ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">대여 {c.active}</span> : null}
          </button>
        ))}
        {!list.length && <div className="py-12 text-center text-sm text-slate-400">검색 결과 없음</div>}
      </div>
      {showNew && (
        <NewClientDialog onClose={() => setShowNew(false)}
          onCreated={(c) => { setShowNew(false); toast('거래처가 등록되었습니다'); openDetail(c.id) }} />
      )}
    </div>
  )
}
