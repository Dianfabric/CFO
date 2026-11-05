'use client'

/**
 * 대금 청구서 작성 (대표 지시 2026-11-05)
 *
 * 견적서 생성기에서 저장한 .json 파일을 불러와 대금 청구서 양식으로 변환.
 * 납품 또는 설치 완료 후 대금을 청구하는 공문 — DocumentLayout(직인 포함) 재사용.
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
  ArrowLeft,
  Check,
  CloudUpload,
  Copy,
  FileDown,
  FileUp,
  History,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Save,
  Wallet,
  X,
} from 'lucide-react'
import DocumentLayout from '@/components/documents/DocumentLayout'
import ClientCombobox, { ClientOption } from '@/components/documents/ClientCombobox'
import DocumentHistoryDialog from '@/components/documents/DocumentHistoryDialog'
import PaymentRequestTable, {
  PaymentItem,
  VatMode,
  paymentTotals,
} from '@/components/documents/PaymentRequestTable'
import { downloadPDF, downloadJPG, getCanvasBlob, getPDFBlob, copyImageToClipboard } from '@/lib/document-export'
import { buildMessengerText, copyToClipboard } from '@/lib/document-text'
import { useGoogleDrive } from '@/hooks/useGoogleDrive'
import { getOrCreateFolder, uploadToDrive } from '@/lib/google-drive'

const ROOT_FOLDER_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID ?? ''
const DOC_TYPE = 'PAYMENT_REQUEST'
const DEFAULT_BANK = '기업은행 02-6447-1221 (예금주 : 한태원 디안)'

type CompleteKind = '납품' | '설치'

interface FormState {
  recipientClientId: string
  recipientName: string
  ccLine: string
  title: string
  issueDate: string
  siteName: string
  completeKind: CompleteKind
  completeDate: string
  dueDate: string
  bankLine: string
  bodyText: string
}

const EMPTY_ITEM: PaymentItem = { name: '', color: '', spec: '', qty: '', unit: 'Y', price: '', remark: '' }

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일' */
function koreanDate(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ymd
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`
}

function buildBody(s: Pick<FormState, 'siteName' | 'completeKind' | 'completeDate' | 'dueDate' | 'bankLine'>): string {
  const josa = s.completeKind === '납품' ? '이' : '가'
  const site = s.siteName.trim() ? `「${s.siteName.trim()}」 현장에 대한 ` : '귀사에 요청하신 건의 '
  const when = s.completeDate ? `${koreanDate(s.completeDate)}부로 ` : ''
  const due = s.dueDate ? `${koreanDate(s.dueDate)}까지 ` : ''
  return `1. 귀사의 무궁한 발전을 기원합니다.

2. ${site}${s.completeKind}${josa} ${when}완료되었음을 알려드리며, 이에 따른 대금을 아래와 같이 청구하오니 확인 부탁드립니다.

3. 청구 내역은 하단 표와 같으며, ${due}아래 계좌로 입금하여 주시기 바랍니다.

   ■ 입금 계좌 : ${s.bankLine || DEFAULT_BANK}

4. 세금계산서 발행 등 필요하신 사항은 담당자에게 말씀해 주시기 바랍니다. 감사합니다.`
}

function formatIssueDate(value: string) {
  if (!value) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replace(/-/g, '. ') + '.'
  return value
}

function safeFilePart(value: string, fallback: string) {
  return (value || fallback).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '').trim() || fallback
}

const DEFAULT_FORM: FormState = {
  recipientClientId: '',
  recipientName: '',
  ccLine: '',
  title: '대금 청구의 건',
  issueDate: '',
  siteName: '',
  completeKind: '납품',
  completeDate: '',
  dueDate: '',
  bankLine: DEFAULT_BANK,
  bodyText: '',
}

export default function PaymentRequestForm() {
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
  const [importNote, setImportNote] = useState('')

  const [saving, setSaving] = useState(false)
  const [savePhase, setSavePhase] = useState<'' | 'db' | 'drive'>('')
  const [downloading, setDownloading] = useState<'' | 'pdf' | 'jpg'>('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [copyImgState, setCopyImgState] = useState<'idle' | 'copying' | 'done'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)

  const { getToken } = useGoogleDrive()

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients).catch(() => {})
    fetch('/api/company-profile').then(r => r.json()).then(setProfile).catch(() => {})
    fetch('/api/documents/next-number')
      .then(r => r.json()).then(j => setDocNumber(j.documentNumber || '')).catch(() => {})
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
          alert('대금 청구서가 아닙니다.')
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
          title: d.title || '대금 청구의 건',
          issueDate: '',
          siteName: (meta.siteName as string) || '',
          completeKind: ((meta.completeKind as CompleteKind) === '설치' ? '설치' : '납품'),
          completeDate: (meta.completeDate as string) || '',
          dueDate: (meta.dueDate as string) || '',
          bankLine: (meta.bankLine as string) || DEFAULT_BANK,
          bodyText: d.bodyText || '',
        })
        setBodyEdited(true) // 저장된 본문 그대로 유지
        if (savedItems.length) setItems(savedItems)
        if (meta.vatMode === 'incl' || meta.vatMode === 'excl') setVatMode(meta.vatMode)
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
  }, [form.siteName, form.completeKind, form.completeDate, form.dueDate, form.bankLine, bodyEdited])

  // 견적서 JSON 불러오기
  const handleImportQuote = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Record<string, unknown>
      const data = (parsed.data ?? parsed) as Record<string, unknown>
      const qItems = Array.isArray(data.items) ? (data.items as Partial<PaymentItem>[]) : []
      const mapped: PaymentItem[] = qItems
        .map((it) => ({
          name: String(it.name ?? ''),
          color: String(it.color ?? ''),
          spec: String(it.spec ?? ''),
          qty: String(it.qty ?? ''),
          unit: String(it.unit ?? 'Y'),
          price: String(it.price ?? ''),
          remark: String(it.remark ?? ''),
        }))
        .filter((it) => it.name.trim() || it.qty.trim() || it.price.trim())
      if (!mapped.length) {
        alert('견적서 품목을 찾지 못했습니다. 견적서 생성기에서 저장한 .json 파일인지 확인해주세요.')
        return
      }
      setItems(mapped)
      if (data.vatMode === 'incl' || data.vatMode === 'excl') setVatMode(data.vatMode as VatMode)
      const clientName = String(data.clientName ?? '').trim()
      const siteName = String(data.siteName ?? '').trim()
      setForm((s) => ({
        ...s,
        recipientName: clientName ? `${clientName} 귀하` : s.recipientName,
        siteName: siteName || s.siteName,
        title: '대금 청구의 건' + (siteName ? ` (${siteName})` : clientName ? ` (${clientName})` : ''),
      }))
      setImportNote(
        `견적서 불러옴: ${clientName || '(수신처 없음)'}${siteName ? ' / ' + siteName : ''} · 품목 ${mapped.length}건` +
          (data.quoteDate ? ` · 견적일 ${String(data.quoteDate)}` : ''),
      )
    } catch (e) {
      console.error('견적서 불러오기 실패:', e)
      alert('파일을 읽지 못했습니다. 견적서 생성기에서 드라이브에 저장된 .json 파일을 사용해주세요.')
    }
  }

  const handleClientChange = (id: string, client: ClientOption | null) => {
    setForm(s => ({
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

  const totals = useMemo(() => paymentTotals(items, vatMode), [items, vatMode])
  const senderLine = useMemo(() => profile?.name || '－', [profile])

  const filenameBase = useMemo(() => {
    const recipient = safeFilePart(
      form.recipientName.replace(/\s*귀하\s*$/, '').split(/\s*\/\s*/)[0],
      '거래처',
    )
    return `${docNumber}_대금청구서_${recipient}`
  }, [docNumber, form.recipientName])

  const handleDownloadPDF = async () => {
    setDownloading('pdf')
    try {
      await downloadPDF(filenameBase)
    } catch (e) {
      console.error('[PDF 생성 실패]', e)
      alert('PDF 생성 실패\n' + (e instanceof Error ? e.name + ': ' + e.message : String(e)))
    }
    setDownloading('')
  }

  const handleDownloadJPG = async () => {
    setDownloading('jpg')
    try {
      await downloadJPG(filenameBase)
    } catch (e) {
      console.error('[JPG 생성 실패]', e)
      alert('JPG 생성 실패\n' + (e instanceof Error ? e.name + ': ' + e.message : String(e)))
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
      const msg =
        result.reason === 'unsupported' ? '이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다.' :
        result.reason === 'permission' ? '복사 권한이 거부되었습니다. 페이지를 클릭한 후 다시 시도해주세요.' :
        '이미지 복사 실패' + (result.error ? '\n' + result.error : '')
      alert(msg)
    }
  }

  const handleCopyText = async () => {
    const totalLine = `\n■ 청구금액 : ${totals.grand.toLocaleString('ko-KR')}원 (VAT 포함)`
    const ok = await copyToClipboard(buildMessengerText({
      documentNumber: docNumber,
      title: form.title,
      recipientName: form.recipientName || '거래처 귀하',
      ccLine: form.ccLine || undefined,
      senderLine,
      bodyText: form.bodyText + totalLine,
      issueDate: form.issueDate || undefined,
      contact: {
        phone: profile?.phone,
        email: profile?.email,
        website: profile?.website,
      },
    }))
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } else {
      alert('복사에 실패했습니다. 브라우저 권한을 확인해주세요.')
    }
  }

  const handleSave = async () => {
    if (!form.recipientName.trim()) { alert('수신 정보를 입력해주세요.'); return }
    if (!form.title.trim()) { alert('제목을 입력해주세요.'); return }
    if (totals.grand <= 0) { alert('청구 품목을 입력하거나 견적서를 불러와주세요.'); return }
    setSaving(true)
    setSavePhase('db')
    let savedId: string | null = null
    try {
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
          tableJson: items.filter((it) => it.name.trim() || it.qty.trim() || it.price.trim()),
          metaJson: {
            issueDate: form.issueDate,
            siteName: form.siteName,
            completeKind: form.completeKind,
            completeDate: form.completeDate,
            dueDate: form.dueDate,
            bankLine: form.bankLine,
            vatMode,
            supply: totals.supply,
            vat: totals.vat,
            grand: totals.grand,
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
      const saved = await res.json()
      savedId = saved.id
    } catch {
      alert('저장 실패')
      setSaving(false); setSavePhase('')
      return
    }

    if (ROOT_FOLDER_ID && savedId) {
      setSavePhase('drive')
      try {
        const token = await getToken()
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
      const r = await fetch('/api/documents/next-number')
      const j = await r.json()
      if (j.documentNumber) setDocNumber(j.documentNumber)
    } catch {}
  }

  const handleReset = async () => {
    if (!confirm('작성한 내용을 모두 초기화할까요?\n저장된 공문은 영향받지 않습니다.')) return
    setForm({ ...DEFAULT_FORM, bodyText: buildBody(DEFAULT_FORM) })
    setBodyEdited(false)
    setItems([{ ...EMPTY_ITEM }])
    setVatMode('excl')
    setImportNote('')
    setSavedFlash(false)
    try {
      const r = await fetch('/api/documents/next-number')
      const j = await r.json()
      if (j.documentNumber) setDocNumber(j.documentNumber)
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/documents" className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> 공문 목록
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mt-1">
            <Wallet className="w-6 h-6 text-blue-600" />
            대금 청구서 작성
          </h1>
          <p className="text-sm text-slate-500">견적서로 저장한 파일을 불러와, 납품·설치 완료 후 대금을 청구하는 공문으로 변환합니다.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadJPG} disabled={!!downloading} className="gap-1">
            <ImageIcon className="w-3.5 h-3.5" />{downloading === 'jpg' ? '생성 중...' : 'JPG'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={!!downloading} className="gap-1">
            <FileDown className="w-3.5 h-3.5" />{downloading === 'pdf' ? '생성 중...' : 'PDF'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyImage} disabled={copyImgState !== 'idle'} className="gap-1">
            {copyImgState === 'done' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copyImgState === 'copying' ? '복사 중...' : copyImgState === 'done' ? '복사됨!' : '이미지 복사'}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1" title="DB + 구글 드라이브에 저장">
            {savePhase === 'drive' ? <CloudUpload className="w-3.5 h-3.5 animate-pulse" /> : <Save className="w-3.5 h-3.5" />}
            {savePhase === 'db' ? 'DB 저장 중...' : savePhase === 'drive' ? '드라이브 저장 중...' : savedFlash ? '저장됨 ✓' : '발행 및 저장'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} disabled={saving} className="gap-1">
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

      <div className="grid grid-cols-1 xl:grid-cols-[460px_1fr] gap-4 items-start">
        <div className="space-y-3">
          {/* 견적서 불러오기 */}
          <Card className="border-indigo-200 bg-indigo-50/40">
            <CardContent className="py-3">
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleImportQuote(f)
                  e.target.value = ''
                }}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                  <FileUp className="w-3.5 h-3.5" /> 견적서 파일(.json) 불러오기
                </Button>
                <span className="text-[11px] text-slate-500">
                  견적서 생성기 → 드라이브 연동 저장 시 만들어지는 .json — 품목·수신처·현장명이 자동으로 채워집니다.
                </span>
              </div>
              {importNote && (
                <p className="mt-2 text-xs text-indigo-700 flex items-center gap-1"><Check className="w-3 h-3" />{importNote}</p>
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
                  onChange={e => setForm(s => ({ ...s, recipientName: e.target.value }))}
                  placeholder="○○인테리어 귀하"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">참조 <span className="text-slate-400 font-normal">(선택)</span></Label>
                <Input value={form.ccLine} onChange={e => setForm(s => ({ ...s, ccLine: e.target.value }))} placeholder="담당자명 등" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">제목</Label>
                <Input value={form.title} onChange={e => setForm(s => ({ ...s, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block flex items-center justify-between">
                    <span>발행일자 <span className="text-slate-400 font-normal">(비우면 오늘)</span></span>
                  </Label>
                  <Input type="date" value={form.issueDate} onChange={e => setForm(s => ({ ...s, issueDate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">현장명</Label>
                  <Input value={form.siteName} onChange={e => setForm(s => ({ ...s, siteName: e.target.value }))} placeholder="○○호텔 커튼 교체" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">청구 조건</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">완료 구분</Label>
                  <div className="flex gap-1">
                    {(['납품', '설치'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setForm(s => ({ ...s, completeKind: k }))}
                        className={`h-9 flex-1 text-sm font-semibold rounded-md border transition ${
                          form.completeKind === k
                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {k} 완료
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">완료일</Label>
                  <Input type="date" value={form.completeDate} onChange={e => setForm(s => ({ ...s, completeDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">지급 기한 <span className="text-slate-400 font-normal">(선택)</span></Label>
                  <Input type="date" value={form.dueDate} onChange={e => setForm(s => ({ ...s, dueDate: e.target.value }))} />
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
              </div>
              <div>
                <Label className="text-xs mb-1 block">입금 계좌</Label>
                <Input value={form.bankLine} onChange={e => setForm(s => ({ ...s, bankLine: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                청구 품목
                <span className="text-xs font-normal text-slate-500 tabular-nums">
                  청구금액 <strong className="text-blue-700">{totals.grand.toLocaleString('ko-KR')}원</strong> (VAT 포함)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="w-4 text-[10px] text-slate-400 text-right shrink-0">{i + 1}</span>
                  <Input className="h-8 text-xs flex-[2] min-w-0" value={it.name} placeholder="품목명" onChange={e => setItem(i, 'name', e.target.value)} />
                  <Input className="h-8 text-xs w-14 shrink-0" value={it.color} placeholder="색상" onChange={e => setItem(i, 'color', e.target.value)} />
                  <Input className="h-8 text-xs w-16 shrink-0" value={it.spec} placeholder="규격" onChange={e => setItem(i, 'spec', e.target.value)} />
                  <Input className="h-8 text-xs w-14 shrink-0 text-right" value={it.qty} placeholder="수량" inputMode="decimal" onChange={e => setItem(i, 'qty', e.target.value)} />
                  <Input className="h-8 text-xs w-11 shrink-0" value={it.unit} placeholder="단위" onChange={e => setItem(i, 'unit', e.target.value)} />
                  <Input className="h-8 text-xs w-20 shrink-0 text-right" value={it.price} placeholder="단가" inputMode="numeric" onChange={e => setItem(i, 'price', e.target.value)} />
                  <Input className="h-8 text-xs w-16 shrink-0" value={it.remark} placeholder="비고" onChange={e => setItem(i, 'remark', e.target.value)} />
                  <button type="button" onClick={() => removeItem(i)} className="shrink-0 text-slate-300 hover:text-red-500 p-1" title="행 삭제">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full gap-1 mt-1">
                <Plus className="w-3.5 h-3.5" /> 품목 추가
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                본문
                <span className="flex items-center gap-2">
                  {bodyEdited && (
                    <button
                      type="button"
                      onClick={() => setBodyEdited(false)}
                      className="text-[11px] text-slate-500 hover:text-blue-600 underline"
                      title="현장명·완료일·계좌로 본문을 다시 자동 작성"
                    >
                      자동 작성으로 되돌리기
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyText}
                    title="공문 내용을 메신저용 텍스트로 복사"
                    className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border transition ${
                      copied ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    {copied ? <><Check className="w-3 h-3" />복사됨</> : <><Copy className="w-3 h-3" />텍스트 복사</>}
                  </button>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.bodyText}
                onChange={e => { setBodyEdited(true); setForm(s => ({ ...s, bodyText: e.target.value })) }}
                rows={12}
                className="font-mono text-sm leading-relaxed"
              />
              {!bodyEdited && (
                <p className="text-[11px] text-slate-400 mt-1">현장명·완료 구분·완료일·지급 기한·계좌를 바꾸면 본문이 자동으로 갱신됩니다. 직접 수정하면 자동 갱신이 멈춥니다.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="bg-slate-100 rounded-xl p-4 overflow-auto max-h-[calc(100vh-130px)]">
          <div className="origin-top-left scale-[0.86] lg:scale-[0.92] xl:scale-100 w-[794px] mx-auto shadow-xl">
            <DocumentLayout
              header={{
                documentNumber: docNumber || 'YYYYMMDD01',
                recipient: form.recipientName || '○○○ 귀하',
                ccLine: form.ccLine || undefined,
                sender: senderLine,
                title: form.title,
                issueDate: formatIssueDate(form.issueDate),
              }}
              body={form.bodyText}
              bodyLineHeight={1.75}
              table={<PaymentRequestTable items={items} vatMode={vatMode} />}
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
          if (doc.type === DOC_TYPE) router.push(`/documents/new/payment-request?from=${doc.id}`)
          else alert('대금 청구서만 다시 사용할 수 있습니다.')
        }}
      />
    </div>
  )
}
