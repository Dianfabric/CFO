'use client'

import { useEffect, useRef, useState } from 'react'
import { api, fmtD, BookCard, MgrBadge, StatusBadge, MANAGERS, type BookRow, type RentalRow } from '../_lib/helpers'
import { PhotoButton, uploadBookPhoto } from './widgets'

const STATUSES = ['전체', '대여가능', '대여중', '연체중']

export default function BooksTab({ toast }: { toast: (m: string) => void }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('전체')
  const [mgr, setMgr] = useState('')
  const [odMin, setOdMin] = useState(0)
  const [books, setBooks] = useState<BookRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<{ book: BookRow; history: RentalRow[] } | null>(null)
  const [showNew, setShowNew] = useState(false)
  const reload = useRef(0)

  const isOd = status === '연체중'

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q, limit: '60' })
      if (status !== '전체') params.set('status', status)
      if (mgr) params.set('manager', mgr)
      if (odMin > 0) params.set('odMin', String(odMin))
      api<{ books: BookRow[]; total: number }>(`/api/samples/books?${params}`)
        .then((r) => { setBooks(r.books); setTotal(r.total) })
        .catch((e) => toast(`❌ ${e.message}`))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, mgr, odMin, reload.current])

  const loadMore = () => {
    const params = new URLSearchParams({ q, limit: '60', offset: String(books.length) })
    if (status !== '전체') params.set('status', status)
    if (mgr) params.set('manager', mgr)
    if (odMin > 0) params.set('odMin', String(odMin))
    api<{ books: BookRow[] }>(`/api/samples/books?${params}`)
      .then((r) => setBooks((b) => [...b, ...r.books])).catch(() => {})
  }

  const openDetail = (id: string) =>
    api<{ book: BookRow; history: RentalRow[] }>(`/api/samples/books/${id}`).then(setDetail).catch((e) => toast(`❌ ${e.message}`))

  const downloadExcel = async () => {
    const params = new URLSearchParams({ q, status: isOd ? '연체중' : status !== '전체' ? status : '연체중', limit: '500' })
    if (mgr) params.set('manager', mgr)
    if (odMin > 0) params.set('odMin', String(odMin))
    const { books: all } = await api<{ books: BookRow[] }>(`/api/samples/books?${params}`)
    const XLSX = await import('xlsx')
    const aoa = [
      ['샘플북', '첫원단명', '브랜드', '거래처', '담당자', '대여일', '반납예정일', '연체일수'],
      ...all.map((b) => [b.code, b.first_fabric || '', b.brand || '', b.active_client_name || '', b.manager || '', b.active_rented_at || '', b.active_due_at || '', b.overdue_days]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 9 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '연체현황')
    const label = [mgr, odMin > 0 ? `${odMin}일이상` : ''].filter(Boolean).join('_') || '전체'
    XLSX.writeFile(wb, `연체현황_${label}.xlsx`)
    toast(`⬇️ 연체 ${all.length}건 엑셀 저장 완료`)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 샘플북 이름·첫 원단명·브랜드 검색"
          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm sm:w-72" />
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold">
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={mgr} onChange={(e) => setMgr(e.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold">
          <option value="">담당자 전체</option>
          {MANAGERS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <span className="text-xs text-slate-500">연체</span>
        <input type="number" min={0} value={odMin || ''} placeholder="0"
          onChange={(e) => setOdMin(Math.max(0, Number(e.target.value) || 0))}
          className="h-10 w-20 rounded-md border border-slate-200 px-2 text-center text-sm" />
        <span className="text-xs text-slate-500">일 이상 · <b>{total.toLocaleString()}건</b></span>
        {isOd || odMin > 0 ? (
          <button onClick={downloadExcel} className="h-10 rounded-md bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200 sm:ml-auto">⬇️ 엑셀 내려받기</button>
        ) : (
          <button onClick={() => setShowNew(true)} className="ml-auto h-10 shrink-0 whitespace-nowrap rounded-md bg-slate-900 px-4 text-sm font-bold text-white">+ 샘플북 등록</button>
        )}
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        샘플북 {total.toLocaleString()}권 {loading ? '· 불러오는 중…' : ''}
      </p>

      {isOd ? (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {books.map((b) => (
            <button key={b.id} onClick={() => openDetail(b.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
              {b.image_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={b.image_url} alt="" className="h-11 w-11 rounded-lg object-cover" loading="lazy" />
                : <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-[9px] text-slate-400">사진</div>}
              <div className="min-w-0 flex-1">
                <span className="font-mono text-sm font-bold">{b.code}</span>
                <span className="ml-1.5 text-xs text-slate-500">{b.first_fabric}</span>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="truncate">{b.active_client_name}</span><MgrBadge m={b.manager} />
                </div>
                <div className="text-xs text-slate-500">{fmtD(b.active_rented_at)} 대여 → {fmtD(b.active_due_at)} 예정</div>
              </div>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">연체 {b.overdue_days}일</span>
            </button>
          ))}
          {!books.length && !loading && <div className="py-12 text-center text-sm text-slate-400">결과 없음</div>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {books.map((b) => <BookCard key={b.id} b={b} onClick={() => openDetail(b.id)} />)}
          {!books.length && !loading && <div className="col-span-full py-12 text-center text-sm text-slate-400">결과 없음</div>}
        </div>
      )}
      {books.length < total && (
        <button onClick={loadMore} className="mt-3 h-10 w-full rounded-md border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          더 보기 ({books.length}/{total.toLocaleString()})
        </button>
      )}

      {detail && (
        <BookDetailDialog detail={detail} toast={toast}
          onClose={() => setDetail(null)}
          onChanged={() => { reload.current++; setQ((v) => v) }} />
      )}
      {showNew && (
        <NewBookDialog toast={toast} onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); reload.current++; setQ((v) => v) }} />
      )}
    </div>
  )
}

/* ── 샘플북 상세 (사진 업로드 · QR 라벨 · 이력) ── */
function BookDetailDialog({ detail, onClose, onChanged, toast }: {
  detail: { book: BookRow; history: RentalRow[] }
  onClose: () => void
  onChanged: () => void
  toast: (m: string) => void
}) {
  const [book, setBook] = useState(detail.book)
  const [showQr, setShowQr] = useState(false)
  const qrRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!showQr || !qrRef.current) return
    // 간단 QR 표현(라벨 미리보기용) — 실제 인쇄는 기존 아이라벨 프로세스 사용
    const cv = qrRef.current, ctx = cv.getContext('2d')!
    const n = 21, s = cv.width / n
    let h = 0
    for (const ch of book.code) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    const rnd = () => (h = (h * 1103515245 + 12345) >>> 0) / 4294967295
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#111'
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (rnd() > 0.5) ctx.fillRect(x * s, y * s, s, s)
    const f = (fx: number, fy: number) => {
      ctx.fillStyle = '#111'; ctx.fillRect(fx * s, fy * s, 7 * s, 7 * s)
      ctx.fillStyle = '#fff'; ctx.fillRect((fx + 1) * s, (fy + 1) * s, 5 * s, 5 * s)
      ctx.fillStyle = '#111'; ctx.fillRect((fx + 2) * s, (fy + 2) * s, 3 * s, 3 * s)
    }
    f(0, 0); f(n - 7, 0); f(0, n - 7)
  }, [showQr, book.code])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-lg font-extrabold">{book.code}</span>
          <StatusBadge status={book.status} od={book.overdue_days} />
        </div>
        {book.first_fabric && <div className="mt-1 font-bold">{book.first_fabric}</div>}
        <div className="mt-0.5 text-sm text-slate-500">{book.brand}{book.book_type ? ` · ${book.book_type}` : ''} · 대여누적 {book.rental_count}회</div>
        {book.active_client_name && (
          <p className="mt-1.5 text-sm">현재: <b>{book.active_client_name}</b> ({fmtD(book.active_rented_at)} ~ {fmtD(book.active_due_at)}) <MgrBadge m={book.manager} /></p>
        )}

        <div className="relative mt-3 h-52 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200">
          {book.image_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={book.image_url} alt={book.code} className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center text-sm text-slate-400">사진 없음</div>}
        </div>
        <div className="mt-2 flex gap-2">
          <PhotoButton
            label={book.image_url ? '🔄 사진 변경' : '📷 사진 추가'}
            className="h-10 flex-1 rounded-md bg-slate-900 text-sm font-bold text-white"
            onPicked={async (blob) => {
              try {
                const url = await uploadBookPhoto(book.id, blob)
                setBook((b) => ({ ...b, image_url: url }))
                toast(`📷 ${book.code} 사진 저장 완료`)
                onChanged()
              } catch (e) { toast(`❌ 사진 업로드 실패: ${e instanceof Error ? e.message : e}`) }
            }}
          />
          <button onClick={() => setShowQr((v) => !v)} className="h-10 flex-1 rounded-md border border-slate-200 text-sm font-bold text-slate-700">🏷️ QR 라벨</button>
        </div>
        {showQr && (
          <div className="mt-3 flex flex-col items-center gap-1 rounded-xl border border-slate-200 p-4">
            <canvas ref={qrRef} width={150} height={150} />
            <span className="font-mono text-sm font-bold">{book.code}</span>
            <span className="text-[11px] text-slate-400">QR 값 = 샘플북 이름 (기존 바코드 라벨과 호환)</span>
          </div>
        )}

        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">이 샘플북의 대여 이력</p>
        <div className="flex flex-col gap-2.5 border-l-2 border-slate-100 pl-4 text-[13px]">
          {detail.history.map((r) => (
            <div key={r.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-900" />
              <b>{r.client_name || '(거래처 미상)'}</b>{' '}
              <span className="text-slate-500">{fmtD(r.rented_at)} 대여 → {r.returned_at ? `${fmtD(r.returned_at)} 반납` : '대여중'}</span>
            </div>
          ))}
          {!detail.history.length && <span className="text-xs text-slate-400">이력 없음</span>}
        </div>

        <button onClick={onClose} className="mt-4 h-10 w-full rounded-md bg-slate-900 text-sm font-bold text-white">닫기</button>
      </div>
    </div>
  )
}

/* ── 샘플북 신규 등록 ── */
function NewBookDialog({ onCreated, onClose, toast }: {
  onCreated: () => void
  onClose: () => void
  toast: (m: string) => void
}) {
  const [form, setForm] = useState({ code: '', first_fabric: '', brand: '', book_type: 'BOOK', manager: '' })
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!form.code.trim()) { setErr('샘플북 이름을 입력해주세요 (예: DN#209)'); return }
    setSaving(true); setErr('')
    try {
      const { book } = await api<{ book: { id: string } }>('/api/samples/books', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (photo) { try { await uploadBookPhoto(book.id, photo.blob) } catch { toast('사진 업로드 실패 — 상세에서 다시 시도하세요') } }
      toast(`✅ ${form.code} 등록 완료`)
      onCreated()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-extrabold">샘플북 신규 등록</h3>
        <div className="mb-3 flex items-center gap-3">
          {photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photo.url} alt="" className="h-20 w-20 rounded-xl object-cover" />
            : <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-[10px] text-slate-400">사진</div>}
          <PhotoButton label={photo ? '🔄 사진 변경' : '📷 사진 촬영'} onPicked={(blob, url) => setPhoto({ blob, url })} />
        </div>
        {([['샘플북 이름 *', 'code', '예: DN#209'], ['첫 원단명', 'first_fabric', '예: ANNA-GREY'], ['브랜드', 'brand', '예: DIAN']] as const).map(([label, key, ph]) => (
          <div key={key} className="mb-2.5">
            <div className="mb-1 text-xs font-semibold text-slate-500">{label}</div>
            <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={ph}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
          </div>
        ))}
        <div className="mb-3 flex gap-2">
          <select value={form.book_type} onChange={(e) => setForm((f) => ({ ...f, book_type: e.target.value }))}
            className="h-10 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm">
            {['BOOK', 'HANGER', 'Swatch', 'PANTON'].map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={form.manager} onChange={(e) => setForm((f) => ({ ...f, manager: e.target.value }))}
            className="h-10 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm">
            <option value="">담당자 (선택)</option>
            {MANAGERS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="h-10 flex-1 rounded-md border border-slate-200 text-sm font-semibold text-slate-600">취소</button>
          <button onClick={save} disabled={saving} className="h-10 flex-1 rounded-md bg-slate-900 text-sm font-bold text-white disabled:opacity-60">
            {saving ? '등록 중…' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
