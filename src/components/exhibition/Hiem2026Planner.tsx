'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, ClipboardPenLine, Search, X } from 'lucide-react'
import { hiem2026Booths, hiem2026Unavailable, type HiemBooth } from '@/lib/hiem-2026'

type BoothNote = {
  contact?: string
  products?: string
  meeting?: string
  action?: string
  status?: string
}

const STORAGE_KEY = 'dian:hiem-intertextile-2026:notes'
const halls = ['전체', '5.1', '5.2', '6.1', '6.2', '확인 중']

export default function Hiem2026Planner() {
  const [query, setQuery] = useState('')
  const [hall, setHall] = useState('전체')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, BoothNote>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      setNotes(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'))
    } catch {
      setNotes({})
    }
  }, [])

  const selected = hiem2026Booths.find((booth) => booth.id === selectedId) ?? null
  const visibleBooths = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return hiem2026Booths.filter((booth) => {
      const matchesHall = hall === '전체' || booth.hall === hall
      const matchesQuery = !needle || `${booth.brand} ${booth.hall} ${booth.booth}`.toLowerCase().includes(needle)
      return matchesHall && matchesQuery
    })
  }, [hall, query])

  const groups = useMemo(
    () => halls.slice(1).map((name) => ({ name, booths: visibleBooths.filter((booth) => booth.hall === name) })).filter((group) => group.booths.length),
    [visibleBooths],
  )

  const saveNote = (note: BoothNote) => {
    if (!selected) return
    const next = { ...notes, [selected.id]: note }
    setNotes(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="-mx-4 -my-8 sm:-mx-6 sm:-my-10 lg:-mx-8 lg:-my-12">
      <section className="relative overflow-hidden bg-black text-white">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#76b900 1px, transparent 1px), linear-gradient(90deg, #76b900 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="relative mx-auto max-w-[1440px] px-6 py-14 sm:px-10 lg:px-12">
          <div className="mb-6 flex items-center gap-3 text-[11px] font-bold tracking-[0.18em] text-[#76b900]">
            <span className="h-2 w-2 bg-[#76b900]" /> DIAVIS · DOCUMENTS / 2026 EXHIBITION
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold tracking-[-0.055em] sm:text-5xl">2026 HIEM INTERTEXTILE</h1>
              <p className="mt-3 text-[15px] text-white/70">부스 탐색 · 미팅 기록 · 후속 할 일</p>
            </div>
            <p className="max-w-[290px] text-sm leading-6 text-white/65">브랜드 카드를 누르면 담당자, 제품, 미팅 내용과 다음 할 일을 바로 기록할 수 있습니다.</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <section className="grid border border-[#ccc] sm:grid-cols-3">
          <Summary value="21" label="확인된 부스" />
          <Summary value={String(Object.values(notes).filter((note) => Object.values(note).some(Boolean)).length)} label="메모 작성 업체" />
          <Summary value="5" label="부스 확인 중" />
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <label className="relative mr-1 min-w-[220px] flex-1 sm:max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#757575]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="브랜드 또는 부스번호 검색" className="h-10 w-full border border-[#ccc] bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#76b900] focus:ring-1 focus:ring-[#76b900]" />
          </label>
          {halls.map((name) => <button key={name} onClick={() => setHall(name)} className={`h-10 border px-3 text-sm font-semibold transition ${hall === name ? 'border-[#76b900] bg-[#76b900] text-black' : 'border-[#ccc] bg-white text-black hover:border-black'}`}>{name}</button>)}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-7" aria-label="부스 목록">
            {groups.map((group) => <BoothGroup key={group.name} name={group.name} booths={group.booths} selectedId={selectedId} notes={notes} onSelect={setSelectedId} />)}
            {!groups.length && <div className="border border-dashed border-[#ccc] py-16 text-center text-sm text-[#757575]">검색 결과가 없습니다.</div>}
            <section className="border border-[#ccc] bg-[#f7f7f7] p-5">
              <h2 className="text-sm font-bold">부스 미확인 / 이번 전시회에 안 나오는 업체</h2>
              <p className="mt-1 text-xs text-[#757575]">현재 취합 기준입니다. 부스가 확인되면 위 목록으로 옮깁니다.</p>
              <div className="mt-4 flex flex-wrap gap-2">{hiem2026Unavailable.map((brand) => <span key={brand} className="border border-[#ccc] bg-white px-3 py-1.5 text-sm">{brand}</span>)}</div>
            </section>
          </section>
          <aside className="xl:sticky xl:top-8 xl:self-start"><DetailPanel booth={selected} note={selected ? notes[selected.id] : undefined} saved={saved} onSave={saveNote} /></aside>
        </div>
      </main>
    </div>
  )
}

function Summary({ value, label }: { value: string; label: string }) {
  return <div className="border-b border-[#ccc] bg-white px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><strong className="block text-3xl font-bold tracking-[-0.05em] text-[#5a8d00]">{value}</strong><span className="mt-1 block text-xs text-[#757575]">{label}</span></div>
}

function BoothGroup({ name, booths, selectedId, notes, onSelect }: { name: string; booths: HiemBooth[]; selectedId: string | null; notes: Record<string, BoothNote>; onSelect: (id: string) => void }) {
  return <section><div className="mb-3 flex items-center justify-between border-b border-black pb-2"><h2 className="text-lg font-bold tracking-[-0.035em]">Hall {name}</h2><span className="text-xs text-[#757575]">{booths.length}개 업체</span></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{booths.map((booth) => { const hasNote = Boolean(notes[booth.id] && Object.values(notes[booth.id]).some(Boolean)); return <button key={booth.id} onClick={() => onSelect(booth.id)} className={`min-h-[106px] border p-4 text-left transition ${selectedId === booth.id ? 'border-[#76b900] bg-[#f7f7f7] ring-1 ring-[#76b900]' : 'border-[#ccc] bg-white hover:border-black'}`}><div className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-[0.08em] text-[#5a8d00]"><span>{booth.hall} · {booth.booth}</span>{hasNote && <span className="h-2 w-2 bg-[#76b900]" aria-label="메모 있음" />}</div><div className="mt-3 flex items-end justify-between gap-3"><span className="text-[17px] font-bold tracking-[-0.03em]">{booth.brand}</span><ChevronRight className="h-4 w-4 shrink-0 text-[#757575]" /></div></button> })}</div></section>
}

function DetailPanel({ booth, note, saved, onSave }: { booth: HiemBooth | null; note?: BoothNote; saved: boolean; onSave: (note: BoothNote) => void }) {
  const [draft, setDraft] = useState<BoothNote>({})
  useEffect(() => setDraft(note ?? {}), [booth?.id, note])
  if (!booth) return <div className="border border-[#ccc] bg-white p-6"><ClipboardPenLine className="h-5 w-5 text-[#76b900]" /><h2 className="mt-4 text-xl font-bold tracking-[-0.04em]">현장 기록</h2><p className="mt-2 text-sm leading-6 text-[#757575]">왼쪽에서 브랜드를 선택하면 이곳에서 미팅 기록을 남길 수 있습니다.</p></div>
  const change = (key: keyof BoothNote, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  return <div className="border border-[#ccc] bg-white p-5"><p className="text-[11px] font-bold tracking-[0.1em] text-[#5a8d00]">HALL {booth.hall} · BOOTH {booth.booth}</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.05em]">{booth.brand}</h2><p className="mt-2 text-xs leading-5 text-[#757575]">메모는 현재 이 브라우저에 저장됩니다.</p><div className="mt-5 space-y-4"><Field label="담당자 / 연락처" value={draft.contact ?? ''} onChange={(value) => change('contact', value)} placeholder="예: Amy · WeChat 확인" /><Field label="주력 품목 · 관심 원단" multiline value={draft.products ?? ''} onChange={(value) => change('products', value)} placeholder="원단명, 컬렉션, 샘플북 등" /><Field label="미팅 메모" multiline value={draft.meeting ?? ''} onChange={(value) => change('meeting', value)} placeholder="가격, MOQ, 납기, 품질 등" /><Field label="다음 할 일" value={draft.action ?? ''} onChange={(value) => change('action', value)} placeholder="예: 샘플·단가표 요청" /><label className="block text-sm font-semibold">상태<select value={draft.status ?? '방문 예정'} onChange={(event) => change('status', event.target.value)} className="mt-1.5 h-10 w-full border border-[#ccc] bg-white px-3 text-sm outline-none focus:border-[#76b900]"><option>방문 예정</option><option>미팅 완료</option><option>후속 확인</option><option>보류</option></select></label></div><button onClick={() => onSave({ ...draft, status: draft.status ?? '방문 예정' })} className="mt-5 flex h-10 w-full items-center justify-center gap-2 bg-[#76b900] text-sm font-bold text-black hover:bg-[#bff230]">{saved ? <Check className="h-4 w-4" /> : null}{saved ? '저장했습니다' : '메모 저장'}</button></div>
}

function Field({ label, value, onChange, placeholder, multiline = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean }) {
  const className = 'mt-1.5 w-full border border-[#ccc] bg-white px-3 py-2 text-sm outline-none transition placeholder:text-[#a7a7a7] focus:border-[#76b900] focus:ring-1 focus:ring-[#76b900]'
  return <label className="block text-sm font-semibold">{label}{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className={className} /> : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`h-10 ${className}`} />}</label>
}
