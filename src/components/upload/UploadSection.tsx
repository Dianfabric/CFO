'use client'

import { useRef, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Upload, FileSpreadsheet, FileText, CheckCircle, XCircle,
  Loader2, RefreshCw, Ship, X,
} from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { detectUploadKind } from '@/lib/upload-kind'
import LedgerSyncDialog from './LedgerSyncDialog'

type FileStatus = 'pending' | 'processing' | 'success' | 'error'

interface FileItem {
  id: string
  file: File
  status: FileStatus
  label: string
  message: string
  detail?: string
}

function fileIcon(name: string) {
  if (/\.xlsx?$/i.test(name)) return <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
  return <FileText className="w-4 h-4 text-blue-600 shrink-0" />
}

function docTypeLabel(type: string): string {
  const map: Record<string, string> = {
    import_tax: '수입세금계산서',
    glogi_freight: '글로지텍 운임',
    customs: '관세 청구서',
    freight: '로드썬 운임',
    sales: '일계표',
  }
  return map[type] ?? type
}

function formatPurchaseResult(json: Record<string, unknown>): { message: string; detail?: string } {
  const type = json.type as string
  if (type === 'sales_person') {
    const unm = (json.unmatchedMagamCount as number) ?? 0
    return {
      message: `담당자 마감 적용 완료 (${json.fileDate ?? ''})`,
      detail: `담당자 채워진 거래 ${json.personUpdated}건 | 메타(직군/제품) ${json.itemTagged}개${unm > 0 ? ` | ⚠️ 마감 행 미매칭 ${unm}건` : ''}`,
    }
  }
  if (type === 'customs') {
    return {
      message: `관세 청구서 등록 완료 (${json.date ?? ''})`,
      detail: `청구금액 ${formatKRW((json.totalBilled as number) ?? 0)}${json.blNo ? ` | B/L: ${json.blNo}` : ''}`,
    }
  }
  if (type === 'freight') {
    return {
      message: `로드썬 운임 등록 완료 (${json.date ?? ''})`,
      detail: `총 운임 ${formatKRW((json.totalAmount as number) ?? 0)}`,
    }
  }
  if (type === 'glogi_freight') {
    return {
      message: `글로지텍 운임 등록 완료 (${json.date ?? ''})`,
      detail: `청구금액 ${formatKRW((json.totalAmount as number) ?? 0)}${json.blNo ? ` | B/L: ${json.blNo}` : ''}`,
    }
  }
  if (type === 'import_tax') {
    return {
      message: `수입세금계산서 등록 완료 (${json.date ?? ''})`,
      detail: `세액 ${formatKRW((json.totalAmount as number) ?? 0)}`,
    }
  }
  if (type === 'tax_invoice') {
    return {
      message: `매출 세금계산서 ${(json.created as number) ?? 0}건 등록`,
      detail: `매칭 ${(json.matched as number) ?? 0}건 | 미매칭 ${(json.unmatched as number) ?? 0}건 | 중복 ${(json.duplicate as number) ?? 0}건 | 총 ${formatKRW((json.totalAmount as number) ?? 0)}`,
    }
  }
  if (type === 'loan_payments') {
    const lenders = (json.lenders as string[] | undefined)?.join('·') ?? ''
    return {
      message: `대출 상환내역 ${(json.created as number) ?? 0}건 흡수 (${json.year}년 ${json.entity === 'naid' ? '법인' : '디안'})`,
      detail: `${lenders} | 이자 ${formatKRW((json.totalInterest as number) ?? 0)} · 원금 ${formatKRW((json.totalPrincipal as number) ?? 0)} | 확인필요 ${json.needsReview}건 | 중복 ${json.duplicate}건`,
    }
  }
  if (type === 'mgmt_ledger') {
    const months = (json.months as string[] | undefined)?.join(', ') ?? ''
    return {
      message: `관리회계 ${(json.created as number) ?? 0}건 흡수 (${months})`,
      detail: `카드 ${json.card}건 | 통장 ${json.bank}건 | 개인 ${json.personal}건 | 중복 스킵 ${json.duplicate}건 — 비용 인텔리전스에 반영`,
    }
  }
  if (type === 'purchase_tax_invoice') {
    return {
      message: `매입 세금계산서 ${(json.created as number) ?? 0}건 등록`,
      detail: `매칭 ${(json.matched as number) ?? 0}건 | 미매칭 ${(json.unmatched as number) ?? 0}건 | 중복 ${(json.duplicate as number) ?? 0}건 | 총 ${formatKRW((json.totalAmount as number) ?? 0)}`,
    }
  }
  if (type === 'bank') {
    return {
      message: `통장내역 ${(json.created as number) ?? 0}건 등록`,
      detail: `입금 ${formatKRW((json.totalIn as number) ?? 0)} / 출금 ${formatKRW((json.totalOut as number) ?? 0)} | 거래처 매칭 ${(json.matchedClient as number) ?? 0}건 | 입금 매칭 ${(json.matchedPay as number) ?? 0}건 | 중복 ${(json.duplicate as number) ?? 0}건`,
    }
  }
  // 일계표
  if (json.sheetsTotal !== undefined || json.processedDays !== undefined) {
    const skippedMsg = (json.skippedDays as number) > 0 ? ` (${json.skippedDays}일 중복 스킵)` : ''
    const unmatched = json.unmatchedProducts as string[] | undefined
    const unmatchedMsg = unmatched && unmatched.length > 0
      ? ` | ⚠️ 원가 미매칭 ${unmatched.length}건: ${unmatched.slice(0, 3).join(', ')}${unmatched.length > 3 ? ` 외 ${unmatched.length - 3}건` : ''}`
      : ''
    const depCount = (json.depositCount as number) ?? 0
    const depTotal = (json.totalDeposits as number) ?? 0
    const depMsg = depCount > 0 ? ` | 💰 입금 ${depCount}건 ${formatKRW(depTotal)}` : ''
    return {
      message: `${json.processedDays}일치 업로드 완료${skippedMsg}`,
      detail: `매출 ${formatKRW((json.totalSales as number) ?? 0)} | 경비 ${formatKRW((json.totalExpenses as number) ?? 0)} | 매입 ${formatKRW((json.totalPurchases as number) ?? 0)}${depMsg}${unmatchedMsg}`,
    }
  }
  return { message: '등록 완료' }
}

