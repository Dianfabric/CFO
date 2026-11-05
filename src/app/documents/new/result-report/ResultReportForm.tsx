'use client'

/**
 * 결과보고서 작성 (대표 지시 2026-11-06)
 *
 * 견적서를 불러와 납품·설치가 끝난 뒤 거래처에 보내는 결과보고서로 변환.
 * 1쪽은 직인이 있는 공문(납품 내역 표), 2쪽부터는 현장 사진 붙임.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ClipboardCheck,
  CloudUpload,
  Copy,
  FileDown,
  FileUp,
  History,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  X,
} from 'lucide-react'
import ClientCombobox, { ClientOption } from '@/components/documents/ClientCombobox'
import DocumentHistoryDialog from '@/components/documents/DocumentHistoryDialog'
import { PaymentItem, VatMode, paymentTotals } from '@/components/documents/PaymentRequestTable'
import ResultReportDocument, {
  COVER_ELEMENT_ID,
  PAGE_HEIGHT,
  ReportPhoto,
} from '@/components/documents/ResultReportDocument'
import { downloadPDF, downloadJPG, getCanvasBlob, getPDFBlob, copyImageToClipboard } from '@/lib/document-export'
import { useGoogleDrive } from '@/hooks/useGoogleDrive'
import { getOrCreateFolder, uploadToDrive } from '@/lib/google-drive'
import { imageToBase64, parseQuoteJson } from '@/lib/quote-import'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

const ROOT_FOLDER_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID ?? ''
const DOC_TYPE = 'RESULT_REPORT'
const DEFAULT_TITLE = '결과보고서'
const PHOTO_SIDE = 1200
const DRIVE_LOGIN_TIMEOUT_MS = 120_000

interface FormState {
  recipientClientId: string
  recipientName: string
  ccLine: string
  title: string
  issueDate: string
  siteName: string
  resultLabel: string
  quoteDate: string
  completeDate: string
  notes: string
  bodyText: string
}

const EMPTY_ITEM: PaymentItem = { name: '', color: '', spec: '', qty: '', unit: 'ea', price: '', remark: '' }

const DEFAULT_FORM: FormState = {
  recipientClientId: '',
  recipientName: '',
  ccLine: '',
  title: DEFAULT_TITLE,
  issueDate: '',
  siteName: '',
  resultLabel: '납품 및 디스플레이',
  quoteDate: '',
  completeDate: '',
  notes: '',
  bodyText: '',
}

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일' */
function koreanDate(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ymd
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`
}

/** 받침 유무로 주격 조사 선택 */
function subjectJosa(word: string): '이' | '가' {
  const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? '이' : '가'
}

function buildBody(s: Pick<FormState, 'siteName' | 'resultLabel' | 'quoteDate' | 'completeDate'>): string {
  const result = s.resultLabel.trim() || '납품'
  const quote = s.quoteDate.trim() ? `${s.quoteDate.trim()}자 견적 ` : ''
  const site = s.siteName.trim() ? `「${s.siteName.trim()}」 현장 ` : ''
  const subject = quote || site ? `${quote}${site}건의 ` : '귀사에서 요청하신 건의 '
  const when = s.completeDate ? `${koreanDate(s.completeDate)}부로 ` : ''
  return `1. 귀사의 무궁한 발전을 기원합니다.
2. ${subject}${result}${subjectJosa(result)} ${when}완료되었기에 아래와 같이 결과를 보고드립니다.
3. 납품 내역은 하단 표와 같으며, 항목별 현장 사진은 붙임과 같습니다.
4. 확인 후 추가로 필요하신 사항은 담당자에게 말씀해 주시기 바랍니다. 감사합니다.`
}

function formatIssueDate(value: string) {
  if (!value) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replace(/-/g, '. ') + '.'
  return value
}

function safeFilePart(value: string, fallback: string) {
  return (value || fallback).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '').trim() || fallback
}

/** 사진을 정사각형으로 잘라 축소 — 보고서 사진 칸 비율에 맞추고 저장 용량을 줄인다 */
async function normalizePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const output = Math.min(side, PHOTO_SIDE)
  const canvas = document.createElement('canvas')
  canvas.width = output
  canvas.height = output
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스 생성 실패')
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, output, output)
  return canvas.toDataURL('image/jpeg', 0.88)
}

/** 사진을 자료 보관함 버킷에 올리고 공개 URL 반환 (이미 올린 사진은 그대로) */
async function uploadPhoto(url: string, name: string): Promise<string> {
  if (!url.startsWith('data:')) return url
  const supabase = createSupabaseClient()
  if (!supabase) throw new Error('Supabase 환경변수 미설정 — 사진 업로드 불가')
  const blob = await (await fetch(url)).blob()
  const sign = await fetch(`/api/documents/media/upload-url?name=${encodeURIComponent(name)}`)
  const signJson = await sign.json()
  if (!sign.ok) throw new Error(signJson.error ?? '업로드 URL 발급 실패')
  const { error } = await supabase.storage
    .from('media-library')
    .uploadToSignedUrl(signJson.path as string, signJson.token as string, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error(`사진 업로드 실패: ${error.message}`)
  return signJson.publicUrl as string
}

export default function ResultReportForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const fromId = sp.get('from')

  const [clients, setClients] = useState<ClientOption[]>([])
  const [profile, setProfile] = useState<Record<string, string> | null>(null)
  const [docNumber, setDocNumber] = useState('')
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM, bodyText: buildBody(DEFAULT_FORM) })
  const [bodyEdited, setBodyEdited] = useState(false) // 수동 수정 전까지 본문 자동 생성
  const [items, setItems] = useState<PaymentItem[]>([{ ...EMPTY_ITEM }])
  const [vatMode, setVatMode] = useState<VatMode>('excl')
  const [photos, setPhotos] = useState<ReportPhoto[]>([])
  const [importNote, setImportNote] = useState('')
  const [coverOverflow, setCoverOverflow] = useState(false)

  const [ocrLoading, setOcrLoading] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savePhase, setSavePhase] = useState<'' | 'photo' | 'db' | 'drive'>('')
  const [downloading, setDownloading] = useState<'' | 'pdf' | 'jpg'>('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [copyImgState, setCopyImgState] = useState<'idle' | 'copying' | 'done'>('idle')
  const quoteFileRef = useRef<HTMLInputElement>(null)
  const photoFileRef = useRef<HTMLInputElement>(null)

  const { getToken } = useGoogleDrive()

  useEffect(() => {
    fetch('/api/clients').then((r) => r.json()).then(setClients).catch(() => {})
    fetch('/api/company-profile').then((r) => r.json()).then(setProfile).catch(() => {})
    fetch('/api/documents/next-number')
      .then((r) => r.json()).then((j) => setDocNumber(j.documentNumber || '')).catch(() => {})
  }, [])

  // 수정 생성 (발행 이력에서 from=id)
  useEffect(() => {
    if (!fromId) return
    let cancelled = false
    fetch(`/api/documents/${fromId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found'))))
      .then((d) => {
        if (cancelled || !d) return
        if (d.type !== DOC_TYPE) {
          alert('결과보고서가 아닙니다.')
          return
        }
        let meta: Record<string, unknown> = {}
        try { meta = d.metaJson ? JSON.parse(d.metaJson) : {} } catch {}
        let savedItems: PaymentItem[] = []
        try { savedItems = d.tableJson ? JSON.parse(d.tableJson) : [] } catch {}
        setForm({
          recipientClientId: d.recipientClientId || '',
          recipientName: d.recipientName || '',
          ccLine: d.ccLine || '',
          title: d.title || DEFAULT_TITLE,
          issueDate: '',
          siteName: (meta.siteName as string) || '',
          resultLabel: (meta.resultLabel as string) || DEFAULT_FORM.resultLabel,
          quoteDate: (meta.quoteDate as string) || '',
          completeDate: (meta.completeDate as string) || '',
          notes: (meta.notes as string) || '',
          bodyText: d.bodyText || '',
        })
        setBodyEdited(true) // 저장된 본문 그대로 유지
        if (savedItems.length) setItems(savedItems)
        if (meta.vatMode === 'incl' || meta.vatMode === 'excl') setVatMode(meta.vatMode)
        if (Array.isArray(meta.photos)) setPhotos(meta.photos as ReportPhoto[])
      })
      .catch((err) => {
        console.error('수정 생성 데이터 로드 실패:', err)
        alert('공문 데이터를 불러오지 못했습니다.')
      })
    return () => { cancelled = true }
  }, [fromId])

  // 본문 자동 생성 — 사용자가 본문을 직접 고치기 전까지
  useEffect(() => {
    if (bodyEdited) return
    setForm((s) => ({ ...s, bodyText: buildBody(s) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.siteName, form.resultLabel, form.quoteDate, form.completeDate, bodyEdited])

  const filteredItems = useMemo(
    () => items.filter((it) => it.name.trim() || it.qty.trim() || it.price.trim()),
    [items],
  )
  const totals = useMemo(() => paymentTotals(filteredItems, vatMode), [filteredItems, vatMode])
  const senderLine = useMemo(() => profile?.name || '－', [profile])

  // 1쪽이 A4 를 넘으면 사진 쪽이 PDF 쪽 경계에서 어긋나므로 미리 알린다
  useEffect(() => {
    const cover = document.getElementById(COVER_ELEMENT_ID)
    setCoverOverflow(!!cover && cover.offsetHeight > PAGE_HEIGHT)
  }, [form, filteredItems, vatMode, profile])

  const importQuoteText = (text: string): boolean => {
    try {
      const quote = parseQuoteJson(text)
      if (!quote.items.length) {
        alert('견적서 품목을 찾지 못했습니다. 견적서 생성기에서 저장한 .json 파일인지 확인해주세요.')
        return false
      }
      setItems(quote.items)
      if (quote.vatMode) setVatMode(quote.vatMode)
      setForm((s) => ({
        ...s,
        recipientName: quote.clientName ? `${quote.clientName} 귀하` : s.recipientName,
        siteName: quote.siteName || s.siteName,
        quoteDate: quote.quoteDate || s.quoteDate,
        notes: quote.notes.length ? `※ ${quote.notes.join(' · ')}` : s.notes,
      }))
      setImportNote(
        `견적서 불러옴: ${quote.clientName || '(수신처 없음)'} · 품목 ${quote.items.length}건` +
          (quote.quoteDate ? ` · 견적일 ${quote.quoteDate}` : ''),
      )
      return true
    } catch (e) {
      console.error('견적서 불러오기 실패:', e)
      alert('파일을 읽지 못했습니다. 견적서 .json 또는 이미지 파일을 사용해주세요.')
      return false
    }
  }

  const handleImportQuote = async (file: File) => {
    const isImage = /image\/(jpeg|png|webp)/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
    if (!isImage) {
      importQuoteText(await file.text())
      return
    }
    setOcrLoading(true)
    setImportNote('')
    try {
      const { data, mediaType } = await imageToBase64(file)
      const res = await fetch('/api/documents/quote-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: data, media_type: mediaType }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error || '견적서 이미지 읽기 실패')
        return
      }
      if (importQuoteText(JSON.stringify(json))) {
        setImportNote((n) => n + ' · 📷 이미지 AI 판독 — 수량·단가 숫자를 꼭 확인해주세요')
      }
    } catch (e) {
      console.error('이미지 판독 실패:', e)
      alert('이미지 판독 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setOcrLoading(false)
    }
  }

  const handleAddPhotos = async (files: File[]) => {
    setPhotoLoading(true)
    try {
      const added: ReportPhoto[] = []
      for (const file of files) {
        added.push({ url: await normalizePhoto(file), title: '', detail: '' })
      }
      setPhotos((prev) => [...prev, ...added])
    } catch (e) {
      console.error('사진 추가 실패:', e)
      alert('사진을 읽지 못했습니다: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setPhotoLoading(false)
    }
  }

  const setPhoto = (idx: number, key: 'title' | 'detail', value: string) => {
    setPhotos((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)))
  }
  const movePhoto = (idx: number, delta: number) => {
    setPhotos((prev) => {
      const target = idx + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }
  const removePhoto = (idx: number) => setPhotos((prev) => prev.filter((_, i) => i !== idx))

  const handleClientChange = (id: string, client: ClientOption | null) => {
    setForm((s) => ({
      ...s,
      recipientClientId: id,
      recipientName: client
        ? `${client.name}${client.contactName ? ' / ' + client.contactName : ''} 귀하`
        : s.recipientName,
    }))
  }

  const setItem = (idx: number, key: keyof PaymentItem, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)))
  }
  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx: number) =>
    setItems((prev) => (prev.length <= 1 ? [{ ...EMPTY_ITEM }] : prev.filter((_, i) => i !== idx)))

  const filenameBase = useMemo(() => {
    const recipient = safeFilePart(form.recipientName.replace(/\s*귀하\s*$/, '').split(/\s*\/\s*/)[0], '거래처')
    return `${docNumber}_결과보고서_${recipient}`
  }, [docNumber, form.recipientName])

  const handleDownload = async (kind: 'pdf' | 'jpg') => {
    setDownloading(kind)
    try {
      await (kind === 'pdf' ? downloadPDF(filenameBase) : downloadJPG(filenameBase))
    } catch (e) {
      console.error(`[${kind} 생성 실패]`, e)
      alert(`${kind.toUpperCase()} 생성 실패\n` + (e instanceof Error ? e.name + ': ' + e.message : String(e)))
    }
    setDownloading('')
  }

  const handleCopyImage = async () => {
    setCopyImgState('copying')
    const result = await copyImageToClipboard('document-print-area')
    if (result.ok) {
      setCopyImgState('done')
      setTimeout(() => setCopyImgState('idle'), 1500)
    } else {
      setCopyImgState('idle')
      alert(
        result.reason === 'unsupported' ? '이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다.' :
        result.reason === 'permission' ? '복사 권한이 거부되었습니다. 페이지를 클릭한 후 다시 시도해주세요.' :
        '이미지 복사 실패' + (result.error ? '\n' + result.error : ''),
      )
    }
  }

  const handleSave = async () => {
    if (!form.recipientName.trim()) { alert('수신 정보를 입력해주세요.'); return }
    if (!form.title.trim()) { alert('제목을 입력해주세요.'); return }
    if (totals.grand <= 0) { alert('납품 품목을 입력하거나 견적서를 불러와주세요.'); return }
    // 구글 로그인 팝업은 클릭 직후에 띄워야 차단되지 않는다 — 사진 업로드를 기다리지 않고 먼저 요청
    const driveToken = ROOT_FOLDER_ID ? getToken() : null
    driveToken?.catch(() => {}) // 드라이브 단계에서 처리
    setSaving(true)
    setSavePhase('photo')
    let savedId: string | null = null
    try {
      const uploaded = await Promise.all(
        photos.map(async (p, i) => ({
          ...p,
          url: await uploadPhoto(p.url, `result-report-${docNumber}-${i + 1}.jpg`),
        })),
      )
      setPhotos(uploaded)
      setSavePhase('db')
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: DOC_TYPE,
          title: form.title,
          recipientClientId: form.recipientClientId || null,
          recipientName: form.recipientName,
          ccLine: form.ccLine,
          senderLine,
          bodyText: form.bodyText,
          tableJson: filteredItems,
          metaJson: {
            issueDate: form.issueDate,
            siteName: form.siteName,
            resultLabel: form.resultLabel,
            quoteDate: form.quoteDate,
            completeDate: form.completeDate,
            notes: form.notes,
            vatMode,
            supply: totals.supply,
            vat: totals.vat,
            grand: totals.grand,
            photos: uploaded,
          },
          documentNumber: docNumber,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('저장 실패: ' + (err.error || res.status))
        setSaving(false); setSavePhase('')
        return
      }
      savedId = (await res.json()).id
    } catch (e) {
      alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)))
      setSaving(false); setSavePhase('')
      return
    }

    if (driveToken && savedId) {
      setSavePhase('drive')
      try {
        // 팝업이 차단되거나 닫히면 응답이 오지 않으므로 무한 대기하지 않게 시간 제한
        const token = await Promise.race([
          driveToken,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('구글 로그인이 완료되지 않았습니다.')), DRIVE_LOGIN_TIMEOUT_MS),
          ),
        ])
        const folderId = await getOrCreateFolder('공문 모음', ROOT_FOLDER_ID, token)
        const [pdfBlob, jpgBlob] = await Promise.all([
          getPDFBlob('document-print-area'),
          getCanvasBlob('document-print-area', 'image/jpeg', 0.95),
        ])
        const [driveFileId, driveJpgId] = await Promise.all([
          uploadToDrive(pdfBlob, `${filenameBase}.pdf`, 'application/pdf', folderId, token),
          uploadToDrive(jpgBlob, `${filenameBase}.jpg`, 'image/jpeg', folderId, token),
        ])
        await fetch(`/api/documents/${savedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driveFileId, driveJpgId }),
        })
      } catch (driveErr) {
        console.error('Drive upload failed:', driveErr)
        alert(`구글 드라이브 저장 실패: ${driveErr instanceof Error ? driveErr.message : '알 수 없는 오류'}\n\n공문은 DB에 저장되었습니다.`)
      }
    }

    setSaving(false)
    setSavePhase('')
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 3000)
    try {
      const j = await (await fetch('/api/documents/next-number')).json()
      if (j.documentNumber) setDocNumber(j.documentNumber)
    } catch {}
  }

  const handleReset = async () => {
    if (!confirm('작성한 내용을 모두 초기화할까요?\n저장된 공문은 영향받지 않습니다.')) return
    setForm({ ...DEFAULT_FORM, bodyText: buildBody(DEFAULT_FORM) })
    setBodyEdited(false)
    setItems([{ ...EMPTY_ITEM }])
    setVatMode('excl')
    setPhotos([])
    setImportNote('')
    setSavedFlash(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/documents" className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> 공문 목록
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mt-1">
            <ClipboardCheck className="w-6 h-6 text-teal-600" />
            결과보고서 작성
          </h1>
          <p className="text-sm text-slate-500">견적서를 불러오고 현장 사진을 붙여, 납품·설치 완료를 거래처에 보고하는 문서를 만듭니다.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleDownload('jpg')} disabled={!!downloading} className="gap-1 min-h-11 sm:min-h-0">
            <ImageIcon className="w-3.5 h-3.5" />{downloading === 'jpg' ? '생성 중...' : 'JPG'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDownload('pdf')} disabled={!!downloading} className="gap-1 min-h-11 sm:min-h-0">
            <FileDown className="w-3.5 h-3.5" />{downloading === 'pdf' ? '생성 중...' : 'PDF'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyImage} disabled={copyImgState !== 'idle'} className="gap-1 min-h-11 sm:min-h-0">
            {copyImgState === 'done' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copyImgState === 'copying' ? '복사 중...' : copyImgState === 'done' ? '복사됨!' : '이미지 복사'}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 min-h-11 sm:min-h-0" title="사진 업로드 + DB + 구글 드라이브에 저장">
            {savePhase === 'drive' ? <CloudUpload className="w-3.5 h-3.5 animate-pulse" /> : <Save className="w-3.5 h-3.5" />}
            {savePhase === 'photo' ? '사진 저장 중...' : savePhase === 'db' ? 'DB 저장 중...' : savePhase === 'drive' ? '드라이브 저장 중...' : savedFlash ? '저장됨 ✓' : '발행 및 저장'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} disabled={saving} className="gap-1 min-h-11 sm:min-h-0">
            <RotateCcw className="w-3.5 h-3.5" />리셋
          </Button>
        </div>
      </div>

      {savedFlash && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md px-3 py-2 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>저장 완료. JPG/PDF 다운로드 또는 이미지 복사로 거래처에 전달할 수 있습니다.</span>
        </div>
      )}

      {coverOverflow && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>1쪽 내용이 A4를 넘습니다. 본문이나 비고를 줄여야 PDF의 사진 쪽이 어긋나지 않습니다.</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[460px_1fr] gap-4 items-start">
        <div className="space-y-3 min-w-0">
          <Card className="border-teal-200 bg-teal-50/40">
            <CardContent className="py-3">
              <input
                ref={quoteFileRef}
                type="file"
                accept=".json,.jpg,.jpeg,.png,.webp,application/json,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleImportQuote(f)
                  e.target.value = ''
                }}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button type="button" size="sm" variant="outline" onClick={() => quoteFileRef.current?.click()} disabled={ocrLoading} className="gap-1 min-h-11 sm:min-h-0">
                  {ocrLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                  {ocrLoading ? 'AI가 이미지 읽는 중...' : '견적서 불러오기 (.json/.jpg)'}
                </Button>
                <span className="text-[11px] text-slate-500">품목·수신처·견적일이 자동으로 채워집니다.</span>
              </div>
              {importNote && (
                <p className="mt-2 text-xs text-teal-700 flex items-center gap-1"><Check className="w-3 h-3 shrink-0" />{importNote}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                기본 정보
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  title="클릭하여 발행 이력 보기"
                  className="font-mono text-xs text-slate-500 font-normal inline-flex items-center gap-1 hover:text-blue-600 hover:underline cursor-pointer transition"
                >
                  <History className="w-3 h-3" />{docNumber || '...'}
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">수신 거래처</Label>
                <ClientCombobox clients={clients} value={form.recipientClientId} onChange={handleClientChange} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">수신 표시</Label>
                <Input
                  value={form.recipientName}
                  onChange={(e) => setForm((s) => ({ ...s, recipientName: e.target.value }))}
                  placeholder="○○인테리어 귀하"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">참조 <span className="text-slate-400 font-normal">(선택)</span></Label>
                <Input value={form.ccLine} onChange={(e) => setForm((s) => ({ ...s, ccLine: e.target.value }))} placeholder="담당자명 등" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">제목</Label>
                <Input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">발행일자 <span className="text-slate-400 font-normal">(비우면 오늘)</span></Label>
                  <Input type="date" value={form.issueDate} onChange={(e) => setForm((s) => ({ ...s, issueDate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">현장명 <span className="text-slate-400 font-normal">(선택)</span></Label>
                  <Input value={form.siteName} onChange={(e) => setForm((s) => ({ ...s, siteName: e.target.value }))} placeholder="○○호텔 커튼 교체" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">진행 결과</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">완료 내용</Label>
                <Input
                  value={form.resultLabel}
                  onChange={(e) => setForm((s) => ({ ...s, resultLabel: e.target.value }))}
                  placeholder="납품 및 디스플레이"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">견적일</Label>
                  <Input value={form.quoteDate} onChange={(e) => setForm((s) => ({ ...s, quoteDate: e.target.value }))} placeholder="2026년 11월 3일" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">완료일 <span className="text-slate-400 font-normal">(선택)</span></Label>
                  <Input type="date" value={form.completeDate} onChange={(e) => setForm((s) => ({ ...s, completeDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">단가 기준</Label>
                <div className="flex gap-1">
                  {([['excl', 'VAT 별도'], ['incl', 'VAT 포함']] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVatMode(v)}
                      className={`h-9 flex-1 text-sm font-semibold rounded-md border transition ${
                        vatMode === v
                          ? 'border-blue-400 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">비고 <span className="text-slate-400 font-normal">(표 아래 표시)</span></Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                  rows={4}
                  className="text-sm"
                  placeholder="※ 렌탈 집기 회수 일정 등"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                납품 품목
                <span className="text-xs font-normal text-slate-500 tabular-nums">
                  합계 <strong className="text-teal-700">{totals.grand.toLocaleString('ko-KR')}원</strong> (VAT 포함)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 overflow-x-auto">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-1 min-w-[400px]">
                  <span className="w-4 text-[10px] text-slate-400 text-right shrink-0">{i + 1}</span>
                  <Input className="h-8 text-xs flex-[2] min-w-0" value={it.name} placeholder="품목명" onChange={(e) => setItem(i, 'name', e.target.value)} />
                  <Input className="h-8 text-xs w-20 shrink-0" value={it.spec} placeholder="규격" onChange={(e) => setItem(i, 'spec', e.target.value)} />
                  <Input className="h-8 text-xs w-12 shrink-0 text-right" value={it.qty} placeholder="수량" inputMode="decimal" onChange={(e) => setItem(i, 'qty', e.target.value)} />
                  <Input className="h-8 text-xs w-10 shrink-0" value={it.unit} placeholder="단위" onChange={(e) => setItem(i, 'unit', e.target.value)} />
                  <Input className="h-8 text-xs w-20 shrink-0 text-right" value={it.price} placeholder="단가" inputMode="numeric" onChange={(e) => setItem(i, 'price', e.target.value)} />
                  <button type="button" onClick={() => removeItem(i)} className="shrink-0 h-11 w-11 sm:h-8 sm:w-8 inline-flex items-center justify-center text-slate-300 hover:text-red-500" title="행 삭제">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full gap-1 mt-1 min-h-11 sm:min-h-0">
                <Plus className="w-3.5 h-3.5" /> 품목 추가
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                현장 사진
                <span className="text-xs font-normal text-slate-500">한 쪽에 3장 · 정사각형으로 잘립니다</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <input
                ref={photoFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length) handleAddPhotos(files)
                  e.target.value = ''
                }}
              />
              {photos.map((p, i) => (
                <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 rounded-md border border-slate-200 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.title || `사진 ${i + 1}`} className="w-20 h-20 rounded object-cover shrink-0" />
                  <div className="order-last sm:order-none w-full sm:w-auto sm:flex-1 min-w-0 space-y-1">
                    <Input className="h-8 text-xs" value={p.title} placeholder={`사진 ${i + 1} 제목`} onChange={(e) => setPhoto(i, 'title', e.target.value)} />
                    <Textarea
                      className="text-xs min-h-[64px]"
                      rows={3}
                      value={p.detail}
                      placeholder={'품목 : 복주머니 140ea\n연출 : 종류별 진열'}
                      onChange={(e) => setPhoto(i, 'detail', e.target.value)}
                    />
                  </div>
                  <div className="flex sm:flex-col shrink-0 ml-auto sm:ml-0">
                    <button type="button" onClick={() => movePhoto(i, -1)} disabled={i === 0} className="h-11 w-11 sm:h-8 sm:w-8 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30" title="위로">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => movePhoto(i, 1)} disabled={i === photos.length - 1} className="h-11 w-11 sm:h-8 sm:w-8 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30" title="아래로">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => removePhoto(i)} className="h-11 w-11 sm:h-8 sm:w-8 inline-flex items-center justify-center text-slate-300 hover:text-red-500" title="사진 삭제">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => photoFileRef.current?.click()} disabled={photoLoading} className="w-full gap-1 min-h-11 sm:min-h-0">
                {photoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                {photoLoading ? '사진 처리 중...' : '사진 추가'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                본문
                {bodyEdited && (
                  <button
                    type="button"
                    onClick={() => setBodyEdited(false)}
                    className="text-[11px] font-normal text-slate-500 hover:text-blue-600 underline"
                    title="현장명·견적일·완료일로 본문을 다시 자동 작성"
                  >
                    자동 작성으로 되돌리기
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.bodyText}
                onChange={(e) => { setBodyEdited(true); setForm((s) => ({ ...s, bodyText: e.target.value })) }}
                rows={10}
                className="font-mono text-sm leading-relaxed"
              />
            </CardContent>
          </Card>
        </div>

        <div className="bg-slate-100 rounded-xl p-4 overflow-auto max-h-[calc(100vh-130px)]">
          <div className="origin-top-left scale-[0.86] lg:scale-[0.92] xl:scale-100 w-[794px] mx-auto shadow-xl">
            <ResultReportDocument
              header={{
                documentNumber: docNumber || 'YYYYMMDD01',
                recipient: form.recipientName || '○○○ 귀하',
                ccLine: form.ccLine || undefined,
                sender: senderLine,
                title: form.title,
                issueDate: formatIssueDate(form.issueDate),
              }}
              body={form.bodyText}
              bodyLineHeight={1.7}
              items={filteredItems}
              vatMode={vatMode}
              resultLabel={form.resultLabel.trim() || '납품'}
              notes={form.notes}
              photos={photos}
              footer={{
                name: profile?.name || '회사명을 설정에서 입력하세요',
                representative: profile?.representative,
                businessNumber: profile?.businessNumber,
                address: profile?.address,
                phone: profile?.phone,
                fax: profile?.fax,
                email: profile?.email,
                website: profile?.website,
                logoPath: profile?.logoPath,
                sealPath: profile?.sealPath,
              }}
            />
          </div>
        </div>
      </div>

      <DocumentHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        currentDocumentNumber={docNumber}
        onReuse={(doc) => {
          if (doc.type === DOC_TYPE) router.push(`/documents/new/result-report?from=${doc.id}`)
          else alert('결과보고서만 다시 사용할 수 있습니다.')
        }}
      />
    </div>
  )
}
