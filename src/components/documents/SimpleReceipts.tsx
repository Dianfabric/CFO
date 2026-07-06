'use client'

/**
 * 간이영수증 대장 — 사진 업로드 + 항목 선택 + 변동비/고정비 처리.
 * 분기별 관리, 종소세·법인세 신고용 엑셀(날짜/상호/적요/금액) 다운로드.
 *
 * 업로드 방식:
 *  - 여러 장을 한 번에 드래그앤드롭(또는 클릭 선택) → 목록(큐)에 쌓임
 *  - 큐의 각 사진은 업로드 직전 자동 축소(가로 1600px, JPEG 0.7)되어 용량 제한 회피
 *  - 공통 상호·항목·변동/고정을 '전체 적용'으로 한 번에 채우고 금액만 입력 → 한 번에 등록
 *  - 아래쪽 빠른 입력 폼은 사진 없이 1건씩 손입력할 때 사용
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ReceiptText, Loader2, Plus, Trash2, Download, Camera, ImageIcon,
  UploadCloud, X, CheckCircle, XCircle,
} from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

const ITEM_OPTIONS = ['운송료', '퀵비', '주차·교통', '식대', '소모품', '접대비', '수선비', '기타']
const CUSTOM = '__custom__'

const PRIMARY = 'var(--nv-primary, #76b900)'

interface ReceiptRow {
  id: number
  receipt_date: string
  vendor: string
  item: string
  amount: number
  cost_type: 'variable' | 'fixed'
  memo: string | null
  imageUrl: string | null
}

type QueueStatus = 'ocr' | 'ready' | 'saving' | 'done' | 'error'

interface QueueItem {
  id: string
  file: File
  previewUrl: string
  date: string
  vendor: string
  item: string
  amount: string
  cost_type: 'variable' | 'fixed'
  status: QueueStatus
  errorMsg?: string
  ocrFilled?: boolean
}

function todayYmd(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

/**
 * 사진을 캔버스로 축소 후 JPEG Blob 반환. 큰 폰 사진(수 MB)을 0.5MB 안쪽으로 줄여
 * Vercel 요청 본문(4.5MB) / Storage 제한을 회피한다. 이미지가 아니면 원본 그대로.
 */
async function resizeImage(file: File, maxDim = 1600, quality = 0.7): Promise<Blob> {
  // 축소 실패(디코딩 불가 포맷 등)해도 원본을 그대로 올려 업로드가 막히지 않게 한다.
  try {
    const dataUrl: string = await new Promise((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.onerror = () => rej(new Error('read'))
      fr.readAsDataURL(file)
    })
    const img: HTMLImageElement = await new Promise((res, rej) => {
      const im = new Image()
      im.onload = () => res(im)
      im.onerror = () => rej(new Error('decode'))
      im.src = dataUrl
    })
    let { width, height } = img
    if (Math.max(width, height) > maxDim) {
      const scale = maxDim / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, width, height)
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
    return blob ?? file
  } catch {
    return file
  }
}

