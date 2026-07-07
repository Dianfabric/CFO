'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, blobToBase64, resizeImage, StatusBadge, type BookRow } from '../_lib/helpers'

/* ─────────────────────────── QR/바코드 스캐너 ───────────────────────────
 * 1순위: 네이티브 BarcodeDetector (Android Chrome/삼성인터넷 — 지원 포맷 전체 사용)
 * 2순위: ZXing 폴백 (iOS 등 미지원 브라우저)
 * 1D 바코드 인식 개선: 1080p 요청 + 연속 초점 + 손전등 토글 */
type BarcodeDetectorLike = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type DetectorCtor = (new (o: { formats: string[] }) => BarcodeDetectorLike) & { getSupportedFormats?: () => Promise<string[]> }

export function QrScanDialog({ title, onDetect, onClose, rentedOnly, continuous }: {
  title: string
  onDetect: (code: string) => void
  onClose: () => void
  /** true면 직접입력 자동완성에 대여중인 샘플북만 표시 (반납용) */
  rentedOnly?: boolean
  /** true면 인식 후에도 카메라 유지 — 연속 스캔 (같은 코드는 3초간 중복 무시) */
  continuous?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')
  const [sugs, setSugs] = useState<BookRow[]>([])
  const [torchAvail, setTorchAvail] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const stopRef = useRef(false)
  // onDetect가 리렌더마다 바뀌어도 카메라가 재시작되지 않도록 ref로 고정
  const onDetectRef = useRef(onDetect)
  useEffect(() => { onDetectRef.current = onDetect }, [onDetect])

  // 직접 입력 자동완성 — 기존 샘플북(이름·첫 원단명) 드롭다운
  useEffect(() => {
    if (!manual.trim()) { setSugs([]); return }
    const t = setTimeout(() => {
      api<{ books: BookRow[] }>(`/api/samples/books?q=${encodeURIComponent(manual.trim())}&limit=6`)
        .then((r) => setSugs(rentedOnly ? r.books.filter((b) => b.active_rental_id) : r.books))
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [manual, rentedOnly])

  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    stopRef.current = false
    let stream: MediaStream | null = null
    const Detector = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector

    async function run() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        // 연속 초점 (지원 기기만) — 1D 바코드는 초점이 관건
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }) } catch { /* 미지원 */ }
        const caps = (track.getCapabilities?.() || {}) as { torch?: boolean; zoom?: { min: number; max: number; step: number } }
        if (caps.torch) setTorchAvail(true)
        if (caps.zoom && caps.zoom.max > caps.zoom.min) setZoomCaps(caps.zoom)

        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        // ── 인식 엔진 준비 ──
        // 1) 네이티브 BarcodeDetector (있으면)
        let detector: BarcodeDetectorLike | null = null
        if (Detector) {
          const supported = (await Detector.getSupportedFormats?.().catch(() => null)) ||
            ['qr_code', 'code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar']
          detector = new Detector({ formats: supported })
        }
        // 2) ZXing (항상 병행 — TRY_HARDER 모드, 긴 code128/39에 강함)
        let zxingReader: { decodeFromCanvas: (c: HTMLCanvasElement) => { getText: () => string } } | null = null
        try {
          const [{ BrowserMultiFormatReader }, zx] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
          const hints = new Map()
          hints.set(zx.DecodeHintType.TRY_HARDER, true)
          hints.set(zx.DecodeHintType.POSSIBLE_FORMATS, [
            zx.BarcodeFormat.CODE_128, zx.BarcodeFormat.CODE_39, zx.BarcodeFormat.CODE_93,
            zx.BarcodeFormat.QR_CODE, zx.BarcodeFormat.EAN_13, zx.BarcodeFormat.ITF,
          ])
          zxingReader = new BrowserMultiFormatReader(hints) as unknown as typeof zxingReader
        } catch { /* zxing 로드 실패 시 네이티브만 사용 */ }

        // 연속 스캔용 — 같은 코드 3초 중복 방지
        let lastCode = ''
        let lastAt = 0
        const handleHit = (code: string): boolean => {
          const now = Date.now()
          if (code === lastCode && now - lastAt < 3000) return false
          lastCode = code; lastAt = now
          onDetectRef.current(code)
          return true
        }

        // ── 인식 루프: 가이드 영역 크롭 + 2배 확대 → 두 엔진 순차 시도 ──
        // 긴 바코드(DIAN-HF.24.C.C-002 등)는 줄이 촘촘해서 원본 프레임으론 못 읽는 경우가
        // 많음 → 중앙 밴드만 잘라 확대하면 해상도가 사실상 2배가 됨.
        const work = document.createElement('canvas')
        const wctx = work.getContext('2d', { willReadFrequently: true })!
        let tick = 0
        const loop = async () => {
          if (stopRef.current) return
          const v = videoRef.current
          if (!v || !v.videoWidth) { setTimeout(loop, 150); return }
          try {
            const vw = v.videoWidth, vh = v.videoHeight
            // 중앙 가로 밴드 (가이드 프레임 대응): 가로 94%, 세로 45%
            const cw = vw * 0.94, ch = vh * 0.45
            const cx = (vw - cw) / 2, cy = (vh - ch) / 2
            const scale = Math.min(2, 2600 / cw)
            work.width = Math.round(cw * scale)
            work.height = Math.round(ch * scale)
            wctx.drawImage(v, cx, cy, cw, ch, 0, 0, work.width, work.height)

            let code = ''
            if (detector) {
              try {
                const codes = await detector.detect(work as unknown as HTMLVideoElement)
                code = codes.find((c) => c.rawValue?.trim())?.rawValue?.trim() || ''
              } catch { /* skip */ }
            }
            if (!code && zxingReader) {
              try { code = zxingReader.decodeFromCanvas(work).getText().trim() } catch { /* not found */ }
            }
            // 4번에 1번은 전체 프레임도 시도 (가이드 밖 QR 대응)
            if (!code && detector && tick % 4 === 0) {
              try {
                const codes = await detector.detect(v)
                code = codes.find((c) => c.rawValue?.trim())?.rawValue?.trim() || ''
              } catch { /* skip */ }
            }
            tick++
            if (code && handleHit(code) && !continuous) { stopRef.current = true; return }
          } catch { /* 프레임 스킵 */ }
          setTimeout(loop, 150)
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
    // 카메라는 마운트 시 1회만 시작 — onDetect는 ref로 참조
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuous])

  const toggleTorch = async () => {
    const track = trackRef.current
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn((v) => !v)
    } catch { /* 미지원 */ }
  }

  const applyZoom = async (z: number) => {
    const track = trackRef.current
    if (!track || !zoomCaps) return
    const clamped = Math.min(zoomCaps.max, Math.max(zoomCaps.min, z))
    try {
      await track.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet] })
      setZoom(clamped)
    } catch { /* 미지원 */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-base font-extrabold">{title}</h3>
          <div className="flex shrink-0 gap-1.5">
            {zoomCaps && [1, 2, 3].filter((z) => z <= zoomCaps.max).map((z) => (
              <button key={z} onClick={() => applyZoom(z)}
                className={`h-8 rounded-md px-2.5 text-xs font-bold ${Math.round(zoom) === z ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {z}x
              </button>
            ))}
            {torchAvail && (
              <button onClick={toggleTorch}
                className={`h-8 rounded-md px-2.5 text-xs font-bold ${torchOn ? 'bg-yellow-400 text-slate-900' : 'bg-slate-100 text-slate-600'}`}>
                🔦
              </button>
            )}
          </div>
        </div>
        <div className="relative mb-3 h-72 overflow-hidden rounded-xl bg-slate-950">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {/* 바코드용 가로 프레임 가이드 */}
          <div className="pointer-events-none absolute left-6 right-6 top-1/2 h-28 -translate-y-1/2 rounded-lg border-2 border-white/90"
            style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }} />
          <div className="pointer-events-none absolute left-6 right-6 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/70" />
        </div>
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p>
          : <p className="mb-2 text-center text-xs text-slate-500">바코드를 프레임에 꽉 차게 — 긴 바코드는 <b>2x 줌</b>을 켜고 15~20cm 거리에서 잠시 유지하세요</p>}
        <div className="relative">
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && manual.trim()) onDetect(sugs[0]?.code || manual.trim()) }}
              placeholder="또는 직접 입력 — 이름·첫 원단명 검색 (예: DN#148)"
              className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm"
              autoComplete="off"
            />
            <button
              onClick={() => manual.trim() && onDetect(manual.trim())}
              className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white"
            >확인</button>
          </div>
          {sugs.length > 0 && (
            <div className="absolute inset-x-0 bottom-12 z-30 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
              {sugs.map((b) => (
                <button key={b.id} onClick={() => onDetect(b.code)}
                  className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50">
                  <span className="font-mono text-sm font-bold" style={{ flex: 'none' }}>{b.code}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                    {b.first_fabric}{rentedOnly && b.active_client_name ? ` · ${b.active_client_name}` : ''}
                  </span>
                  <StatusBadge status={b.status} od={b.overdue_days} />
                </button>
              ))}
            </div>
          )}
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

/* ─────────────────── 명함 촬영 카메라 (프레임 가이드) ───────────────────
 * 명함 비율(1.7:1) 가이드에 맞춰 촬영 → 가이드 영역만 잘라서 반환 */
export function CardCameraDialog({ onCaptured, onClose }: {
  onCaptured: (blob: Blob) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    async function run() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        const track = stream.getVideoTracks()[0]
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }) } catch { /* 미지원 */ }
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setReady(true)
      } catch { setError('카메라를 열 수 없어요. 아래 "앨범에서 선택"을 이용해주세요.') }
    }
    run()
    return () => { stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    // 가이드(가로 88%, 명함비율 1.7)와 같은 중앙 영역을 실제 프레임에서 크롭
    const vw = v.videoWidth, vh = v.videoHeight
    let cw = vw * 0.88
    let ch = cw / 1.7
    if (ch > vh * 0.9) { ch = vh * 0.9; cw = ch * 1.7 }
    const cx = (vw - cw) / 2, cy = (vh - ch) / 2
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(cw)
    canvas.height = Math.round(ch)
    canvas.getContext('2d')!.drawImage(v, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((b) => { if (b) onCaptured(b) }, 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/70 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-extrabold">명함 촬영</h3>
        <div className="relative mb-3 overflow-hidden rounded-xl bg-slate-950" style={{ aspectRatio: '4/3' }}>
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {/* 명함 비율 가이드 프레임 — 바깥은 어둡게 */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-white"
            style={{ width: '88%', aspectRatio: '1.7', boxShadow: '0 0 0 9999px rgba(0,0,0,.55)' }}>
            <span className="absolute -top-6 left-0 right-0 text-center text-xs font-semibold text-white">명함을 프레임에 맞춰주세요</span>
          </div>
        </div>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <button onClick={capture} disabled={!ready}
          className="h-12 w-full rounded-md bg-slate-900 text-[15px] font-bold text-white disabled:opacity-50">📸 촬영</button>
        <button onClick={onClose} className="mt-2 h-10 w-full rounded-md border border-slate-200 text-sm font-semibold text-slate-600">닫기</button>
      </div>
    </div>
  )
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
  const [showCam, setShowCam] = useState(false)
  const cardRef = useRef<HTMLInputElement>(null)

  const runOcr = useCallback(async (file: Blob) => {
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

        <input ref={cardRef} type="file" accept="image/*" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) runOcr(f) }} />
        <button
          onClick={() => setShowCam(true)} disabled={ocrState === 'busy'}
          className="h-11 w-full rounded-md bg-slate-900 text-sm font-bold text-white disabled:opacity-60"
        >
          {ocrState === 'busy' ? '📷 명함 인식 중…' : ocrState === 'done' ? '✅ 자동으로 채웠어요 — 확인 후 저장' : '📇 명함 촬영으로 자동입력'}
        </button>
        <button onClick={() => cardRef.current?.click()} disabled={ocrState === 'busy'}
          className="mt-1.5 w-full text-center text-xs font-semibold text-slate-500 underline underline-offset-2">
          앨범에서 명함 사진 선택
        </button>
        {ocrState === 'fail' && <p className="mt-1 text-xs text-red-600">명함 인식 실패 — 직접 입력해주세요</p>}
        {showCam && (
          <CardCameraDialog onClose={() => setShowCam(false)}
            onCaptured={(blob) => { setShowCam(false); runOcr(blob) }} />
        )}
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
