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

  /* 대여현황 리포트 (PDF: 페이지당 3열×3줄 / JPG: 한 장) — html2canvas는 tailwind oklch를
     못 읽어서 인라인 hex 스타일로만 렌더 */
  const buildReportEl = (books: BookRow[], clientName: string, pageInfo: string, width: number) => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`
    const el = document.createElement('div')
    el.style.cssText = `position:fixed;left:-12000px;top:0;width:${width}px;background:#ffffff;padding:36px;font-family:'Pretendard','Malgun Gothic',sans-serif;color:#0f172a;box-sizing:border-box`
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:18px">
        <div>
          <div style="font-size:21px;font-weight:800">[DIAN] 샘플북 대여 현황</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">${clientName} · 기준일 ${dateStr}</div>
        </div>
        <div style="font-size:11px;color:#94a3b8">${pageInfo}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
        ${books.map((b) => `
          <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
            <div style="height:230px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px">
              ${b.image_url ? `<img src="${b.image_url}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover">` : '사진 없음'}
            </div>
            <div style="padding:9px 11px;font-size:12px;line-height:1.5">
              <div style="font-weight:800;font-family:Consolas,monospace">${b.code}</div>
              ${b.first_fabric ? `<div style="font-weight:600">${b.first_fabric}</div>` : ''}
              <div style="color:#64748b">${b.brand || ''}</div>
              <div style="color:#64748b">대여 ${fmtD(b.active_rented_at)} ~ ${fmtD(b.active_due_at)}
                ${b.status === '연체중' ? `<span style="color:#dc2626;font-weight:700"> · 연체 ${b.overdue_days}일</span>` : ''}</div>
            </div>
          </div>`).join('')}
      </div>
      <div style="margin-top:16px;font-size:11px;color:#94a3b8">반납 시 쇼룸 방문 또는 택배 발송 부탁드립니다 · DIAN 02-6447-1221</div>`
    document.body.appendChild(el)
    return el
  }

  const waitImages = (el: HTMLElement) =>
    Promise.all(Array.from(el.querySelectorAll('img')).map((img) =>
      img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r })))

  const makeReportJpg = async (): Promise<Blob> => {
    const { client, activeBooks } = detail!
    const html2canvas = (await import('html2canvas')).default
    const el = buildReportEl(activeBooks, client.name, `총 ${activeBooks.length}권`, 1000)
    await waitImages(el)
    const canvas = await html2canvas(el, { useCORS: true, scale: 1.6, backgroundColor: '#ffffff' })
    el.remove()
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 생성 실패'))), 'image/jpeg', 0.88))
  }

  const downloadReport = async (fmt: 'pdf' | 'jpg') => {
    if (!detail) return
    const { client, activeBooks } = detail
    toast(`${fmt.toUpperCase()} 만드는 중… (사진 ${activeBooks.length}장)`)
    try {
      const html2canvas = (await import('html2canvas')).default
      const fname = `대여현황_${client.name.replace(/[\\/:*?"<>|]/g, '')}_${new Date().toISOString().slice(0, 10)}`
      if (fmt === 'jpg') {
        const blob = await makeReportJpg()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${fname}.jpg`
        a.click()
        URL.revokeObjectURL(a.href)
      } else {
        const { jsPDF } = await import('jspdf')
        const pages: BookRow[][] = []
        for (let i = 0; i < activeBooks.length; i += 9) pages.push(activeBooks.slice(i, i + 9))
        const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
        for (let p = 0; p < pages.length; p++) {
          const el = buildReportEl(pages[p], client.name, `${p + 1} / ${pages.length} 페이지 · 총 ${activeBooks.length}권`, 794)
          await waitImages(el)
          const canvas = await html2canvas(el, { useCORS: true, scale: 2, backgroundColor: '#ffffff' })
          el.remove()
          if (p > 0) pdf.addPage()
          const w = 595.28
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, w, (canvas.height * w) / canvas.width)
        }
        pdf.save(`${fname}.pdf`)
      }
      toast(`⬇️ ${fmt.toUpperCase()} 저장 완료`)
    } catch (e) {
      toast(`❌ ${fmt.toUpperCase()} 생성 실패: ${e instanceof Error ? e.message : e}`)
    }
  }

  // 공유 = 대여현황 JPG 이미지 자체를 공유 (카톡 등에서 사진으로 전송)
  const share = async () => {
    if (!detail) return
    const { client, activeBooks } = detail
    toast(`공유 이미지 만드는 중… (사진 ${activeBooks.length}장)`)
    try {
      const blob = await makeReportJpg()
      const file = new File([blob], `대여현황_${client.name.replace(/[\\/:*?"<>|]/g, '')}.jpg`, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: `[DIAN] ${client.name} 대여중인 샘플북 ${activeBooks.length}권 — 반납 시 쇼룸 방문 또는 택배 발송 부탁드립니다.`,
        })
        toast('📤 공유했습니다')
      } else {
        // 데스크탑 등 파일 공유 미지원 → JPG 저장으로 대체
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = file.name
        a.click()
        URL.revokeObjectURL(a.href)
        toast('이 브라우저는 파일 공유가 안 돼서 JPG로 저장했어요 — 카톡·문자에 첨부해주세요')
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast(`❌ 공유 실패: ${e instanceof Error ? e.message : e}`)
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
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">현재 대여중 ({activeBooks.length})</p>
                {activeBooks.length > 0 && (
                  <div className="flex gap-1.5">
                    <button onClick={share} className="h-8 rounded-md bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200">📤 공유</button>
                    <button onClick={() => downloadReport('pdf')} className="h-8 rounded-md bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200">⬇️ PDF</button>
                    <button onClick={() => downloadReport('jpg')} className="h-8 rounded-md bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200">⬇️ JPG</button>
                  </div>
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
          className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm sm:max-w-md" />
        <button onClick={() => setShowNew(true)} className="h-10 shrink-0 whitespace-nowrap rounded-md bg-slate-900 px-4 text-sm font-bold text-white sm:ml-auto">+ 신규</button>
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
