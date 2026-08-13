'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, ClipboardPenLine, IdCard, ImagePlus, Plus, Search, X } from 'lucide-react'
import { hiem2026Booths, hiem2026Unavailable, type HiemBooth } from '@/lib/hiem-2026'

type BoothNote = {
  contact?: string
  products?: string
  photo?: string
  photos?: string[]
  meeting?: string
  action?: string
  inventoryChecked?: boolean
  websiteChecked?: boolean
  giftChecked?: boolean
  status?: string
}

type CustomBooth = HiemBooth & {
  photo?: string
  businessCard?: string
  createdAt: string
}

const NOTES_STORAGE_KEY = 'dian:shanghai-intertextile-2026:notes'
const LEGACY_NOTES_STORAGE_KEY = 'dian:hiem-intertextile-2026:notes'
const CUSTOM_BOOTH_STORAGE_KEY = 'dian:shanghai-intertextile-2026:custom-booths'
const halls = ['전체', '5.1', '5.2', '6.1', '6.2', '확인 중', '새 업체']

export default function Hiem2026Planner() {
  const [query, setQuery] = useState('')
  const [hall, setHall] = useState('전체')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, BoothNote>>({})
  const [customBooths, setCustomBooths] = useState<CustomBooth[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [canImportLegacy, setCanImportLegacy] = useState(false)
  const [syncMessage, setSyncMessage] = useState('공유 기록 불러오는 중…')

  const applyRecord = (record: any) => {
    const paths = (record.photos ?? []).map((photo: any) => typeof photo === 'string' ? photo : photo.path).filter(Boolean)
    const urls = Object.fromEntries((record.photos ?? []).filter((photo: any) => photo?.path && photo?.url).map((photo: any) => [photo.path, photo.url]))
    setPhotoUrls((current) => ({ ...current, ...urls }))
    return {
      contact: record.contact ?? '', products: record.purchaseRequestSamples ?? '', meeting: record.meetingMemo ?? '', action: record.nextAction ?? '',
      status: record.status ?? '방문 예정', websiteChecked: Boolean(record.websiteChecked), inventoryChecked: Boolean(record.inventoryChecked), giftChecked: Boolean(record.giftChecked), photos: paths,
    } as BoothNote
  }

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/exhibition/booths', { cache: 'no-store' })
        const { records = [] } = await response.json()
        if (!response.ok) throw new Error('load failed')
        const nextNotes: Record<string, BoothNote> = {}
        const nextCustom: CustomBooth[] = []
        records.forEach((record: any) => {
          const note = applyRecord(record)
          if (record.isCustom) nextCustom.push({ id: record.boothId, brand: record.brand, hall: record.hall, booth: record.boothCode, status: 'confirmed', photo: record.boothPhotoPath, businessCard: record.businessCardPath, createdAt: record.createdAt })
          else nextNotes[record.boothId] = note
          if (record.isCustom) nextNotes[record.boothId] = note
        })
        setNotes(nextNotes); setCustomBooths(nextCustom); setSyncMessage('Supabase 공유 저장')
      } catch { setSyncMessage('공유 기록을 불러오지 못했습니다.') }
      try { setCanImportLegacy(Boolean(localStorage.getItem(NOTES_STORAGE_KEY) || localStorage.getItem(LEGACY_NOTES_STORAGE_KEY) || localStorage.getItem(CUSTOM_BOOTH_STORAGE_KEY))) } catch { /* migration is optional */ }
    }
    void load()
  }, [])

  const allBooths = useMemo(() => {
    const officialBrands = new Set(hiem2026Booths.map((booth) => booth.brand.trim().toLowerCase()))
    return [...hiem2026Booths, ...customBooths.filter((booth) => !officialBrands.has(booth.brand.trim().toLowerCase()))]
  }, [customBooths])
  const selected = allBooths.find((booth) => booth.id === selectedId) ?? null
  const visibleBooths = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return allBooths.filter((booth) => {
      const isCustom = booth.id.startsWith('custom-')
      const matchesHall = hall === '전체' || (hall === '새 업체' ? isCustom : booth.hall === hall)
      const matchesQuery = !needle || `${booth.brand} ${booth.hall} ${booth.booth}`.toLowerCase().includes(needle)
      return matchesHall && matchesQuery
    })
  }, [hall, query, allBooths])

  const groups = useMemo(
    () => [
      ...halls.slice(1, -1).map((name) => ({ name, booths: visibleBooths.filter((booth) => booth.hall === name && !booth.id.startsWith('custom-')) })),
      { name: '새 업체 분류', booths: visibleBooths.filter((booth) => booth.id.startsWith('custom-')) },
    ].filter((group) => group.booths.length),
    [visibleBooths],
  )

  const uploadDataUrl = async (dataUrl: string, boothId: string, kind: string) => {
    if (!dataUrl.startsWith('data:')) return dataUrl
    const blob = await (await fetch(dataUrl)).blob()
    const form = new FormData(); form.append('file', new File([blob], `${kind}.jpg`, { type: blob.type || 'image/jpeg' })); form.append('boothId', boothId); form.append('kind', kind)
    const response = await fetch('/api/exhibition/upload', { method: 'POST', body: form })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error ?? '사진 업로드 실패')
    return body.path as string
  }

  const saveNote = async (note: BoothNote) => {
    if (!selected) return
    try {
      const photos = await Promise.all((note.photos ?? (note.photo ? [note.photo] : [])).map((photo) => uploadDataUrl(photo, selected.id, 'sample')))
      const response = await fetch('/api/exhibition/booths', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boothId: selected.id, brand: selected.brand, hall: selected.hall, boothCode: selected.booth, contact: note.contact, purchaseRequestSamples: note.products, meetingMemo: note.meeting, nextAction: note.action, status: note.status, websiteChecked: note.websiteChecked, inventoryChecked: note.inventoryChecked, giftChecked: note.giftChecked, photos }) })
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? '저장 실패')
      const normalized = applyRecord(body.record); setNotes((current) => ({ ...current, [selected.id]: normalized })); setSaved(true); setSyncMessage('Supabase 공유 저장')
      window.setTimeout(() => setSaved(false), 1800)
    } catch (error) { setSyncMessage(error instanceof Error ? error.message : '공유 저장에 실패했습니다.') }
  }

  const addCustomBooth = async (booth: CustomBooth) => {
    try {
      const boothPhotoPath = booth.photo ? await uploadDataUrl(booth.photo, booth.id, 'booth') : undefined
      const businessCardPath = booth.businessCard ? await uploadDataUrl(booth.businessCard, booth.id, 'business-card') : undefined
      const response = await fetch('/api/exhibition/booths', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boothId: booth.id, brand: booth.brand, hall: booth.hall, boothCode: booth.booth, isCustom: true, boothPhotoPath, businessCardPath }) })
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? '저장 실패')
      setCustomBooths((current) => [...current, { ...booth, photo: boothPhotoPath, businessCard: businessCardPath }]); setCreateOpen(false); setSelectedId(booth.id); setSyncMessage('Supabase 공유 저장')
    } catch (error) { setSyncMessage(error instanceof Error ? error.message : '새 업체 저장에 실패했습니다.') }
  }

  const importLegacy = async () => {
    try {
      const legacyNotes = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) ?? localStorage.getItem(LEGACY_NOTES_STORAGE_KEY) ?? '{}') as Record<string, BoothNote>
      const legacyCustom = JSON.parse(localStorage.getItem(CUSTOM_BOOTH_STORAGE_KEY) ?? '[]') as CustomBooth[]
      const legacyBooths = [...hiem2026Booths, ...legacyCustom]
      for (const [boothId, note] of Object.entries(legacyNotes)) {
        const booth = legacyBooths.find((item) => item.id === boothId); if (!booth) continue
        const photos = await Promise.all((note.photos ?? (note.photo ? [note.photo] : [])).map((photo) => uploadDataUrl(photo, boothId, 'sample')))
        await fetch('/api/exhibition/booths', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boothId, brand: booth.brand, hall: booth.hall, boothCode: booth.booth, isCustom: boothId.startsWith('custom-'), contact: note.contact, purchaseRequestSamples: note.products, meetingMemo: note.meeting, nextAction: note.action, status: note.status, websiteChecked: note.websiteChecked, inventoryChecked: note.inventoryChecked, giftChecked: note.giftChecked, photos }) })
      }
      for (const booth of legacyCustom.filter((item) => !legacyNotes[item.id])) {
        const boothPhotoPath = booth.photo ? await uploadDataUrl(booth.photo, booth.id, 'booth') : undefined
        const businessCardPath = booth.businessCard ? await uploadDataUrl(booth.businessCard, booth.id, 'business-card') : undefined
        await fetch('/api/exhibition/booths', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boothId: booth.id, brand: booth.brand, hall: booth.hall, boothCode: booth.booth, isCustom: true, boothPhotoPath, businessCardPath }) })
      }
      setCanImportLegacy(false); setSyncMessage('기존 브라우저 기록을 Supabase로 가져왔습니다.'); window.location.reload()
    } catch { setSyncMessage('기존 브라우저 기록 가져오기에 실패했습니다.') }
  }

  return (
    <div className="-mx-4 -my-8 sm:-mx-6 sm:-my-10 lg:-mx-8 lg:-my-12">
      <section className="relative overflow-hidden bg-black text-white">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#76b900 1px, transparent 1px), linear-gradient(90deg, #76b900 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="relative mx-auto max-w-[1440px] px-4 py-8 sm:px-10 sm:py-14 lg:px-12">
          <div className="mb-4 flex items-center gap-3 text-[10px] font-bold tracking-[0.14em] text-[#76b900] sm:mb-6 sm:text-[11px] sm:tracking-[0.18em]">
            <span className="h-2 w-2 bg-[#76b900]" /> DIAVIS · DOCUMENTS / 2026 SHANGHAI EXHIBITION
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold leading-[1.05] tracking-[-0.055em] sm:text-5xl">2026 상하이 INTERTEXTILE</h1>
              <p className="mt-2 text-sm text-white/70 sm:mt-3 sm:text-[15px]">부스 탐색 · 미팅 기록 · 후속 할 일</p>
            </div>
            <p className="hidden max-w-[290px] text-sm leading-6 text-white/65 sm:block">브랜드 카드를 누르면 담당자, 제품, 미팅 내용과 다음 할 일을 바로 기록할 수 있습니다.</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <section className="grid grid-cols-3 border border-[#ccc]">
          <Summary value={String(allBooths.filter((booth) => booth.status === 'confirmed').length)} label="확인된 부스" />
          <Summary value={String(Object.values(notes).filter((note) => Object.values(note).some(Boolean)).length)} label="메모 작성 업체" />
          <Summary value={String(allBooths.filter((booth) => booth.status === 'pending').length)} label="부스 확인 중" />
        </section>

        <p className="mt-2 text-xs font-semibold text-[#5a8d00]">{syncMessage}</p>
        {canImportLegacy && <button type="button" onClick={() => void importLegacy()} className="mt-2 border border-[#76b900] px-3 py-2 text-xs font-bold text-[#4e7900]">기존 브라우저 기록 가져오기</button>}

        <div className="mt-5 grid gap-2 sm:mt-6 sm:flex sm:flex-wrap sm:items-center">
          <label className="relative w-full sm:mr-1 sm:min-w-[220px] sm:flex-1 sm:max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#757575]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="브랜드 또는 부스번호 검색" className="h-11 w-full border border-[#ccc] bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#76b900] focus:ring-1 focus:ring-[#76b900] sm:h-10" />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:contents">
            {halls.map((name) => <button key={name} onClick={() => setHall(name)} className={`h-10 shrink-0 border px-3 text-sm font-semibold transition ${hall === name ? 'border-[#76b900] bg-[#76b900] text-black' : 'border-[#ccc] bg-white text-black hover:border-black'}`}>{name}</button>)}
          </div>
        </div>

        <button type="button" onClick={() => setCreateOpen(true)} className="mt-3 flex h-11 w-full items-center justify-center gap-2 border border-black bg-black px-4 text-sm font-bold text-white hover:bg-[#76b900] hover:text-black sm:ml-auto sm:mt-4 sm:w-auto">
          <Plus className="h-4 w-4" /> 새 업체 추가
        </button>

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
          <aside className="hidden xl:sticky xl:top-8 xl:self-start xl:block"><DetailPanel booth={selected} note={selected ? notes[selected.id] : undefined} saved={saved} photoUrls={photoUrls} onSave={saveNote} /></aside>
        </div>
        {selected && <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 xl:hidden" role="dialog" aria-modal="true" aria-label="모바일 현장 기록 창">
          <button className="absolute inset-0 cursor-default" aria-label="현장 기록 창 닫기" onClick={() => setSelectedId(null)} />
          <div className="relative max-h-[88vh] w-full overflow-y-auto bg-white shadow-2xl">
            <DetailPanel booth={selected} note={notes[selected.id]} saved={saved} photoUrls={photoUrls} onSave={saveNote} onClose={() => setSelectedId(null)} />
          </div>
        </div>}
        {createOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="새 업체 추가 창">
          <button className="absolute inset-0 cursor-default" aria-label="새 업체 추가 창 닫기" onClick={() => setCreateOpen(false)} />
          <div className="relative max-h-[88vh] w-full max-w-[560px] overflow-y-auto bg-white shadow-2xl">
            <CreateBoothPanel onSave={addCustomBooth} onClose={() => setCreateOpen(false)} />
          </div>
        </div>}
      </main>
    </div>
  )
}

