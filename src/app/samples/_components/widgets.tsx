'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, blobToBase64, resizeImage } from '../_lib/helpers'

/* ─────────────────────────── QR 스캐너 ───────────────────────────
 * 네이티브 BarcodeDetector 사용 (Android Chrome/삼성인터넷 지원).
 * 미지원 브라우저(iOS Safari 구버전 등)는 수동 입력 폴백. */
type BarcodeDetectorLike = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

export function QrScanDialog({ title, onDetect, onClose }: {
  title: string
  onDetect: (code: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')
  const stopRef = useRef(false)

  useEffect(() => {
    stopRef.current = false
    let stream: MediaStream | null = null
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector

    async function run() {
      if (!Detector) { setError('이 브라우저는 카메라 스캔을 지원하지 않아요. 아래에 코드를 직접 입력해주세요.'); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const detector = new Detector({ formats: ['qr_code', 'code_128', 'code_39'] })
        const loop = async () => {
          if (stopRef.current || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length && codes[0].rawValue) {
              stopRef.current = true
              onDetect(codes[0].rawValue.trim())
              return
            }
          } catch { /* 프레임 스킵 */ }
          requestAnimationFrame(loop)
        }
        loop()
      } catch {
        setError('카메라를 열 수 없어요. 권한을 확인하거나 코드를 직접 입력해주세요.')
      }
    }
    run()
    return () => {
      stopRef.current = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onDetect])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-extrabold">{title}</h3>
        <div className="relative mb-3 h-64 overflow-hidden rounded-xl bg-slate-950">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-white/80" />
        </div>
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p>
          : <p className="mb-2 text-center text-xs text-slate-500">샘플북의 QR/바코드를 프레임에 맞춰주세요</p>}
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && manual.trim()) onDetect(manual.trim()) }}
            placeholder="또는 코드 직접 입력 (예: DN#148)"
            className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm"
          />
          <button
            onClick={() => manual.trim() && onDetect(manual.trim())}
            className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white"
          >확인</button>
        </div>
        <button onClick={onClose} className="mt-2 h-10 w-full rounded-md border border-slate-200 text-sm font-semibold text-slate-600">닫기</button>
      </div>
    </div>
  )
}

/* ─────────────────────── 사진 촬영/선택 버튼 ─────────────────────── */
export function PhotoButton({ onPicked, label = '📷 사진 추가', className }: {
  onPicked: (blob: Blob, previewUrl: string) => void
  label?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <input
        ref={inputRef} type="file" accept="image/*" capture="environment" hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setBusy(true)
          try {
            const blob = await resizeImage(f)
            onPicked(blob, URL.createObjectURL(blob))
          } finally { setBusy(false) }
        }}
      />
      <button
        type="button" disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={className || 'h-8 rounded-md bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50'}
      >{busy ? '처리 중…' : label}</button>
    </>
  )
}

/** 샘플북 사진 업로드 (Storage 반영) */
export async function uploadBookPhoto(bookId: string, blob: Blob): Promise<string> {
  const fd = new FormData()
  fd.append('file', blob, 'photo.jpg')
  fd.append('bookId', bookId)
  const res = await api<{ imageUrl: string }>('/api/samples/books/photo', { method: 'POST', body: fd })
  return res.imageUrl
}

/* ─────────────────── 신규 거래처 등록 (명함 OCR) ─────────────────── */
export function NewClientDialog({ onCreated, onClose }: {
  onCreated: (client: { id: string; name: string; phone: string | null }) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', jobs: [] as string[] })
  const [ocrState, setOcrState] = useState<'idle' | 'busy' | 'done' | 'fail'>('idle')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const cardRef = useRef<HTMLInputElement>(null)

  const runOcr = useCallback(async (file: File) => {
    setOcrState('busy')
    try {
      const blob = await resizeImage(file, 1000, 0.85)
      const b64 = await blobToBase64(blob)
      const r = await api<{ clientName?: string; company?: string; person?: string; phone?: string; email?: string }>(
        '/api/samples/ocr', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: b64 }),
        })
      setForm((f) => ({
        ...f,
        name: r.clientName || (r.company ? `${r.company}(${r.person || ''})` : f.name),
        phone: r.phone || f.phone,
        email: r.email || f.email,
      }))
      setOcrState('done')
    } catch { setOcrState('fail') }
  }, [])

  const save = async () => {
    if (!form.name.trim()) { setErr('거래처 이름을 입력해주세요'); return }
    setSaving(true); setErr('')
    try {
      const { client } = await api<{ client: { id: string; name: string; phone: string | null } }>(
        '/api/samples/clients', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, phone: form.phone, email: form.email, job_types: form.jobs }),
        })
      onCreated(client)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setSaving(false) }
  }

  const toggleJob = (j: string) =>
    setForm((f) => ({ ...f, jobs: f.jobs.includes(j) ? f.jobs.filter((x) => x !== j) : [...f.jobs, j] }))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[86vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-extrabold">신규 거래처 등록</h3>
        <p className="mb-3 text-xs text-slate-500">명함 한 장이면 자동으로 채워집니다</p>

        <input ref={cardRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) runOcr(f) }} />
        <button
          onClick={() => cardRef.current?.click()} disabled={ocrState === 'busy'}
          className="h-11 w-full rounded-md bg-slate-900 text-sm font-bold text-white disabled:opacity-60"
        >
          {ocrState === 'busy' ? '📷 명함 인식 중…' : ocrState === 'done' ? '✅ 자동으로 채웠어요 — 확인 후 저장' : '📇 명함 촬영으로 자동입력'}
        </button>
        {ocrState === 'fail' && <p className="mt-1 text-xs text-red-600">명함 인식 실패 — 직접 입력해주세요</p>}
        <div className="my-3 text-center text-xs text-slate-400">또는 직접 입력</div>

        {[['거래처 이름 *', 'name', '회사명(담당자명)'], ['전화번호', 'phone', '010-0000-0000'], ['이메일', 'email', 'name@company.com']].map(([label, key, ph]) => (
          <div key={key} className="mb-2.5">
            <div className="mb-1 text-xs font-semibold text-slate-500">{label}</div>
            <input
              value={form[key as 'name' | 'phone' | 'email']}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={ph}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            />
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
