'use client'

import { useRef, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Upload, FileSpreadsheet, FileText, CheckCircle, XCircle,
  Loader2, RefreshCw, Ship, X,
} from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

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
  // 일계표
  if (json.sheetsTotal !== undefined || json.processedDays !== undefined) {
    const skippedMsg = (json.skippedDays as number) > 0 ? ` (${json.skippedDays}일 중복 스킵)` : ''
    return {
      message: `${json.processedDays}일치 업로드 완료${skippedMsg}`,
      detail: `매출 ${formatKRW((json.totalSales as number) ?? 0)} | 경비 ${formatKRW((json.totalExpenses as number) ?? 0)} | 매입 ${formatKRW((json.totalPurchases as number) ?? 0)}`,
    }
  }
  return { message: '등록 완료' }
}

async function processFile(item: FileItem): Promise<{ message: string; detail?: string }> {
  const form = new FormData()
  const isExcel = /\.xlsx?$/i.test(item.file.name)
  const endpoint = isExcel ? '/api/upload/sales' : '/api/upload/purchase'
  form.append('file', item.file)

  const res = await fetch(endpoint, { method: 'POST', body: form })
  const json = await res.json()

  if (!res.ok) throw new Error(json.error ?? '처리 오류')
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
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(async (newFiles: File[]) => {
    const items: FileItem[] = newFiles.map(f => ({
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
            일계표(.xls) · 관세청구서 · 로드썬 · 글로지텍 · 수입세금계산서 — 어떤 파일이든 드래그하세요
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
    </Card>
  )
}