function CreateBoothPanel({ onSave, onClose }: { onSave: (booth: CustomBooth) => void; onClose: () => void }) {
  const [brand, setBrand] = useState('')
  const [hall, setHall] = useState('5.1')
  const [booth, setBooth] = useState('')
  const [photo, setPhoto] = useState('')
  const [businessCard, setBusinessCard] = useState('')
  const readImage = (file?: File) => {
    if (!file) return Promise.resolve('')
    return new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? '')); reader.readAsDataURL(file) })
  }
  const submit = () => {
    if (!brand.trim() || !booth.trim()) return
    onSave({ id: `custom-${Date.now()}`, brand: brand.trim(), hall, booth: booth.trim().toUpperCase(), status: 'confirmed', photo, businessCard, createdAt: new Date().toISOString() })
  }
  return <div className="relative border border-[#ccc] bg-white p-5 sm:p-6"><button type="button" onClick={onClose} aria-label="새 업체 추가 창 닫기" className="absolute right-3 top-3 grid h-8 w-8 place-items-center border border-[#ccc]"><X className="h-4 w-4" /></button><p className="text-[11px] font-bold tracking-[0.1em] text-[#5a8d00]">SHANGHAI INTERTEXTILE 2026</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.05em]">새 업체 추가</h2><p className="mt-2 text-xs leading-5 text-[#757575]">사진·명함과 업체 정보는 이 브라우저에만 저장됩니다.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="업체명" value={brand} onChange={setBrand} placeholder="예: KELLY FU" /><label className="block text-sm font-semibold">Hall<select value={hall} onChange={(event) => setHall(event.target.value)} className="mt-1.5 h-10 w-full border border-[#ccc] bg-white px-3 text-sm"><option>5.1</option><option>5.2</option><option>6.1</option><option>6.2</option></select></label><Field label="부스번호" value={booth} onChange={setBooth} placeholder="예: H33" /><UploadField label="사진 업로드" icon={<ImagePlus className="h-4 w-4" />} preview={photo} onChange={async (file) => setPhoto(await readImage(file))} /><UploadField label="명함 업로드" icon={<IdCard className="h-4 w-4" />} preview={businessCard} onChange={async (file) => setBusinessCard(await readImage(file))} /></div><button type="button" disabled={!brand.trim() || !booth.trim()} onClick={submit} className="mt-5 flex h-11 w-full items-center justify-center gap-2 bg-[#76b900] text-sm font-bold text-black disabled:bg-[#ddd]">업체 저장 후 메모 작성</button></div>
}

