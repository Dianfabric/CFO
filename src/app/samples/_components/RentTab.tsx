'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, fmtD, BookCard, MgrBadge, StatusBadge, MANAGERS, type BookRow, type ClientRow } from '../_lib/helpers'
import { QrScanDialog, PhotoButton, NewClientDialog, uploadBookPhoto } from './widgets'

type CartItem = { book: BookRow; manager: string; photoBlob?: Blob; photoUrl?: string }

export default function RentTab({ onDone, toast }: { onDone: () => void; toast: (m: string) => void }) {
  const [client, setClient] = useState<ClientRow | null>(null)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [renters, setRenters] = useState<ClientRow[]>([])
  const [clientQ, setClientQ] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)

  // 기본 표시용: 현재 대여중인 거래처
  useEffect(() => {
    api<{ clients: ClientRow[] }>('/api/samples/clients?renting=1')
      .then((r) => setRenters(r.clients)).catch(() => {})
  }, [])

  const [cart, setCart] = useState<CartItem[]>([])
  const [bulkMgr, setBulkMgr] = useState('')
  const [bookQ, setBookQ] = useState('')
  const [bookSugs, setBookSugs] = useState<BookRow[]>([])
  const [activeBooks, setActiveBooks] = useState<BookRow[]>([])
  const [showScan, setShowScan] = useState(false)
  const [saving, setSaving] = useState(false)

  // 거래처 목록 (검색 디바운스)
  useEffect(() => {
    const t = setTimeout(() => {
      api<{ clients: ClientRow[] }>(`/api/samples/clients?q=${encodeURIComponent(clientQ)}&limit=100`)
        .then((r) => setClients(r.clients)).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [clientQ])

  // 선택 거래처의 현재 대여중
  const loadActive = useCallback((cid: string) => {
    api<{ activeBooks: BookRow[] }>(`/api/samples/clients/${cid}`)
      .then((r) => setActiveBooks(r.activeBooks)).catch(() => setActiveBooks([]))
  }, [])
  useEffect(() => { if (client) loadActive(client.id) }, [client, loadActive])

  // 샘플북 검색 제안
  useEffect(() => {
    if (!bookQ.trim()) { setBookSugs([]); return }
    const t = setTimeout(() => {
      api<{ books: BookRow[] }>(`/api/samples/books?q=${encodeURIComponent(bookQ)}&limit=8`)
        .then((r) => setBookSugs(r.books.filter((b) => !cart.some((c) => c.book.id === b.id))))
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [bookQ, cart])

  const addBook = (b: BookRow) => {
    if (cart.some((c) => c.book.id === b.id)) return
    setCart((c) => [...c, { book: b, manager: bulkMgr }])
    setBookQ(''); setBookSugs([])
    if (b.status !== '대여가능') toast(`⚠️ ${b.code}는 ${b.active_client_name || '다른 거래처'}가 대여중입니다 — 등록하려면 빼야 해요`)
    else toast(`${b.code} 담았습니다`)
  }

  const onScan = useCallback((code: string) => {
    setShowScan(false)
    api<{ books: BookRow[] }>(`/api/samples/books?q=${encodeURIComponent(code)}&limit=5`)
      .then((r) => {
        const exact = r.books.find((b) => b.code.toLowerCase() === code.toLowerCase()) || r.books[0]
        if (!exact) { toast(`❌ '${code}' 샘플북을 찾을 수 없어요`); return }
        addBook(exact)
        setShowScan(true) // 연속 스캔
      }).catch(() => toast('조회 실패 — 다시 시도해주세요'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, bulkMgr])

  const warnItems = cart.filter((c) => c.book.status !== '대여가능')
  const missingMgr = cart.filter((c) => !c.manager)

  const register = async () => {
    if (!client || !cart.length) return
    if (warnItems.length) { toast(`⚠️ 대여중인 샘플북 ${warnItems.length}권을 빼주세요`); return }
    if (missingMgr.length) { toast(`⚠️ 담당자 미입력 ${missingMgr.length}권 — 담당자는 필수입니다`); return }
    setSaving(true)
    try {
      await api('/api/samples/rentals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, items: cart.map((c) => ({ bookId: c.book.id, manager: c.manager })) }),
      })
      // 사진 업로드 (있는 것만, 실패해도 대여는 유지)
      for (const c of cart) {
        if (c.photoBlob) { try { await uploadBookPhoto(c.book.id, c.photoBlob) } catch { toast(`사진 업로드 실패: ${c.book.code}`) } }
      }
      toast(`✅ ${client.name} · ${cart.length}권 대여 등록 완료`)
      setCart([]); setClient(null); setBulkMgr('')
      onDone()
    } catch (e) { toast(`❌ ${e instanceof Error ? e.message : e}`) } finally { setSaving(false) }
  }

  const mgrSelect = (value: string, onChange: (v: string) => void) => (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className={`h-9 max-w-[150px] rounded-md border px-2 text-[13px] font-semibold ${value ? 'border-slate-200 bg-white' : 'border-red-300 bg-red-50 text-red-600'}`}
    >
      <option value="">담당자 선택 *</option>
      {MANAGERS.map((m) => <option key={m}>{m}</option>)}
    </select>
  )

  /* ── 1단계: 거래처 선택 (검색=전체 거래처, 기본 목록=대여중 거래처) ── */
  if (!client) {
    const searching = clientQ.trim().length > 0
    const list = searching ? clients : renters
    return (
      <div>
        <div className="mb-3 flex gap-2">
          <input value={clientQ} onChange={(e) => setClientQ(e.target.value)} placeholder="🔍 거래처 이름·전화 검색 (전체 거래처)"
            className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm" />
          <button onClick={() => setShowNewClient(true)} className="h-10 rounded-md bg-slate-100 px-4 text-sm font-bold text-slate-700 hover:bg-slate-200">+ 신규</button>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {searching ? '검색 결과 — 선택하면 대여 화면으로 들어갑니다' : `현재 대여중인 거래처 (${renters.length}) — 다른 거래처는 위에서 검색`}
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <button key={c.id} onClick={() => { setClient(c); setCart([]) }}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 hover:shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="text-xs text-slate-500">{c.phone}{c.active ? ` · ${c.active}권 대여중` : ''}</div>
              </div>
              {c.overdue ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">🚨 연체 {c.overdue}</span>
                : c.active ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">대여중 {c.active}</span> : null}
            </button>
          ))}
          {!list.length && <div className="col-span-full py-12 text-center text-sm text-slate-400">{searching ? '검색 결과 없음' : '대여중인 거래처가 없습니다'}</div>}
        </div>
        {showNewClient && (
          <NewClientDialog onClose={() => setShowNewClient(false)}
            onCreated={(c) => { setShowNewClient(false); setClient({ ...c, email: null, job_types: [], note: null }); toast('거래처가 등록되었습니다') }} />
        )}
      </div>
    )
  }

  /* ── 2단계: 샘플북 담기 → 한번에 등록 ── */
  return (
    <div className="pb-24">
      <button onClick={() => { setClient(null); setCart([]) }} className="mb-3 text-sm font-bold text-slate-600 hover:text-slate-900">← 거래처 다시 선택</button>

      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-base font-extrabold">{client.name}</div>
        <div className="text-xs text-slate-500">{client.phone}{activeBooks.length ? ` · 현재 ${activeBooks.length}권 대여중` : ''}</div>
      </div>

      <button onClick={() => setShowScan(true)} className="h-12 w-full rounded-md bg-slate-900 text-[15px] font-bold text-white">📷 QR 스캔으로 담기</button>

      <div className="relative mt-2">
        <input value={bookQ} onChange={(e) => setBookQ(e.target.value)} placeholder="🔍 샘플북 이름·첫 원단명으로 검색"
          className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm" />
        {bookSugs.length > 0 && (
          <div className="absolute inset-x-0 top-12 z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {bookSugs.map((b) => (
              <button key={b.id} onClick={() => addBook(b)}
                className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50">
                <span className="font-mono text-sm font-bold">{b.code}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{b.first_fabric}</span>
                <StatusBadge status={b.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">담은 샘플북 ({cart.length})</p>
      {cart.length > 0 && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-2.5">
          <span className="text-[13px] font-bold">담당자 일괄 지정</span>
          {mgrSelect(bulkMgr, (v) => { setBulkMgr(v); if (v) setCart((c) => c.map((i) => ({ ...i, manager: v }))) })}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {cart.map((item, i) => (
          <div key={item.book.id} className={`rounded-xl border bg-white p-3 ${item.book.status !== '대여가능' ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
            {item.book.status !== '대여가능' && (
              <p className="mb-2 text-xs font-semibold text-red-600">⚠️ {item.book.active_client_name || '다른 거래처'}가 {item.book.status} — 등록하려면 빼야 합니다</p>
            )}
            <div className="flex items-center gap-3">
              {item.photoUrl || item.book.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photoUrl || item.book.image_url!} alt="" className="h-13 w-13 rounded-lg object-cover" style={{ width: 52, height: 52 }} />
              ) : (
                <div className="flex items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400" style={{ width: 52, height: 52 }}>사진</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm font-bold">{item.book.code}</div>
                {item.book.first_fabric && <div className="truncate text-xs font-semibold">{item.book.first_fabric}</div>}
                <div className="truncate text-xs text-slate-500">{item.book.brand}{item.book.book_type ? ` · ${item.book.book_type}` : ''}</div>
              </div>
              <StatusBadge status={item.book.status} />
              <button onClick={() => setCart((c) => c.filter((_, idx) => idx !== i))} aria-label="빼기"
                className="h-8 w-8 rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50">✕</button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <PhotoButton
                label={item.photoUrl ? '🔄 사진 변경' : '📷 사진 추가'}
                onPicked={(blob, url) => setCart((c) => c.map((x, idx) => idx === i ? { ...x, photoBlob: blob, photoUrl: url } : x))}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">담당자</span>
                {mgrSelect(item.manager, (v) => setCart((c) => c.map((x, idx) => idx === i ? { ...x, manager: v } : x)))}
              </div>
            </div>
          </div>
        ))}
        {!cart.length && (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            스캔하거나 검색해서 샘플북을 계속 담고,<br />다 담은 뒤 한 번에 등록하세요
          </div>
        )}
      </div>

      {activeBooks.length > 0 && (
        <>
          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">이 거래처가 현재 대여중 ({activeBooks.length})</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {activeBooks.map((b) => <BookCard key={b.id} b={b} />)}
          </div>
        </>
      )}

      {cart.length > 0 && (
        <div className="fixed inset-x-3 bottom-16 z-40 mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 pl-4 shadow-xl md:bottom-6">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">샘플북 {cart.length}권</div>
            <div className="text-xs text-slate-500">반납예정 {fmtD(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))} (대여일 +7일)</div>
          </div>
          <button onClick={register} disabled={saving}
            className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? '등록 중…' : '한번에 등록'}
          </button>
        </div>
      )}

      {showScan && <QrScanDialog title="QR 스캔 — 대여" onDetect={onScan} onClose={() => setShowScan(false)} />}
    </div>
  )
}