export default function SimpleReceipts() {
  const nowQ = Math.floor(new Date().getMonth() / 3) + 1
  const year = new Date().getFullYear()
  const [q, setQ] = useState(nowQ)
  const [rows, setRows] = useState<ReceiptRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [f, setF] = useState({
    date: todayYmd(),
    vendor: '',
    itemPick: ITEM_OPTIONS[0] as string,
    itemCustom: '',
    amount: '',
    cost_type: 'variable' as 'variable' | 'fixed',
  })

  // ── 사진 드래그앤드롭 큐 ──
  const dropRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [defaults, setDefaults] = useState({
    vendor: '',
    item: '',
    cost_type: 'variable' as 'variable' | 'fixed',
  })

  const load = useCallback(async (quarter: number) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/receipts?year=${year}&q=${quarter}`)
      const j = await r.json()
      setRows(Array.isArray(j.receipts) ? j.receipts : [])
      setTotal(j.total ?? 0)
      setTableMissing(!!j.tableMissing)
    } catch {
      setError('조회 실패')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load(q) }, [q, load])

  // 언마운트 시 미리보기 URL 정리
  useEffect(() => () => { queue.forEach((it) => URL.revokeObjectURL(it.previewUrl)) }, [queue])

  const addImages = useCallback((fileList: File[]) => {
    const images = fileList.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) return
    setQueue((prev) => [
      ...prev,
      ...images.map((file, i) => ({
        id: `${file.name}-${i}-${prev.length}-${file.size}`,
        file,
        previewUrl: URL.createObjectURL(file),
        date: todayYmd(),
        vendor: defaults.vendor,
        item: defaults.item,
        amount: '',
        cost_type: defaults.cost_type,
        status: 'ocr' as QueueStatus,
      })),
    ])
  }, [defaults])

  // ── 사진 자동 인식(OCR) ── 드롭 즉시 각 사진에서 날짜·상호·항목·금액을 Claude 비전으로 읽어 채운다
  const ocrStarted = useRef<Set<string>>(new Set())
  const ocrActive = useRef(0)
  const OCR_CONC = 4

  const ocrOne = async (file: File): Promise<{ date: string; vendor: string; item: string; amount: number }> => {
    const blob = await resizeImage(file)
    const form = new FormData()
    form.append('image', new File([blob], 'receipt.jpg', { type: 'image/jpeg' }))
    const r = await fetch('/api/receipts/ocr', { method: 'POST', body: form })
    const j = await r.json()
    if (!j.ok) throw new Error(j.error || 'OCR 실패')
    return { date: j.date || '', vendor: j.vendor || '', item: j.item || '', amount: Number(j.amount) || 0 }
  }

  useEffect(() => {
    const pending = queue.filter((it) => it.status === 'ocr' && !ocrStarted.current.has(it.id))
    if (pending.length === 0) return
    let slots = OCR_CONC - ocrActive.current
    for (const it of pending) {
      if (slots <= 0) break
      ocrStarted.current.add(it.id)
      ocrActive.current += 1
      slots -= 1
      ;(async () => {
        try {
          const res = await ocrOne(it.file)
          setQueue((prev) => prev.map((qi) => {
            if (qi.id !== it.id || qi.status !== 'ocr') return qi
            return {
              ...qi,
              date: res.date || qi.date,
              vendor: qi.vendor || res.vendor,
              item: qi.item || res.item,
              amount: res.amount ? String(res.amount) : qi.amount,
              status: 'ready',
              ocrFilled: !!(res.amount || res.vendor || res.date),
            }
          }))
        } catch {
          setQueue((prev) => prev.map((qi) => (qi.id === it.id && qi.status === 'ocr' ? { ...qi, status: 'ready' } : qi)))
        } finally {
          ocrActive.current -= 1
          setQueue((prev) => [...prev]) // 다음 대기 항목 처리 트리거
        }
      })()
    }
  }, [queue])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addImages(Array.from(e.dataTransfer.files))
  }

  const patchQueue = (id: string, patch: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  const removeQueueItem = (id: string) =>
    setQueue((prev) => {
      const target = prev.find((it) => it.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((it) => it.id !== id)
    })

  const applyDefaultsToAll = () =>
    setQueue((prev) => prev.map((it) =>
      it.status === 'done' ? it : {
        ...it,
        vendor: defaults.vendor || it.vendor,
        item: defaults.item || it.item,
        cost_type: defaults.cost_type,
      }))

  // 큐 일괄 등록 — 각 사진 축소 후 순차 업로드
  const saveQueue = async () => {
    const targets = queue.filter((it) => it.status === 'ready' || it.status === 'error')
    // 유효성 먼저 표시
    let anyInvalid = false
    for (const it of targets) {
      if (!it.vendor.trim() || !it.item.trim() || !(Number(it.amount) > 0)) {
        anyInvalid = true
        patchQueue(it.id, { status: 'error', errorMsg: '상호·항목·금액 확인' })
      }
    }
    const valid = targets.filter((it) => it.vendor.trim() && it.item.trim() && Number(it.amount) > 0)
    if (valid.length === 0) {
      if (!anyInvalid) setError('등록할 사진이 없습니다.')
      return
    }
    setBulkSaving(true)
    setError(null)
    let firstRegQ: number | null = null
    for (const it of valid) {
      patchQueue(it.id, { status: 'saving', errorMsg: undefined })
      try {
        const blob = await resizeImage(it.file)
        const form = new FormData()
        form.append('receipt_date', it.date)
        form.append('vendor', it.vendor.trim())
        form.append('item', it.item.trim())
        form.append('amount', String(Number(it.amount)))
        form.append('cost_type', it.cost_type)
        form.append('image', new File([blob], `${it.file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }))
        const r = await fetch('/api/receipts', { method: 'POST', body: form })
        const j = await r.json()
        if (!j.ok) {
          patchQueue(it.id, { status: 'error', errorMsg: j.error ?? '등록 실패' })
          continue
        }
        patchQueue(it.id, { status: 'done' })
        if (firstRegQ === null) firstRegQ = Math.floor((Number(it.date.slice(5, 7)) - 1) / 3) + 1
      } catch (e) {
        patchQueue(it.id, { status: 'error', errorMsg: e instanceof Error ? e.message : '오류' })
      }
    }
    setBulkSaving(false)
    // 완료 항목 정리 + 목록 새로고침
    setQueue((prev) => {
      prev.filter((it) => it.status === 'done').forEach((it) => URL.revokeObjectURL(it.previewUrl))
      return prev.filter((it) => it.status !== 'done')
    })
    const regQ = firstRegQ ?? q
    if (regQ === q) await load(q)
    else setQ(regQ)
  }

  const add = async () => {
    const item = f.itemPick === CUSTOM ? f.itemCustom.trim() : f.itemPick
    const amount = Number(f.amount) || 0
    if (!f.vendor.trim() || !item || amount <= 0) {
      setError('상호·항목·금액을 입력하세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('receipt_date', f.date)
      form.append('vendor', f.vendor.trim())
      form.append('item', item)
      form.append('amount', String(amount))
      form.append('cost_type', f.cost_type)
      const file = fileRef.current?.files?.[0]
      if (file) form.append('image', new File([await resizeImage(file)], 'receipt.jpg', { type: 'image/jpeg' }))
      const r = await fetch('/api/receipts', { method: 'POST', body: form })
      const j = await r.json()
      if (!j.ok) { setError(j.error ?? '등록 실패'); return }
      setF({ ...f, vendor: '', amount: '' })
      setFileName('')
      if (fileRef.current) fileRef.current.value = ''
      // 등록한 분기로 이동해 새로고침
      const regQ = Math.floor((Number(f.date.slice(5, 7)) - 1) / 3) + 1
      if (regQ === q) await load(q)
      else setQ(regQ)
    } catch {
      setError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('이 영수증을 삭제할까요? (사진도 함께 삭제)')) return
    setBusyId(id)
    try {
      const r = await fetch(`/api/receipts?id=${id}`, { method: 'DELETE' })
      const j = await r.json()
      if (j.ok) setRows((prev) => prev.filter((x) => x.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  const readyCount = queue.filter((it) => it.status === 'ready' || it.status === 'error').length
  const ocrCount = queue.filter((it) => it.status === 'ocr').length

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <ReceiptText className="w-4 h-4" style={{ color: PRIMARY }} />
          간이영수증 대장
          <span className="text-xs font-normal text-slate-400">
            · 사진 여러 장 드래그 · 항목 분류 · 분기별 관리 · 신고용 엑셀 다운로드
          </span>
          <span className="ml-auto inline-flex overflow-hidden rounded border border-slate-200">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQ(n)}
                className="h-7 px-2.5 text-[11px] font-bold transition-colors"
                style={{
                  backgroundColor: q === n ? PRIMARY : 'white',
                  color: q === n ? '#000' : '#64748b',
                }}
              >
                {n}분기
              </button>
            ))}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tableMissing ? (
          <p className="text-xs text-rose-600 bg-rose-50 rounded p-3">
            영수증 테이블이 없습니다 — <code>supabase/migrations/2026-07-03_simple_receipts.sql</code>{' '}
            을 실행해 주세요.
          </p>
        ) : (
          <>
            {error && <p className="text-xs text-rose-600 bg-rose-50 rounded p-2">⚠ {error}</p>}

            {/* 사진 여러 장 드래그앤드롭 영역 */}
            <div
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors
                ${dragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}
              onClick={() => dropRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={dropRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.jpe,.jfif,.png,.heic,.heif,.webp,.gif,.bmp"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) { addImages(Array.from(e.target.files)); e.target.value = '' } }}
              />
              <UploadCloud className="w-6 h-6 mx-auto text-slate-400" />
              <p className="text-sm text-slate-500 mt-1.5">영수증 사진을 끌어다 놓거나 클릭해서 선택</p>
              <p className="text-[11px] text-slate-400 mt-0.5">여러 장 동시 · AI가 날짜·상호·금액 자동 인식 · 업로드 시 자동 축소</p>
            </div>

            {/* 큐: 드롭한 사진 목록 — 상호·항목·금액 입력 후 일괄 등록 */}
            {queue.length > 0 && (
              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                {/* 공통 기본값 바 */}
                <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500">공통값</span>
                  <input
                    placeholder="상호 (예: (주)일신항공해운)"
                    className="h-7 px-2 text-[12px] border rounded outline-none w-48"
                    value={defaults.vendor}
                    onChange={(e) => setDefaults({ ...defaults, vendor: e.target.value })}
                  />
                  <input
                    placeholder="항목 (예: 운송료)"
                    list="receipt-item-options"
                    className="h-7 px-2 text-[12px] border rounded outline-none w-28"
                    value={defaults.item}
                    onChange={(e) => setDefaults({ ...defaults, item: e.target.value })}
                  />
                  <span className="inline-flex overflow-hidden rounded border border-slate-200">
                    {([{ v: 'variable', label: '변동비' }, { v: 'fixed', label: '고정비' }] as const).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setDefaults({ ...defaults, cost_type: o.v })}
                        className="h-7 px-2.5 text-[11px] font-bold"
                        style={{
                          backgroundColor: defaults.cost_type === o.v ? PRIMARY : 'white',
                          color: defaults.cost_type === o.v ? '#000' : '#64748b',
                        }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </span>
                  <button
                    type="button"
                    onClick={applyDefaultsToAll}
                    className="h-7 px-2.5 text-[11px] font-bold border rounded text-slate-600 hover:border-slate-400"
                    title="위 공통값을 아래 모든 사진에 채웁니다"
                  >
                    전체 적용
                  </button>
                </div>

                <datalist id="receipt-item-options">
                  {ITEM_OPTIONS.map((o) => <option key={o} value={o} />)}
                </datalist>

                {/* 각 사진 행 */}
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {queue.map((it) => (
                    <div
                      key={it.id}
                      className={`flex flex-wrap items-center gap-2 rounded p-1.5 ${
                        it.status === 'error' ? 'bg-rose-50' : it.status === 'saving' ? 'bg-slate-50' : ''
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.previewUrl} alt="영수증" className="w-11 h-11 object-cover rounded border shrink-0" />
                      <input
                        type="date"
                        className="h-8 px-2 text-[12px] border rounded outline-none"
                        value={it.date}
                        onChange={(e) => patchQueue(it.id, { date: e.target.value })}
                      />
                      <input
                        placeholder="상호"
                        className="h-8 px-2 text-[12px] border rounded outline-none w-40"
                        value={it.vendor}
                        onChange={(e) => patchQueue(it.id, { vendor: e.target.value })}
                      />
                      <input
                        placeholder="항목"
                        list="receipt-item-options"
                        className="h-8 px-2 text-[12px] border rounded outline-none w-24"
                        value={it.item}
                        onChange={(e) => patchQueue(it.id, { item: e.target.value })}
                      />
                      <input
                        type="number"
                        placeholder="금액"
                        className="h-8 px-2 text-[12px] border rounded outline-none w-24"
                        value={it.amount}
                        onChange={(e) => patchQueue(it.id, { amount: e.target.value })}
                      />
                      <span className="inline-flex overflow-hidden rounded border border-slate-200">
                        {([{ v: 'variable', label: '변동' }, { v: 'fixed', label: '고정' }] as const).map((o) => (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => patchQueue(it.id, { cost_type: o.v })}
                            className="h-8 px-2 text-[11px] font-bold"
                            style={{
                              backgroundColor: it.cost_type === o.v ? PRIMARY : 'white',
                              color: it.cost_type === o.v ? '#000' : '#64748b',
                            }}
                          >
                            {o.label}
                          </button>
                        ))}
                      </span>
                      <span className="ml-auto flex items-center gap-1.5">
                        {it.status === 'ocr' && (
                          <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />AI 인식 중
                          </span>
                        )}
                        {it.status === 'ready' && it.ocrFilled && (
                          <span
                            className="text-[10px] font-bold px-1 py-0.5 rounded"
                            style={{ backgroundColor: 'rgba(118,185,0,0.12)', color: '#4a7c00' }}
                            title="AI가 자동 입력한 값 — 확인 후 수정하세요"
                          >
                            AI
                          </span>
                        )}
                        {it.status === 'saving' && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        {it.status === 'error' && (
                          <span className="text-[11px] text-rose-600 inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />{it.errorMsg}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeQueueItem(it.id)}
                          disabled={it.status === 'saving'}
                          className="p-1 text-slate-300 hover:text-slate-500 disabled:opacity-40"
                          title="목록에서 제거"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    {queue.length}장{ocrCount > 0 ? ` · AI 인식 중 ${ocrCount}장` : ''} · 등록 대기 {readyCount}장
                  </span>
                  <button
                    type="button"
                    onClick={saveQueue}
                    disabled={bulkSaving || readyCount === 0}
                    className="h-8 px-3 text-[12px] font-bold inline-flex items-center gap-1 disabled:opacity-50"
                    style={{ backgroundColor: PRIMARY, color: '#000', borderRadius: '4px' }}
                  >
                    {bulkSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {readyCount}장 등록
                  </button>
                </div>
              </div>
            )}

            {/* 빠른 입력 폼 — 사진 없이 1건씩 손입력 */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-8 px-2.5 inline-flex items-center gap-1.5 text-[12px] font-bold border rounded text-slate-600 hover:border-slate-400"
                title="영수증 사진 선택 (선택사항)"
              >
                <Camera className="w-3.5 h-3.5" />
                {fileName ? fileName.slice(0, 14) + (fileName.length > 14 ? '…' : '') : '사진'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.jpe,.jfif,.png,.heic,.heif,.webp,.gif,.bmp"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              />
              <input
                type="date"
                className="h-8 px-2 text-[12px] border rounded outline-none"
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
              <input
                placeholder="상호 (예: ㈜일신항공해운)"
                className="h-8 px-2 text-[12px] border rounded outline-none w-44"
                value={f.vendor}
                onChange={(e) => setF({ ...f, vendor: e.target.value })}
              />
              <select
                className="h-8 px-1.5 text-[12px] border rounded outline-none"
                value={f.itemPick}
                onChange={(e) => setF({ ...f, itemPick: e.target.value })}
              >
                {ITEM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                <option value={CUSTOM}>직접 입력</option>
              </select>
              {f.itemPick === CUSTOM && (
                <input
                  placeholder="항목명"
                  className="h-8 px-2 text-[12px] border rounded outline-none w-24"
                  value={f.itemCustom}
                  onChange={(e) => setF({ ...f, itemCustom: e.target.value })}
                />
              )}
              <input
                type="number"
                placeholder="금액"
                className="h-8 px-2 text-[12px] border rounded outline-none w-24"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
              />
              <span className="inline-flex overflow-hidden rounded border border-slate-200">
                {(
                  [
                    { v: 'variable', label: '변동비' },
                    { v: 'fixed', label: '고정비' },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setF({ ...f, cost_type: o.v })}
                    className="h-8 px-2.5 text-[11px] font-bold"
                    style={{
                      backgroundColor: f.cost_type === o.v ? PRIMARY : 'white',
                      color: f.cost_type === o.v ? '#000' : '#64748b',
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </span>
              <button
                type="button"
                onClick={add}
                disabled={saving}
                className="h-8 px-3 text-[12px] font-bold inline-flex items-center gap-1"
                style={{ backgroundColor: PRIMARY, color: '#000', borderRadius: '4px' }}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                등록
              </button>
            </div>

            {/* 분기 목록 */}
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold text-slate-700">
                {year}년 {q}분기 · {rows.length}건 ·{' '}
                <span className="tabular-nums">{formatKRW(total)}</span>
              </p>
              <a
                href={`/api/receipts/export?year=${year}&q=${q}`}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-bold border rounded text-slate-600 hover:border-slate-400"
                title="이 분기 엑셀 다운로드 (신고용 양식)"
              >
                <Download className="w-3.5 h-3.5" />
                엑셀
              </a>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400 py-3 text-center">
                <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
                불러오는 중...
              </p>
            ) : rows.length === 0 ? (
              <p className="text-[12px] italic text-slate-400 py-1">
                이 분기 영수증이 없습니다. 사진과 함께 등록해 보세요.
              </p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-[12px]">
                    <span className="w-12 shrink-0 tabular-nums text-slate-400">
                      {r.receipt_date.slice(5).replace('-', '.')}
                    </span>
                    {r.imageUrl ? (
                      <a
                        href={r.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-blue-500 hover:text-blue-700"
                        title="영수증 사진 보기"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{r.vendor}</span>
                    <span className="shrink-0 text-slate-500">{r.item}</span>
                    <span
                      className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: r.cost_type === 'fixed' ? '#eef2ff' : 'rgba(118,185,0,0.12)',
                        color: r.cost_type === 'fixed' ? '#4338ca' : '#4a7c00',
                        borderRadius: '2px',
                      }}
                    >
                      {r.cost_type === 'fixed' ? '고정' : '변동'}
                    </span>
                    <span className="shrink-0 tabular-nums font-bold text-slate-900">
                      {formatKRW(r.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      disabled={busyId === r.id}
                      className="p-1 shrink-0 text-slate-300 hover:text-slate-500"
                      title="삭제"
                    >
                      {busyId === r.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-400">
              간이영수증은 부가세 공제 대상이 아니라 종소세·법인세 경비로 관리됩니다. 연간 전체
              다운로드는{' '}
              <a href={`/api/receipts/export?year=${year}`} className="underline">
                여기
              </a>
              .
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
