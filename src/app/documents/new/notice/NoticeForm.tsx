'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  CalendarOff,
  Check,
  CloudUpload,
  Copy,
  FileDown,
  History,
  Image as ImageIcon,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react'
import DocumentLayout from '@/components/documents/DocumentLayout'
import ClientCombobox, { ClientOption } from '@/components/documents/ClientCombobox'
import DocumentHistoryDialog from '@/components/documents/DocumentHistoryDialog'
import { downloadPDF, downloadJPG, getCanvasBlob, getPDFBlob, copyImageToClipboard } from '@/lib/document-export'
import { buildMessengerText, copyToClipboard } from '@/lib/document-text'
import { useGoogleDrive } from '@/hooks/useGoogleDrive'
import { getOrCreateFolder, uploadToDrive } from '@/lib/google-drive'

const ROOT_FOLDER_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID ?? ''

type NoticeType = 'HOLIDAY'

interface FormState {
  recipientClientId: string
  recipientName: string
  ccLine: string
  title: string
  issueDate: string
  bodyText: string
  aiKeywords: string
}

const DEFAULT_BODY = `1. 귀사의 무궁한 발전을 기원합니다.

2. 평소 저희 디안에 보내주시는 신뢰와 협조에 깊이 감사드립니다.

3. 당사의 휴무 일정을 아래와 같이 안내드립니다.

4. 휴무 기간 중에는 주문, 출고 및 상담 업무가 제한될 수 있습니다.

5. 업무 재개 후 순차적으로 빠르게 처리하겠습니다.

6. 업무에 참고 부탁드리며, 너른 양해를 부탁드립니다. 감사합니다.`

function formatIssueDate(value: string) {
  if (!value) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replace(/-/g, '. ') + '.'
  return value
}

function safeFilePart(value: string, fallback: string) {
  return (value || fallback).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '').trim() || fallback
}

