'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, BookCard, StatusBadge, type BookRow, type ClientRow } from '../_lib/helpers'
import { QrScanDialog } from './widgets'

export default function ReturnTab({ onDone, toast }: { onDone: () => void; toast: (m: string) => void }) {
  const [renters, setRenters] = useState<ClientRow[]>([])
  const [clientQ, setClientQ] = useState('')
  const [bookQ, setBookQ] = useState('')
  const [bookSugs, setBookSugs] = useState<BookRow[]>([])
  const [client, setClient] = useState<ClientRow | null>(null)
  const [books, setBooks] = useState<BookRow[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set()) // rental id
  const [showScan, setShowScan] = useState(false)
  const [confirmBook, setConfirmBook] = useState<BookRow | null>(null)
  const [saving, setSaving] = useState(false)

  const loadRenters = useCallback(() => {
    api<{ clients: ClientRow[] }>(`/api/samples/clients?renting=1&q=${encodeURIComponent(clientQ)}`)
      .then((r) => setRenters(r.clients)).catch(() => {})
  }, [clientQ])
  useEffect(() => { const t = setTimeout(loadRenters, 250); return () => clearTimeout(t) }, [loadRenters])

  // 샘플북으로 찾기 (대여중·연체중만)
  useEffect(() => {
    if (!bookQ.trim()) { setBookSugs([]); return }
    const t = setTimeout(() => {
      api<{ books: BookRow[] }>(`/api/samples/books?q=${encodeURIComponent(bookQ)}&limit=10`)
        .then((r) => setBookSugs(r.books.filter((b) => b.active_rental_id)))
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [bookQ])

  const enterClient = useCallback((c: ClientRow, preCheckRentalId?: string) => {
    setClient(c); setChecked(preCheckRentalId ? new Set([preCheckRentalId]) : new Set())
    api<{ activeBooks: BookRow[] }>(`/api/samples/clients/${c.id}`)
      .then((r) => setBooks(r.activeBooks)).catch(() => setBooks([]))
  }, [])

  const pickBook = (b: BookRow) => {
    setBookQ(''); setBookSugs([])
    enterClient({ id: b.active_client_id!, name: b.active_client_name || '', phone: b.active_client_phone, email: null, job_types: [], note: null }, b.active_rental_id!)
  }

  const onScan = useCallback((code: string) => {
    setShowScan(false)
    api<{ books: BookRow[] }>(`/api/samples/books?q=${encodeURIComponent(code)}&limit=5`)
      .then((r) => {
        const b = r.books.find((x) => x.code.toLowerCase() === code.toLowerCase()) || r.books[0]
        if (!b) { toast(`❌ '${code}' 샘플북을 찾을 수 없어요`); return }
        if (!b.active_rental_id) { toast(`${b.code}는 대여중이 아닙니다 (${b.status})`); return }
        setConfirmBook(b)
      }).catch(() => toast('조회 실패 — 다시 시도해주세요'))
  }, [toast])

  const doReturn = async (rentalIds: string[]) => {
    setSaving(true)
    try {
      const r = await api<{ returned: number; books: string[] }>('/api/samples/rentals/return', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rentalIds }),
      })
      toast(`↩️ ${r.books?.join(', ')} — ${r.returned}권 반납 완료`)
      setClient(null); setConfirmBook(null); loadRenters(); onDone()
    } catch (e) { toast(`❌ ${e instanceof Error ? e.message : e}`) } finally { setSaving(false) }
  }

  /* ── 거래처 반납 화면 ── */
  if (client) {
    return (
      <div>
        <button onClick={() => setClient(null)} className="mb-3 text-sm font-bold text-slate-600 hover:text-slate-900">← 반납 목록</button>
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-base font-extrabold">{client.name}</div>
          <div className="text-xs text-slate-500">{client.phone} · {books.length}권 대여중</div>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">체크한 샘플북이 반납 처리됩니다</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {books.map((b) => {
            const rid = b.active_rental_id!
            const sel = checked.has(rid)
            return (
              <BookCard key={b.id} b={b} selected={sel}
                onClick={() => setChecked((s) => { const n = new Set(s); if (n.has(rid)) n.delete(rid); else n.add(rid); return n })}
                right={
                  <div className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 text-sm font-bold ${sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-white bg-white/80 text-transparent'}`}>✓</div>
                }
              />
            )
          })}
        </div>
        <button
          onClick={() => { if (!checked.size) { toast('반납할 샘플북을 선택해주세요'); return } doReturn([...checked]) }}
          disabled={saving}
          className="mt-4 h-12 w-full rounded-md bg-slate-900 text-[15px] font-bold text-white disabled:opacity-60"
        >{saving ? '반납 처리 중…' : `선택한 샘플북 반납${checked.size ? ` (${checked.size})` : ''}`}</button>
      </div>
    )
  }

  /* ── 반납 목록 (QR / 샘플북 검색 / 거래처 검색) ── */
  return (
    <div>
      <button onClick={() => setShowScan(true)} className="h-12 w-full rounded-md bg-slate-900 text-[15px] font-bold text-white">📷 QR로 바로 반납</button>

      <div className="relative mt-2">
        <input value={bookQ} onChange={(e) => setBookQ(e.target.value)} placeholder="🔍 샘플북으로 찾기 (이름·첫 원단명)"
          className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm" />
        {bookSugs.length > 0 && (
          <div className="absolute inset-x-0 top-12 z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {bookSugs.map((b) => (
              <button key={b.id} onClick={() => pickBook(b)}
                className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50">
                <span className="font-mono text-sm font-bold">{b.code}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{b.first_fabric} · {b.active_client_name}</span>
                <StatusBadge status={b.status} od={b.overdue_days} />
              </button>
            ))}
          </div>
        )}
      </div>

      <input value={clientQ} onChange={(e) => setClientQ(e.target.value)} placeholder="🔍 거래처로 찾기"
        className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-sm" />

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">대여중인 거래처 ({renters.length})</p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {renters.map((c) => (
          <button key={c.id} onClick={() => enterClient(c)}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 hover:shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{c.name}</div>
              <div className="text-xs text-slate-500">{c.active}권 대여중</div>
            </div>
            {c.overdue ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">🚨 연체 {c.overdue}</span>
              : <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">대여중</span>}
          </button>
        ))}
        {!renters.length && <div className="col-span-full py-12 text-center text-sm text-slate-400">대여중인 거래처가 없습니다</div>}
      </div>

      {showScan && <QrScanDialog title="QR 스캔 — 반납" onDetect={onScan} onClose={() => setShowScan(false)} />}

      {confirmBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6" onClick={() => setConfirmBook(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-base font-extrabold">반납 확인</h3>
            <p className="mb-4 text-sm">
              <span className="font-mono font-bold">{confirmBook.code}</span> → <b>{confirmBook.active_client_name}</b><br />반납 처리할까요?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmBook(null)} className="h-10 flex-1 rounded-md border border-slate-200 text-sm font-semibold text-slate-600">취소</button>
              <button onClick={() => doReturn([confirmBook.active_rental_id!])} disabled={saving}
                className="h-10 flex-1 rounded-md bg-slate-900 text-sm font-bold text-white disabled:opacity-60">반납 처리</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