async function processFile(item: FileItem): Promise<{ message: string; detail?: string }> {
  const form = new FormData()
  const name = item.file.name
  const isExcel = /\.xlsx?$/i.test(name)
  const isMagam = /디안[_ ]?마감|디안마감/i.test(name)
  const isTaxInvoice = /세금계산서/.test(name)
  const isBank = /통장|거래내역조회/.test(name)
  const isMgmt = /관리\s*회계/.test(name)
  const isLoan = /대출.*(상환|이자)|이자상환/.test(name)
  const isArSnapshot = /미수\s*(금)?\s*현황/.test(name)
  // 파일 종류 자동 라우팅:
  // - 세금계산서 → /api/upload/tax-invoice
  // - 통장내역 → /api/upload/bank
  // - "디안_마감_*.xlsx" → 담당자 마감 엑셀
  // - 다른 .xls/.xlsx → 일계표
  // - .pdf 등 → 매입 PDF
  const endpoint = isArSnapshot ? '/api/upload/ar-snapshot'
    : isLoan ? '/api/upload/loan-payments'
    : isMgmt ? '/api/upload/mgmt-accounting'
    : isTaxInvoice ? '/api/upload/tax-invoice'
    : isBank ? '/api/upload/bank'
    : isMagam ? '/api/upload/sales-person'
    : isExcel ? '/api/upload/sales'
    : '/api/upload/purchase'
  form.append('file', item.file)

  const res = await fetch(endpoint, { method: 'POST', body: form })
  const json = await res.json()

  if (!res.ok) throw new Error(json.error ?? '처리 오류')
  // 업로드 당번판 자동 체크 (실패해도 무시 — 부가 기능)
  fetch('/api/upload-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: detectUploadKind(name), fileName: name }),
  }).catch(() => {})
  if (isArSnapshot && json.sheets) {
    const s = (json.sheets as { monthKey: string; rows: number; balanceSum: number }[])
      .map((x) => `${x.monthKey} ${x.rows}곳 잔액 ${formatKRW(x.balanceSum)}`).join(' · ')
    const cc = json.crossCheck as { mismatchCount: number; mismatchSum: number } | undefined
    return {
      message: `미수 현황 저장: ${s}`,
      detail: cc ? `시스템과 차이 ${cc.mismatchCount}곳 (합계 ${formatKRW(cc.mismatchSum)}) — 자세한 목록은 Claude에게 요청` : undefined,
    }
  }
  return formatPurchaseResult(json as Record<string, unknown>)
}

function RecalculateButton({ onSuccess }: { onSuccess?: () => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const [detail, setDetail] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)

  const handleRecalculate = async () => {
    if (!confirm(`${startDate} ~ ${endDate} 기간의 원가를 Google Sheets 현재 가격으로 재계산합니다.\n기존 원가 데이터는 삭제됩니다. 계속하시겠습니까?`)) return
    setState('loading'); setMsg(''); setDetail('')
    try {
      const res = await fetch('/api/upload/sales/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      })
      const json = await res.json()
      if (!res.ok) { setState('error'); setMsg(json.error ?? '오류'); return }
      setState('success')
      setMsg(`재계산 완료 | 환율 ${json.usdRate?.toLocaleString()}원/USD | ${json.recalculatedCount}건`)
      setDetail(`신규 원가 ${formatKRW(json.totalNewCost)} (기존 ${formatKRW(json.totalOldCost)} → 차이 ${formatKRW(json.totalNewCost - json.totalOldCost)})`)
      onSuccess?.()
    } catch { setState('error'); setMsg('네트워크 오류') }
  }

  return (
    <div className="border-t pt-3 mt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <RefreshCw className="w-4 h-4 text-purple-600 shrink-0" />
        <span className="text-sm font-medium text-slate-700">원가 재계산</span>
        <div className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
          <span>시작</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="text-xs border rounded px-2 py-1 w-32" />
          <span>종료</span>
          <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
            className="text-xs border rounded px-2 py-1 w-32" />
          <Button variant="outline" size="sm" className="gap-1 h-7" disabled={state === 'loading'} onClick={handleRecalculate}>
            {state === 'loading' ? <><Loader2 className="w-3 h-3 animate-spin" />재계산 중</> : <><RefreshCw className="w-3 h-3" />원가 재계산</>}
          </Button>
        </div>
      </div>
      {state === 'success' && (
        <div className="mt-2 text-xs text-green-700 bg-green-50 rounded p-2 flex items-start gap-1">
          <CheckCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <div><div className="font-medium">{msg}</div>{detail && <div className="text-green-600">{detail}</div>}</div>
        </div>
      )}
      {state === 'error' && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 rounded p-2 flex items-start gap-1">
          <XCircle className="w-3 h-3 mt-0.5 shrink-0" />{msg}
        </div>
      )}
    </div>
  )
}