function UploadField({ label, icon, preview, onChange }: { label: string; icon: React.ReactNode; preview: string; onChange: (file?: File) => void }) {
  return <label className="block text-sm font-semibold">{label}<span className="mt-1.5 flex h-10 cursor-pointer items-center gap-2 border border-dashed border-[#999] px-3 text-xs font-normal text-[#555]">{icon}{preview ? '첨부 완료 · 다시 선택' : '이미지 선택'}<input type="file" accept="image/*" className="sr-only" onChange={(event) => onChange(event.target.files?.[0])} /></span>{preview && <img src={preview} alt={`${label} 미리보기`} className="mt-2 h-20 w-full object-cover" />}</label>
}

function MultiPhotoUploadField({ photos, photoUrls, onChange }: { photos: string[]; photoUrls: Record<string, string>; onChange: (photos: string[]) => void }) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const addPhotos = async (files: FileList | null) => {
    const added = await Promise.all(Array.from(files ?? []).map((file) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? '')); reader.readAsDataURL(file) })))
    onChange([...photos, ...added.filter(Boolean)])
  }
  const removePhoto = (index: number) => onChange(photos.filter((_, currentIndex) => currentIndex !== index))
  return <div className="block text-sm font-semibold"><label>구매요청 샘플 사진 업로드<span className="mt-1.5 flex h-10 cursor-pointer items-center gap-2 border border-dashed border-[#999] px-3 text-xs font-normal text-[#555]"><ImagePlus className="h-4 w-4" />{photos.length ? `${photos.length}장 첨부 · 추가 선택` : '여러 이미지 선택'}<input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => addPhotos(event.target.files)} /></span></label>{photos.length > 0 && <div className="mt-2 grid grid-cols-3 gap-2">{photos.map((photo, index) => { const url = photoUrls[photo] ?? photo; return <div key={`${photo.slice(0, 32)}-${index}`} className="relative border border-[#ccc]"><button type="button" aria-label={`사진 크게 보기 ${index + 1}`} onClick={() => setSelectedPhoto(url)} className="block w-full"><img src={url} alt={`구매요청 샘플 사진 ${index + 1}`} className="h-20 w-full object-cover" /></button><button type="button" aria-label={`사진 삭제 ${index + 1}`} onClick={() => removePhoto(index)} className="absolute right-1 top-1 grid h-6 w-6 place-items-center bg-black text-sm font-bold text-white hover:bg-[#76b900] hover:text-black">×</button></div>})}</div>}{selectedPhoto && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="사진 크게 보기"><button type="button" aria-label="사진 크게 보기 닫기" onClick={() => setSelectedPhoto(null)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center border border-white text-xl text-white">×</button><img src={selectedPhoto} alt="구매요청 샘플 사진 크게 보기" className="max-h-[85vh] max-w-full object-contain" /></div>}</div>
}

function Summary({ value, label }: { value: string; label: string }) {
  return <div className="border-r border-[#ccc] bg-white px-3 py-3 last:border-r-0 sm:px-5 sm:py-4"><strong className="block text-2xl font-bold tracking-[-0.05em] text-[#5a8d00] sm:text-3xl">{value}</strong><span className="mt-1 block text-[11px] leading-4 text-[#757575] sm:text-xs">{label}</span></div>
}

function BoothGroup({ name, booths, selectedId, notes, onSelect }: { name: string; booths: HiemBooth[]; selectedId: string | null; notes: Record<string, BoothNote>; onSelect: (id: string) => void }) {
  return <section><div className="mb-3 flex items-center justify-between border-b border-black pb-2"><h2 className="text-lg font-bold tracking-[-0.035em]">Hall {name}</h2><span className="text-xs text-[#757575]">{booths.length}개 업체</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3">{booths.map((booth) => { const hasNote = Boolean(notes[booth.id] && Object.values(notes[booth.id]).some(Boolean)); const status = notes[booth.id]?.status; const isCustom = booth.id.startsWith('custom-'); return <button key={booth.id} onClick={() => onSelect(booth.id)} className={`min-h-[106px] border p-4 text-left transition ${selectedId === booth.id ? 'border-[#76b900] bg-[#f7f7f7] ring-1 ring-[#76b900]' : 'border-[#ccc] bg-white hover:border-black'}`}><div className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-[0.08em] text-[#5a8d00]"><span>{booth.hall} · {booth.booth}</span>{isCustom && <span className="border border-[#76b900] bg-[#f2ffe0] px-1 py-0.5 text-[9px] text-[#4e7900]">새 업체 카드</span>}{hasNote && <span className="h-2 w-2 bg-[#76b900]" aria-label="메모 있음" />}</div><div className="mt-3 flex items-end justify-between gap-3"><span className="text-[17px] font-bold tracking-[-0.03em]">{booth.brand}</span>{status && status !== '방문 예정' && <span className="ml-auto border border-[#76b900] bg-[#f2ffe0] px-1.5 py-0.5 text-[10px] font-bold text-[#4e7900]">{status}</span>}<ChevronRight className="h-4 w-4 shrink-0 text-[#757575]" /></div></button> })}</div></section>
}