export default function NoticeForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const fromId = sp.get('from')
  const noticeType: NoticeType = 'HOLIDAY'

  const [clients, setClients] = useState<ClientOption[]>([])
  const [profile, setProfile] = useState<Record<string, string> | null>(null)
  const [docNumber, setDocNumber] = useState('')
  const [form, setForm] = useState<FormState>({
    recipientClientId: '',
    recipientName: '거래처 제위',
    ccLine: '',
    title: '휴무 일정 안내의 건',
    issueDate: '',
    bodyText: DEFAULT_BODY,
    aiKeywords: '',
  })
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savePhase, setSavePhase] = useState<'' | 'db' | 'drive'>('')
  const [downloading, setDownloading] = useState<'' | 'pdf' | 'jpg'>('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [copyImgState, setCopyImgState] = useState<'idle' | 'copying' | 'done'>('idle')

  const { getToken } = useGoogleDrive()

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients).catch(() => {})
    fetch('/api/company-profile').then(r => r.json()).then(setProfile).catch(() => {})
    fetch('/api/documents/next-number')
      .then(r => r.json()).then(j => setDocNumber(j.documentNumber || '')).catch(() => {})
  }, [])

  useEffect(() => {
    if (!fromId) return
    let cancelled = false
    fetch(`/api/documents/${fromId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found'))))
      .then((d) => {
        if (cancelled || !d) return
        if (d.type !== noticeType) {
          alert('휴무/공지 공문이 아닙니다.')
          return
        }
        let meta: Record<string, unknown> = {}
        try { meta = d.metaJson ? JSON.parse(d.metaJson) : {} } catch {}
        setForm((s) => ({
          ...s,
          recipientClientId: d.recipientClientId || '',
          recipientName: d.recipientName || '',
          ccLine: d.ccLine || '',
          title: d.title || s.title,
          issueDate: '',
          bodyText: d.bodyText || s.bodyText,
          aiKeywords: (meta.aiKeywords as string) || '',
        }))
      })
      .catch((err) => {
        console.error('수정 생성 데이터 로드 실패:', err)
        alert('공문 데이터를 불러오지 못했습니다.')
      })
    return () => { cancelled = true }
  }, [fromId, noticeType])

  const handleClientChange = (id: string, client: ClientOption | null) => {
    setForm(s => ({
      ...s,
      recipientClientId: id,
      recipientName: client
        ? `${client.name}${client.contactName ? ' / ' + client.contactName : ''} 귀하`
        : '거래처 제위',
    }))
  }

  const senderLine = useMemo(() => profile?.name || '－', [profile])

  const filenameBase = useMemo(() => {
    const recipient = safeFilePart(
      form.recipientName.replace(/\s*귀하\s*$/, '').split(/\s*\/\s*/)[0],
      '거래처',
    )
    return `${docNumber}_휴무공지_${recipient}`
  }, [docNumber, form.recipientName])

  const handleAiDraft = async () => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/documents/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: noticeType,
          recipientName: form.recipientName,
          keywords: form.aiKeywords,
          currentBody: form.bodyText !== DEFAULT_BODY ? form.bodyText : '',
        }),
      })
      const json = await res.json()
      if (json.text) setForm(s => ({ ...s, bodyText: json.text }))
    } catch {}
    setAiLoading(false)
  }

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
    const ok = await copyToClipboard(buildMessengerText({
      documentNumber: docNumber,
      title: form.title,
      recipientName: form.recipientName || '거래처 제위',
      ccLine: form.ccLine || undefined,
      senderLine,
      bodyText: form.bodyText,
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
    setSaving(true)
    setSavePhase('db')
    let savedId: string | null = null
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: noticeType,
          title: form.title,
          recipientClientId: form.recipientClientId || null,
          recipientName: form.recipientName,
          ccLine: form.ccLine,
          senderLine,
          bodyText: form.bodyText,
          tableJson: null,
          metaJson: {
            issueDate: form.issueDate,
            aiKeywords: form.aiKeywords,
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
    setForm({
      recipientClientId: '',
      recipientName: '거래처 제위',
      ccLine: '',
      title: '휴무 일정 안내의 건',
      issueDate: '',
      bodyText: DEFAULT_BODY,
      aiKeywords: '',
    })
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
            <CalendarOff className="w-6 h-6 text-amber-600" />
            휴무/업체 공지 작성
          </h1>
          <p className="text-sm text-slate-500">휴가·배송·운영 변경처럼 업체에 전달할 공문을 빠르게 작성합니다.</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-[440px_1fr] gap-4 items-start">
        <div className="space-y-3">
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
                <p className="text-[11px] text-slate-400 mt-1">전체 업체 공지면 선택하지 않고 “거래처 제위”로 두면 됩니다.</p>
              </div>
              <div>
                <Label className="text-xs mb-1 block">수신 표시</Label>
                <Input
                  value={form.recipientName}
                  onChange={e => setForm(s => ({ ...s, recipientName: e.target.value }))}
                  placeholder="거래처 제위 / ○○인테리어 귀하"
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
              <div>
                <Label className="text-xs mb-1 block flex items-center justify-between">
                  <span>발행일자 <span className="text-slate-400 font-normal ml-1">(비우면 오늘)</span></span>
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
                </Label>
                <Input type="date" value={form.issueDate} onChange={e => setForm(s => ({ ...s, issueDate: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">AI 초안</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={form.aiKeywords}
                onChange={e => setForm(s => ({ ...s, aiKeywords: e.target.value }))}
                rows={3}
                placeholder="예: 8/1~8/4 여름휴가, 8/5부터 정상 업무, 긴급 건은 카카오톡 연락"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAiDraft} disabled={aiLoading} className="w-full gap-1">
                <Sparkles className="w-3.5 h-3.5" />{aiLoading ? '작성 중...' : '상황으로 본문 다시 쓰기'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">본문</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.bodyText}
                onChange={e => setForm(s => ({ ...s, bodyText: e.target.value }))}
                rows={16}
                className="font-mono text-sm leading-relaxed"
              />
            </CardContent>
          </Card>
        </div>

        <div className="bg-slate-100 rounded-xl p-4 overflow-auto max-h-[calc(100vh-130px)]">
          <div className="origin-top-left scale-[0.86] lg:scale-[0.92] xl:scale-100 w-[794px] mx-auto shadow-xl">
            <DocumentLayout
              header={{
                documentNumber: docNumber || 'YYYYMMDD01',
                recipient: form.recipientName || '거래처 제위',
                ccLine: form.ccLine || undefined,
                sender: senderLine,
                title: form.title,
                issueDate: formatIssueDate(form.issueDate),
              }}
              body={form.bodyText}
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
          if (doc.type === noticeType) router.push(`/documents/new/notice?from=${doc.id}`)
          else alert('휴무/공지 공문만 다시 사용할 수 있습니다.')
        }}
      />
    </div>
  )
}