export default function UploadSection({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [syncFile, setSyncFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(async (newFiles: File[]) => {
    // 일계표 파일은 sync 다이얼로그로 분리 (한 번에 하나만)
    const ledgerFile = newFiles.find(f => /일계표/.test(f.name))
    const otherFiles = newFiles.filter(f => !/일계표/.test(f.name))

    if (ledgerFile) {
      setSyncFile(ledgerFile)  // 다이얼로그 트리거
    }

    if (otherFiles.length === 0) return

    const items: FileItem[] = otherFiles.map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      status: 'pending' as FileStatus,
      label: f.name,
      message: '',
    }))
    setFiles(prev => [...prev, ...items])

    for (const item of items) {
      setFiles(prev => prev.map(it => it.id === item.id ? { ...it, status: 'processing' } : it))
      try {
        const result = await processFile(item)
        setFiles(prev => prev.map(it =>
          it.id === item.id ? { ...it, status: 'success', message: result.message, detail: result.detail } : it,
        ))
        onUploadSuccess?.()
      } catch (err) {
        const msg = err instanceof Error ? err.message : '오류 발생'
        setFiles(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error', message: msg } : it))
      }
    }
  }, [onUploadSuccess])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    addFiles(Array.from(e.dataTransfer.files).filter(f => /\.(pdf|xls|xlsx)$/i.test(f.name)))
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  const removeFile = (id: string) => setFiles(prev => prev.filter(it => it.id !== id))

  const activeCount = files.filter(f => f.status === 'processing').length

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Upload className="w-4 h-4 text-blue-600" />
          일일 마감 업로드
          <span className="text-xs font-normal text-slate-400 ml-1">
            일계표 · 디안 마감 · 통장 · 세금계산서(매출/매입 자동 구분) · 관세 · 운임 — 어떤 파일이든 드래그
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 드래그앤드롭 영역 */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input ref={inputRef} type="file" accept=".pdf,.xls,.xlsx" multiple className="hidden" onChange={onInputChange} />
          <div className="flex items-center justify-center gap-3 text-slate-400">
            <Ship className="w-5 h-5" />
            <FileText className="w-5 h-5" />
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <p className="text-sm text-slate-500 mt-2">
            {activeCount > 0 ? `${activeCount}개 처리 중...` : '파일을 끌어다 놓거나 클릭해서 선택'}
          </p>
          <p className="text-xs text-slate-400 mt-1">PDF · XLS · XLSX · 여러 파일 동시 업로드 가능</p>
        </div>

        {/* 파일 결과 목록 */}
        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map(item => (
              <div key={item.id} className={`flex items-start gap-2 rounded-lg p-2.5 text-sm
                ${item.status === 'success' ? 'bg-green-50' : item.status === 'error' ? 'bg-red-50' : 'bg-slate-50'}`}>
                <div className="mt-0.5">{fileIcon(item.file.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {item.status === 'processing' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />}
                    {item.status === 'success' && <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                    {item.status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <span className={`font-medium truncate ${item.status === 'error' ? 'text-red-700' : 'text-slate-700'}`}>
                      {item.status === 'processing' ? `분석 중… (${item.file.name})` : item.message || item.file.name}
                    </span>
                  </div>
                  {item.detail && <div className="text-xs text-slate-500 mt-0.5 ml-5">{item.detail}</div>}
                  {item.status === 'error' && (
                    <div className="text-xs text-slate-400 mt-0.5 ml-5 truncate">{item.file.name}</div>
                  )}
                </div>
                {item.status !== 'processing' && (
                  <button onClick={() => removeFile(item.id)} className="text-slate-300 hover:text-slate-500 mt-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 원가 재계산 */}
        <RecalculateButton onSuccess={onUploadSuccess} />
      </CardContent>

      {/* 일계표 동기화 다이얼로그 */}
      <LedgerSyncDialog
        file={syncFile}
        open={!!syncFile}
        onClose={() => setSyncFile(null)}
        onComplete={() => onUploadSuccess?.()}
      />
    </Card>
  )
}