function DetailPanel({ booth, note, saved, photoUrls, onSave, onClose }: { booth: HiemBooth | null; note?: BoothNote; saved: boolean; photoUrls: Record<string, string>; onSave: (note: BoothNote) => void; onClose?: () => void }) {
  const [draft, setDraft] = useState<BoothNote>({})
  useEffect(() => setDraft(note ?? {}), [booth?.id, note])
  if (!booth) return <div className="border border-[#ccc] bg-white p-6"><ClipboardPenLine className="h-5 w-5 text-[#76b900]" /><h2 className="mt-4 text-xl font-bold tracking-[-0.04em]">현장 기록</h2><p className="mt-2 text-sm leading-6 text-[#757575]">왼쪽에서 브랜드를 선택하면 이곳에서 미팅 기록을 남길 수 있습니다.</p></div>
  const change = (key: keyof BoothNote, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  return <div className="relative border border-[#ccc] bg-white p-5">{onClose && <button type="button" onClick={onClose} aria-label="현장 기록 창 닫기" className="absolute right-3 top-3 grid h-8 w-8 place-items-center border border-[#ccc] bg-white text-[#555]"><X className="h-4 w-4" /></button>}<p className="text-[11px] font-bold tracking-[0.1em] text-[#5a8d00]">HALL {booth.hall} · BOOTH {booth.booth}</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.05em]">{booth.brand}</h2><p className="mt-2 text-xs leading-5 text-[#757575]">메모와 사진은 Supabase 공유 저장소에 저장됩니다.</p><div className="mt-5 space-y-4"><Field label="담당자 / 연락처" value={draft.contact ?? ''} onChange={(value) => change('contact', value)} placeholder="예: Amy · WeChat 확인" /><Field label="구매요청 샘플" multiline value={draft.products ?? ''} onChange={(value) => change('products', value)} placeholder="원단명, 컬렉션, 샘플북 등" /><MultiPhotoUploadField photos={draft.photos ?? (draft.photo ? [draft.photo] : [])} photoUrls={photoUrls} onChange={(photos) => setDraft((current) => ({ ...current, photos, photo: undefined }))} /><Field label="미팅 메모" multiline value={draft.meeting ?? ''} onChange={(value) => change('meeting', value)} placeholder="가격, MOQ, 납기, 품질 등" /><Field label="다음 할 일" value={draft.action ?? ''} onChange={(value) => change('action', value)} placeholder="예: 샘플·단가표 요청" /><label className="block text-sm font-semibold">상태<select value={draft.status ?? '방문 예정'} onChange={(event) => change('status', event.target.value)} className="mt-1.5 h-10 w-full border border-[#ccc] bg-white px-3 text-sm outline-none focus:border-[#76b900]"><option>방문 예정</option><option>미팅 완료</option><option>후속 확인</option><option>보류</option></select></label><div className="grid grid-cols-1 gap-2"><CheckField label="웹사이트" checked={draft.websiteChecked ?? false} onChange={(websiteChecked) => setDraft((current) => ({ ...current, websiteChecked }))} /><CheckField label="재고관리" checked={draft.inventoryChecked ?? false} onChange={(inventoryChecked) => setDraft((current) => ({ ...current, inventoryChecked }))} /><CheckField label="선물" checked={draft.giftChecked ?? false} onChange={(giftChecked) => setDraft((current) => ({ ...current, giftChecked }))} /></div></div><button onClick={() => onSave({ ...draft, status: draft.status ?? '방문 예정' })} className="mt-5 flex h-10 w-full items-center justify-center gap-2 bg-[#76b900] text-sm font-bold text-black hover:bg-[#bff230]">{saved ? <Check className="h-4 w-4" /> : null}{saved ? '저장했습니다' : '메모 저장'}</button></div>
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex h-10 items-center gap-2 border border-[#ccc] px-3 text-sm font-semibold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#76b900]" />{label}</label>
}

function Field({ label, value, onChange, placeholder, multiline = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean }) {
  const className = 'mt-1.5 w-full border border-[#ccc] bg-white px-3 py-2 text-sm outline-none transition placeholder:text-[#a7a7a7] focus:border-[#76b900] focus:ring-1 focus:ring-[#76b900]'
  return <label className="block text-sm font-semibold">{label}{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className={className} /> : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`h-10 ${className}`} />}</label>
}
