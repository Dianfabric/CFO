'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertTriangle, CheckCircle, Clock, Phone, User, UserPlus, Filter } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface ARItem {
  id: string; remainingAmount: number; originalAmount: number; status: string; createdAt: string
  transaction: {
    id: string; date: string; salesPerson: string | null; description?: string | null; taxStatus?: string | null
    items: { productName: string; quantity: number; unitPrice: number; amount: number }[]
    taxInvoices?: { id: string; totalAmount: number }[]
  }
  payments: { id: string; amount: number; paymentDate: string; paymentMethod: string; notes: string | null }[]
  transactionId: string
}

const isCorrectionSale = (desc?: string | null) =>
  !!desc && (desc.startsWith('이월 매출 보정') || desc.startsWith('이월 매출 -'))
const isCorrectionPay = (notes?: string | null) =>
  !!notes && (notes.startsWith('[수동 보정]') || notes.startsWith('[이월]'))

function MemoCell({ rowType, rowId, initial }: { rowType: string; rowId: string; initial: string }) {
  const [value, setValue] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  useEffect(() => { setValue(initial); setSaved(initial) }, [initial])
  const dirty = value !== saved
  const save = async () => {
    if (!dirty) return
    setState('saving')
    await fetch('/api/row-memo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowType, rowId, text: value }),
    })
    setSaved(value)
    setState('done')
    setTimeout(() => setState('idle'), 1500)
  }
  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save() }}
        placeholder="비고 입력…"
        className="flex-1 min-w-[24rem] text-sm border border-slate-200 rounded px-3 py-1.5 bg-white hover:border-slate-300 focus:border-blue-400 focus:outline-none"
      />
      <button
        onClick={save}
        disabled={!dirty || state === 'saving'}
        className={`text-[10px] px-2 py-1 rounded border transition-colors ${
          state === 'done'
            ? 'bg-green-50 border-green-300 text-green-700'
            : dirty
              ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
              : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
        }`}
      >
        {state === 'saving' ? '...' : state === 'done' ? '✓ 저장' : '저장'}
      </button>
    </div>
  )
}

function ClientNoteCell({
  clientId, initial, onSaved,
}: { clientId: string; initial: string | null; onSaved: (text: string) => void }) {
  const [value, setValue] = useState(initial ?? '')
  const [saved, setSaved] = useState(initial ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  useEffect(() => { setValue(initial ?? ''); setSaved(initial ?? '') }, [initial])
  const dirty = value !== saved
  const save = async () => {
    if (!dirty) return
    setState('saving')
    try {
      await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value || null }),
      })
      setSaved(value)
      setState('done')
      onSaved(value)
      setTimeout(() => setState('idle'), 1500)
    } catch {
      setState('idle')
    }
  }
  return (
    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save() }}
        placeholder="거래처 비고 (회수 약속/연락사항 등)"
        className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white hover:border-slate-400 focus:border-blue-400 focus:outline-none"
      />
      <button
        onClick={save}
        disabled={!dirty || state === 'saving'}
        className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
          state === 'done'
            ? 'bg-green-50 border-green-300 text-green-700'
            : dirty
              ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
              : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
        }`}
      >
        {state === 'saving' ? '...' : state === 'done' ? '✓ 저장' : '저장'}
      </button>
    </div>
  )
}

function TaxStatusSelect({
  transactionId, initial, matched, onChanged,
}: { transactionId: string; initial: string | null | undefined; matched: boolean; onChanged: () => void }) {
  // 자동 매칭된 세금계산서가 있으면 기본은 ISSUED, 사용자 오버라이드가 있으면 그 값 사용
  const effective = initial ?? (matched ? 'ISSUED' : 'PENDING')
  const [value, setValue] = useState(effective)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setValue(initial ?? (matched ? 'ISSUED' : 'PENDING')) }, [initial, matched])

  const handle = async (next: string) => {
    setValue(next)
    setSaving(true)
    try {
      await fetch('/api/tax-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, status: next }),
      })
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const cls = value === 'COMPLETED'
    ? 'bg-green-50 border-green-300 text-green-700'
    : value === 'ISSUED'
      ? 'bg-purple-50 border-purple-300 text-purple-700'
      : 'bg-amber-50 border-amber-300 text-amber-700'

  return (
    <select
      value={value}
      disabled={saving}
      onClick={e => e.stopPropagation()}
      onChange={e => { e.stopPropagation(); handle(e.target.value) }}
      className={`text-[10px] border rounded px-1.5 py-0.5 ${cls}`}
    >
      <option value="PENDING">⚠ 미발행</option>
      <option value="ISSUED">📄 발행</option>
      <option value="COMPLETED">✓ 완료</option>
    </select>
  )
}

interface PaymentEntry {
  id: string; amount: number; paymentDate: string; paymentMethod: string; notes: string | null
}

interface TaxInvoiceEntry {
  id: string; issueDate: string; supplyAmount: number; taxAmount: number; totalAmount: number; itemName: string | null; matchedTransactionId: string | null
}
interface BankInEntry {
  id: string; txDateTime: string; amount: number; rawDescription: string; rawCounterparty: string; matchedPaymentId: string | null
}

interface ClientAR {
  clientId: string; clientName: string; phone: string | null; clientNotes: string | null
  totalAmount: number; count: number; oldestDays: number
  salesPersons: { name: string; count: number; amount: number }[]
  unassignedCount: number; unassignedAmount: number
  items: ARItem[]
  allPayments: PaymentEntry[]
  taxInvoices: TaxInvoiceEntry[]
  bankIns: BankInEntry[]
  taxSum: number
  bankInSum: number
  memos: Record<string, string>
}

const DEFAULT_PERSONS = ['한태원', '한태종', '최현진', '유대현', '전새로미']

export default function ReceivablesPage() {
  const [data, setData] = useState<{ summary: ClientAR[]; totalAR: number; overdueTotal: number; totalCount: number; allPersons: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [payDialog, setPayDialog] = useState<{ arId: string; clientName: string; remaining: number } | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [filterPerson, setFilterPerson] = useState<string>('')   // '' = 전체, 'UNASSIGNED' = 미지정만
  const [bulkDialog, setBulkDialog] = useState<{ clientId: string; clientName: string; unassignedIds: string[] } | null>(null)
  const [bulkPerson, setBulkPerson] = useState('')
  const [bulkCustom, setBulkCustom] = useState('')
  const [expandedAr, setExpandedAr] = useState<string | null>(null)
  const [editingPersonTx, setEditingPersonTx] = useState<string | null>(null)  // 담당자 인라인 편집 중인 transactionId
  const [includeFullyPaid, setIncludeFullyPaid] = useState(false)
  const [dateFrom, setDateFrom] = useState('')  // YYYY-MM-DD, '' = 무제한
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [cols, setCols] = useState(1)  // 카드 그리드 컬럼 수 (반응형)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')

  // 뷰 모드 localStorage 동기화
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dian:receivables:viewMode')
      if (saved === 'card' || saved === 'list') setViewMode(saved)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem('dian:receivables:viewMode', viewMode) } catch { /* ignore */ }
  }, [viewMode])

  // 화면 너비에 따라 그리드 컬럼 수 결정
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      if (w >= 1280) return 4
      if (w >= 1024) return 3
      if (w >= 640) return 2
      return 1
    }
    const update = () => setCols(compute())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // silent=true 면 spinner 안 띄움 (펼침 상태/스크롤 위치 유지)
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/receivables${includeFullyPaid ? '?includeFullyPaid=true' : ''}`)
      const json = await res.json()
      if (!res.ok || !json?.summary) {
        console.error('[receivables fetch]', json)
        setData({ summary: [], totalAR: 0, overdueTotal: 0, totalCount: 0, allPersons: [] })
      } else {
        setData(json)
      }
    } catch (err) {
      console.error(err)
      setData({ summary: [], totalAR: 0, overdueTotal: 0, totalCount: 0, allPersons: [] })
    } finally { if (!silent) setLoading(false) }
  }

  useEffect(() => { fetchData() }, [includeFullyPaid])

  const handlePayment = async () => {
    if (!payDialog || payAmount <= 0) return
    await fetch('/api/receivables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receivableId: payDialog.arId, amount: payAmount, paymentMethod: 'TRANSFER' }),
    })
    setPayDialog(null); setPayAmount(0); fetchData(true)
  }

  // 행별 담당자 지정
  const handleAssignPerson = async (transactionId: string, person: string) => {
    if (!person) return
    await fetch(`/api/transactions/${transactionId}/sales-person`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salesPerson: person }),
    })
    fetchData(true)
  }

  // 거래처 일괄 지정
  const handleBulkAssign = async () => {
    if (!bulkDialog) return
    const person = bulkPerson === '__custom__' ? bulkCustom.trim() : bulkPerson
    if (!person) { alert('담당자를 선택하거나 입력하세요'); return }
    await fetch('/api/transactions/sales-person/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds: bulkDialog.unassignedIds, salesPerson: person }),
    })
    setBulkDialog(null); setBulkPerson(''); setBulkCustom('')
    fetchData(true)
  }

  const agingColor = (days: number) =>
    days <= 30 ? 'text-orange-500' : days <= 60 ? 'text-orange-600' : days <= 90 ? 'text-orange-700' : 'text-red-600'

  const agingBadge = (days: number) =>
    days <= 30 ? 'secondary' as const : days <= 60 ? 'outline' as const : 'destructive' as const

  // 필터 적용 — 담당자 + 거래처명 검색
  const filteredSummary = useMemo(() => {
    if (!data) return []
    const q = searchQuery.trim().toLowerCase()
    let list = data.summary
    if (filterPerson === 'UNASSIGNED') list = list.filter(c => c.unassignedCount > 0)
    else if (filterPerson) list = list.filter(c => c.salesPersons.some(p => p.name === filterPerson))
    if (q) list = list.filter(c => c.clientName.toLowerCase().includes(q))
    return list
  }, [data, filterPerson, searchQuery])

  const filteredTotal = filteredSummary.reduce((s, c) => s + c.totalAmount, 0)
  const personList = useMemo(() => {
    const set = new Set([...DEFAULT_PERSONS, ...(data?.allPersons ?? [])])
    return Array.from(set).sort()
  }, [data])

  // ── 실제 미수 ↔ 서류(계산서) 교차 체크 ──
  // 미수 잔액이 있는데 계산서가 없으면 청구 근거 서류 확인 필요, 발행됐으면 수금 단계.
  const crossCheck = useMemo(() => {
    let unissuedCount = 0, unissuedSum = 0, issuedCount = 0, issuedSum = 0
    for (const c of data?.summary ?? []) {
      for (const ar of c.items) {
        if (ar.remainingAmount <= 0) continue
        if (isCorrectionSale(ar.transaction.description)) continue
        const issued =
          (ar.transaction.taxInvoices?.length ?? 0) > 0 ||
          ar.transaction.taxStatus === 'ISSUED' ||
          ar.transaction.taxStatus === 'COMPLETED'
        if (issued) { issuedCount++; issuedSum += ar.remainingAmount }
        else { unissuedCount++; unissuedSum += ar.remainingAmount }
      }
    }
    return { unissuedCount, unissuedSum, issuedCount, issuedSum }
  }, [data])

  // ── 미수금 안내 메시지 — 문구 생성 + 복사 (알림톡 계약 후 자동 발송 연결 예정) ──
  const [copiedMsgClient, setCopiedMsgClient] = useState<string | null>(null)
  const buildDunningMessage = (client: ClientAR): string => {
    const openItems = client.items
      .filter(ar => ar.remainingAmount > 0 && !isCorrectionSale(ar.transaction.description))
      .sort((a, b) => b.remainingAmount - a.remainingAmount)
    const lines = openItems.slice(0, 3).map(ar => {
      const first = ar.transaction.items[0]
      const name = first ? `${first.productName}${ar.transaction.items.length > 1 ? ` 외 ${ar.transaction.items.length - 1}` : ''}` : '거래'
      return `· ${ar.transaction.date.slice(0, 10)} ${name} — ${formatKRW(ar.remainingAmount)}`
    })
    return [
      `[디안] ${client.clientName} 담당자님, 안녕하세요. 디안입니다.`,
      `미수금 결제 안내드립니다.`,
      `· 미수 잔액: ${formatKRW(client.totalAmount)} (${openItems.length}건${client.oldestDays > 0 ? `, 최장 ${client.oldestDays}일 경과` : ''})`,
      ...lines,
      openItems.length > 3 ? `· 외 ${openItems.length - 3}건` : null,
      `확인 후 입금 부탁드립니다. 감사합니다.`,
    ].filter(Boolean).join('\n')
  }
  const copyDunning = async (client: ClientAR) => {
    const msg = buildDunningMessage(client)
    try {
      await navigator.clipboard.writeText(msg)
      setCopiedMsgClient(client.clientId)
      setTimeout(() => setCopiedMsgClient(null), 1800)
    } catch {
      alert(msg)
    }
  }

  // 엑셀 다운로드 — 현재 필터(담당자/검색어/날짜/완납포함)가 적용된 결과를 4시트로 출력
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    if (!filteredSummary.length) { alert('다운로드할 거래처가 없습니다'); return }
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : -Infinity
      const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity
      const inRange = (ts: number) => ts >= fromTs && ts <= toTs
      const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('ko-KR')

      // 지정한 컬럼들에 천단위 콤마 포맷 적용 (헤더 행 제외)
      const applyMoneyFormat = (ws: Record<string, unknown> & { '!ref'?: string }, cols: number[]) => {
        if (!ws['!ref']) return
        const range = XLSX.utils.decode_range(ws['!ref'])
        for (let R = range.s.r + 1; R <= range.e.r; R++) {
          for (const C of cols) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C })
            const cell = ws[addr] as { v?: unknown; z?: string } | undefined
            if (cell && typeof cell.v === 'number') cell.z = '#,##0'
          }
        }
      }

      const wb = XLSX.utils.book_new()

      // 시트 1: 거래처 요약
      const summaryRows = filteredSummary.map(c => ({
        '거래처': c.clientName,
        '담당자': c.salesPersons.map(p => p.name).join(' · ') || (c.unassignedCount > 0 ? `미지정 ${c.unassignedCount}건` : '미지정'),
        '잔액(원)': c.totalAmount,
        '미수 건수': c.count,
        '연체 일수': c.oldestDays,
        '전화번호': c.phone ?? '',
      }))
      const ws1 = XLSX.utils.json_to_sheet(summaryRows)
      ws1['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 16 }]
      applyMoneyFormat(ws1, [2])  // 잔액(원)
      XLSX.utils.book_append_sheet(wb, ws1, '거래처 요약')

      // 시트 2: 매출
      const saleRows: Record<string, string | number>[] = []
      filteredSummary.forEach(c => {
        c.items.forEach(ar => {
          const ts = new Date(ar.transaction.date).getTime()
          if (!inRange(ts)) return
          saleRows.push({
            '날짜': fmtDate(ar.transaction.date),
            '거래처': c.clientName,
            '담당자': ar.transaction.salesPerson ?? '미지정',
            '금액(원)': ar.originalAmount,
            '품목': ar.transaction.items.map(i => `${i.productName} ${i.quantity}@${i.unitPrice}`).join(' / '),
            '비고': ar.transaction.description ?? '',
            '세금계산서': ar.transaction.taxStatus === 'COMPLETED' ? '완료'
              : ar.transaction.taxStatus === 'ISSUED' ? '발행'
              : (ar.transaction.taxInvoices?.length ? '발행' : '미발행'),
          })
        })
      })
      saleRows.sort((a, b) => String(b['날짜']).localeCompare(String(a['날짜'])))
      const ws2 = XLSX.utils.json_to_sheet(saleRows)
      ws2['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 30 }, { wch: 10 }]
      applyMoneyFormat(ws2, [3])  // 금액(원)
      XLSX.utils.book_append_sheet(wb, ws2, '매출')

      // 시트 3: 입금 (일계표 + 통장)
      const payRows: Record<string, string | number>[] = []
      filteredSummary.forEach(c => {
        c.allPayments.forEach(p => {
          const ts = new Date(p.paymentDate).getTime()
          if (!inRange(ts)) return
          payRows.push({
            '날짜': fmtDate(p.paymentDate),
            '거래처': c.clientName,
            '구분': '일계표',
            '금액(원)': p.amount,
            '결제수단': p.paymentMethod,
            '메모': p.notes ?? '',
          })
        })
        c.bankIns.forEach(b => {
          const ts = new Date(b.txDateTime).getTime()
          if (!inRange(ts)) return
          payRows.push({
            '날짜': fmtDate(b.txDateTime),
            '거래처': c.clientName,
            '구분': '통장',
            '금액(원)': b.amount,
            '결제수단': 'TRANSFER',
            '메모': `${b.rawCounterparty || b.rawDescription}`,
          })
        })
      })
      payRows.sort((a, b) => String(b['날짜']).localeCompare(String(a['날짜'])))
      const ws3 = XLSX.utils.json_to_sheet(payRows)
      ws3['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 40 }]
      applyMoneyFormat(ws3, [3])  // 금액(원)
      XLSX.utils.book_append_sheet(wb, ws3, '입금')

      // 시트 4: 세금계산서
      const taxRows: Record<string, string | number>[] = []
      filteredSummary.forEach(c => {
        c.taxInvoices.forEach(t => {
          const ts = new Date(t.issueDate).getTime()
          if (!inRange(ts)) return
          taxRows.push({
            '발행일': fmtDate(t.issueDate),
            '거래처': c.clientName,
            '공급가(원)': t.supplyAmount,
            '부가세(원)': t.taxAmount,
            '합계(원)': t.totalAmount,
            '품목': t.itemName ?? '',
            '매칭 거래': t.matchedTransactionId ? '매칭됨' : '미매칭',
          })
        })
      })
      taxRows.sort((a, b) => String(b['발행일']).localeCompare(String(a['발행일'])))
      const ws4 = XLSX.utils.json_to_sheet(taxRows)
      ws4['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 10 }]
      applyMoneyFormat(ws4, [2, 3, 4])  // 공급가/부가세/합계
      XLSX.utils.book_append_sheet(wb, ws4, '세금계산서')

      // 파일명 — 필터 정보 반영
      const today = new Date().toISOString().slice(0, 10)
      const parts = ['미수금', today]
      if (filterPerson && filterPerson !== 'UNASSIGNED') parts.push(filterPerson)
      else if (filterPerson === 'UNASSIGNED') parts.push('미지정')
      if (dateFrom || dateTo) parts.push(`${dateFrom || '전체'}~${dateTo || '전체'}`)
      const filename = parts.join('_') + '.xlsx'

      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error('[export]', err)
      alert('엑셀 다운로드 중 오류: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setExporting(false)
    }
  }

  // 리스트 뷰는 1열 고정, 카드 뷰는 반응형
  const effectiveCols = viewMode === 'list' ? 1 : cols

  // 그리드 row 단위로 chunk — 펼침 패널을 row 다음에 삽입하기 위함
  const chunked = useMemo(() => {
    const result: ClientAR[][] = []
    for (let i = 0; i < filteredSummary.length; i += effectiveCols) {
      result.push(filteredSummary.slice(i, i + effectiveCols))
    }
    return result
  }, [filteredSummary, effectiveCols])

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">미수금 관리</h1>
          <p className="text-sm text-slate-500">거래처별 외상 미수금을 추적하고 회수를 기록합니다</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 뷰 토글 */}
          <div className="inline-flex border border-slate-300 rounded-lg overflow-hidden text-sm">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 transition-colors ${
                viewMode === 'card'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              📇 카드형
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 transition-colors border-l border-slate-300 ${
                viewMode === 'list'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              📋 리스트형
            </button>
          </div>
          {/* 엑셀 다운로드 */}
          <button
            onClick={handleExport}
            disabled={exporting || !filteredSummary.length}
            className="px-3 py-2 text-sm border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="현재 필터가 적용된 결과를 엑셀로 다운로드"
          >
            {exporting ? '⏳ 생성 중…' : '📥 엑셀 다운로드'}
          </button>
          {/* 거래처 검색 */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="거래처 검색…"
              className="w-72 text-sm border border-slate-300 rounded-lg px-3 py-2 pr-8 bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-xs text-slate-500">미수금 총액</span></div>
            <p className="text-2xl font-bold">{formatKRW(data?.totalAR || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-orange-500" /><span className="text-xs text-slate-500">연체 금액 (30일+)</span></div>
            <p className="text-2xl font-bold text-orange-600">{formatKRW(data?.overdueTotal || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><span className="text-xs text-slate-500">미수 건수</span></div>
            <p className="text-2xl font-bold">{data?.totalCount || 0}건 / {data?.summary.length || 0}곳</p>
          </CardContent>
        </Card>
      </div>

      {/* 실제 미수 ↔ 서류(계산서) 교차 체크 */}
      {(crossCheck.unissuedCount > 0 || crossCheck.issuedCount > 0) && (
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-3 flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-slate-700">🔍 실제 미수 ↔ 서류 교차 체크</span>
            {crossCheck.unissuedCount > 0 && (
              <span className="px-2 py-1 rounded bg-orange-50 border border-orange-200 text-orange-700 font-bold">
                계산서 미발행 미수 {crossCheck.unissuedCount}건 · {formatKRW(crossCheck.unissuedSum)} — 청구 서류 확인 필요
              </span>
            )}
            {crossCheck.issuedCount > 0 && (
              <span className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold">
                계산서 발행됨 · 수금 대기 {crossCheck.issuedCount}건 · {formatKRW(crossCheck.issuedSum)}
              </span>
            )}
            <span className="text-slate-400">세금계산서 목록 업로드가 최신일수록 정확합니다</span>
          </CardContent>
        </Card>
      )}

      {/* 담당자 필터 */}
      <Card>
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 mr-2">담당자 필터:</span>
          <Button size="sm" variant={!filterPerson ? 'default' : 'outline'} onClick={() => setFilterPerson('')}>
            전체 ({data?.summary.length ?? 0})
          </Button>
          {personList.map(p => {
            const cnt = data?.summary.filter(c => c.salesPersons.some(s => s.name === p)).length ?? 0
            return (
              <Button key={p} size="sm" variant={filterPerson === p ? 'default' : 'outline'} onClick={() => setFilterPerson(p)} disabled={cnt === 0}>
                {p} ({cnt})
              </Button>
            )
          })}
          {(data?.summary.some(c => c.unassignedCount > 0) ?? false) && (
            <Button size="sm" variant={filterPerson === 'UNASSIGNED' ? 'default' : 'outline'} onClick={() => setFilterPerson('UNASSIGNED')} className="border-amber-300">
              ⚠ 미지정 있음
            </Button>
          )}
          {filterPerson && (
            <span className="text-xs text-slate-500 ml-auto">필터 합계: <strong className="text-slate-700">{formatKRW(filteredTotal)}</strong></span>
          )}
          <div className={`flex items-center gap-1.5 text-xs ${filterPerson ? '' : 'ml-auto'}`}>
            <span className="text-slate-500">기간:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="border rounded px-1.5 py-0.5 text-xs"
            />
            <span className="text-slate-400">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="border rounded px-1.5 py-0.5 text-xs"
            />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-slate-400 hover:text-slate-700 px-1">✕</button>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none text-slate-600 hover:text-slate-900">
            <input
              type="checkbox"
              checked={includeFullyPaid}
              onChange={e => setIncludeFullyPaid(e.target.checked)}
              className="w-3.5 h-3.5 accent-slate-600"
            />
            완납 거래처 보기
          </label>
        </CardContent>
      </Card>

      {/* 거래처별 미수금 목록 — 카드 그리드 (최대 4열) */}
      {!filteredSummary.length ? (
        <Card><CardContent className="py-16 text-center"><CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" /><p className="text-slate-500">{filterPerson ? '해당 담당자의 미수금이 없습니다' : '미수금이 없습니다'}</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {/* 리스트뷰 헤더 */}
          {viewMode === 'list' && (
            <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 text-xs text-slate-500 font-medium bg-slate-50 rounded-t-lg border border-slate-200">
              <div className="col-span-5">거래처</div>
              <div className="col-span-3">담당자</div>
              <div className="col-span-2 text-right">잔액</div>
              <div className="col-span-1 text-center">연체</div>
              <div className="col-span-1"></div>
            </div>
          )}
          {chunked.map((rowClients, rowIdx) => {
            const expandedInRow = rowClients.find(c => c.clientId === expandedClient)
            return (
              <div key={rowIdx} className={viewMode === 'list' ? 'space-y-1' : 'space-y-4'}>
                {viewMode === 'card' ? (
                  <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                    {rowClients.map(client => {
                      const isSelected = expandedClient === client.clientId
                      return (
                        <Card
                          key={client.clientId}
                          onClick={() => setExpandedClient(isSelected ? null : client.clientId)}
                          className={`cursor-pointer transition-all ${
                            isSelected
                              ? 'border-2 border-blue-400 shadow-lg ring-2 ring-blue-100'
                              : client.oldestDays > 60
                                ? 'border border-red-200 hover:shadow-md hover:border-red-300'
                                : 'border border-slate-200 hover:shadow-md hover:border-slate-300'
                          }`}
                        >
                          <CardContent className="p-4 flex flex-col items-center text-center gap-2 min-h-[140px] justify-between">
                            <h3 className="font-semibold text-slate-900 text-sm truncate w-full" title={client.clientName}>
                              {client.clientName}
                            </h3>
                            <div className="flex flex-col items-center">
                              <p className={`text-xl font-bold ${client.totalAmount < 0 ? 'text-blue-600' : agingColor(client.oldestDays)}`}>
                                {client.totalAmount < 0 ? `-${formatKRW(Math.abs(client.totalAmount))}` : formatKRW(client.totalAmount)}
                              </p>
                              {client.totalAmount < 0 && (
                                <p className="text-[10px] text-blue-500 mt-0.5">입금 초과</p>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 truncate w-full">
                              {client.salesPersons.length > 0 ? (
                                client.salesPersons.map(p => p.name).join(' · ')
                              ) : client.unassignedCount > 0 ? (
                                <span className="text-amber-600">⚠ 미지정 {client.unassignedCount}건</span>
                              ) : (
                                <span className="text-slate-300">담당자 미지정</span>
                              )}
                            </div>
                            {client.clientNotes && (
                              <div className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 truncate w-full" title={client.clientNotes}>
                                📝 {client.clientNotes}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  // 리스트뷰: 한 행씩 가로 정렬
                  <div>
                    {rowClients.map(client => {
                      const isSelected = expandedClient === client.clientId
                      return (
                        <div
                          key={client.clientId}
                          onClick={() => setExpandedClient(isSelected ? null : client.clientId)}
                          className={`grid grid-cols-12 gap-3 px-4 py-3 items-center cursor-pointer transition-colors border ${
                            isSelected
                              ? 'border-blue-400 bg-blue-50/40 shadow-sm'
                              : client.oldestDays > 60
                                ? 'border-red-200 bg-white hover:bg-red-50/30'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="col-span-5">
                            <div className="font-medium text-sm text-slate-900 truncate" title={client.clientName}>
                              {client.clientName}
                            </div>
                            {client.phone && (
                              <div className="text-[11px] text-slate-400 mt-0.5">{client.phone}</div>
                            )}
                          </div>
                          <div className="col-span-3 text-xs text-slate-600 truncate">
                            {client.salesPersons.length > 0 ? (
                              client.salesPersons.map(p => p.name).join(' · ')
                            ) : client.unassignedCount > 0 ? (
                              <span className="text-amber-600">⚠ 미지정 {client.unassignedCount}건</span>
                            ) : (
                              <span className="text-slate-300">담당자 미지정</span>
                            )}
                          </div>
                          <div className={`col-span-2 text-right font-bold text-base ${client.totalAmount < 0 ? 'text-blue-600' : agingColor(client.oldestDays)}`}>
                            {client.totalAmount < 0 ? `-${formatKRW(Math.abs(client.totalAmount))}` : formatKRW(client.totalAmount)}
                          </div>
                          <div className="col-span-1 text-center text-xs">
                            {client.oldestDays > 0 && (
                              <span className={agingColor(client.oldestDays)}>{client.oldestDays}일</span>
                            )}
                          </div>
                          <div className="col-span-1 text-right text-slate-400">
                            {isSelected ? '▼' : '▶'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 펼침 패널 — 이 row 에 선택된 카드가 있으면 전체 폭으로 표시 */}
                {expandedInRow && (() => {
                  const client = expandedInRow
                  return (
                    <Card className="border-2 border-blue-300 shadow-md">
                      <CardContent className="p-5">
                        {/* 펼침 헤더 — 거래처 정보 풀버전 */}
                        <div className="mb-4 pb-4 border-b border-slate-200">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-lg text-slate-900">{client.clientName}</h3>
                              {client.phone && (
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {client.salesPersons.map(p => (
                                  <Badge key={p.name} variant="outline" className="gap-1 bg-blue-50 border-blue-200 text-blue-700">
                                    <User className="w-3 h-3" />{p.name} ({p.count}건)
                                  </Badge>
                                ))}
                                {client.unassignedCount > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const ids = client.items.filter(ar => !ar.transaction.salesPerson).map(ar => ar.transactionId)
                                      setBulkDialog({ clientId: client.clientId, clientName: client.clientName, unassignedIds: ids })
                                    }}
                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    title="미지정 거래에 담당자 일괄 지정"
                                  >
                                    <UserPlus className="w-3 h-3" />미지정 {client.unassignedCount}건 일괄 지정
                                  </button>
                                )}
                              </div>
                              {/* 미수금 안내 메시지 — 문구 복사 + 문자 (알림톡 자동 발송은 계약 후) */}
                              {client.totalAmount > 0 && (
                                <div className="flex items-center gap-1.5 mt-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyDunning(client) }}
                                    className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded font-bold transition-colors ${
                                      copiedMsgClient === client.clientId
                                        ? 'bg-green-50 border border-green-300 text-green-700'
                                        : 'bg-slate-900 text-white hover:bg-slate-700'
                                    }`}
                                    title="미수금 안내 문구를 복사해 카톡·문자에 붙여넣기"
                                  >
                                    💬 {copiedMsgClient === client.clientId ? '복사됨 — 붙여넣어 보내세요' : '미수금 메시지 복사'}
                                  </button>
                                  {client.phone && (
                                    <a
                                      href={`sms:${client.phone.replace(/[^0-9+]/g, '')}?body=${encodeURIComponent(buildDunningMessage(client))}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded font-bold border border-slate-300 bg-white text-slate-600 hover:border-slate-500"
                                      title="연결된 휴대폰에서 문자로 보내기"
                                    >
                                      📱 문자로
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* 가운데: 거래처 비고 입력 */}
                            <div className="flex-1 min-w-0 max-w-xl">
                              <div className="text-[11px] text-slate-500 mb-1">📝 거래처 비고</div>
                              <ClientNoteCell
                                clientId={client.clientId}
                                initial={client.clientNotes}
                                onSaved={() => fetchData(true)}
                              />
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              <p className={`text-2xl font-bold ${client.totalAmount < 0 ? 'text-blue-600' : agingColor(client.oldestDays)}`}>
                                {client.totalAmount < 0 ? `-${formatKRW(Math.abs(client.totalAmount))}` : formatKRW(client.totalAmount)}
                              </p>
                              {client.totalAmount < 0 && (
                                <p className="text-[10px] text-blue-500 mt-0.5">입금 초과</p>
                              )}
                              <button
                                onClick={() => setExpandedClient(null)}
                                className="mt-2 text-xs text-slate-400 hover:text-slate-700"
                              >
                                ✕ 닫기
                              </button>
                            </div>
                          </div>
                        </div>

                        {(() => {
                  // 4종 데이터를 행으로 합쳐서 시간순 정렬, 컬럼 테이블로 표시
                  type Row =
                    | { kind: 'sale'; ts: number; ar: ARItem }
                    | { kind: 'pay'; ts: number; pay: PaymentEntry }
                    | { kind: 'tax'; ts: number; tax: TaxInvoiceEntry }
                    | { kind: 'bank'; ts: number; bank: BankInEntry }
                  const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : -Infinity
                  const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity
                  const allRows: Row[] = [
                    ...client.items.map(ar => ({ kind: 'sale' as const, ts: new Date(ar.transaction.date).getTime(), ar })),
                    ...client.allPayments.map(pay => ({ kind: 'pay' as const, ts: new Date(pay.paymentDate).getTime(), pay })),
                    ...(client.taxInvoices ?? []).map(tax => ({ kind: 'tax' as const, ts: new Date(tax.issueDate).getTime(), tax })),
                    ...(client.bankIns ?? []).map(bank => ({ kind: 'bank' as const, ts: new Date(bank.txDateTime).getTime(), bank })),
                  ]
                  const rows = allRows.filter(r => r.ts >= fromTs && r.ts <= toTs).sort((a, b) => b.ts - a.ts)

                  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('ko-KR')

                  return (
                  <div className="mt-4 pt-4 border-t">
                    <table className="w-full text-xs">
                      <thead className="text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left py-1.5 font-normal w-24">날짜</th>
                          <th className="text-right py-1.5 font-normal w-32">매출</th>
                          <th className="text-right py-1.5 font-normal w-32">일계표 입금</th>
                          <th className="text-right py-1.5 font-normal w-32">통장 입금</th>
                          <th className="text-right py-1.5 font-normal w-32">세금계산서</th>
                          <th className="text-left py-1.5 font-normal pl-3">메모/담당자</th>
                          <th className="text-left py-1.5 font-normal pl-3 min-w-[28rem]">비고</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 && (
                          <tr><td colSpan={8} className="py-4 text-center text-slate-400">표시할 항목이 없습니다 (필터 확인)</td></tr>
                        )}
                        {rows.map(row => {
                          if (row.kind === 'sale') {
                            const correction = isCorrectionSale(row.ar.transaction.description)
                            const matched = (client.taxInvoices ?? []).some(t => t.matchedTransactionId === row.ar.transactionId)
                            return (
                              <Fragment key={`s-${row.ar.id}`}>
                                <tr
                                  className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${correction ? 'bg-slate-100/70' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); setExpandedAr(expandedAr === row.ar.id ? null : row.ar.id) }}
                                >
                                  <td className={`py-2 ${correction ? 'text-slate-400' : 'text-slate-600'}`}>{fmtDate(row.ts)}</td>
                                  <td className={`py-2 text-right font-bold ${correction ? 'text-slate-400 font-normal' : 'text-red-600'}`}>
                                    {correction ? '⚙️ ' : '+'}{formatKRW(row.ar.originalAmount)}
                                  </td>
                                  <td></td><td></td><td></td>
                                  <td className="py-2 pl-3">
                                    {correction ? (
                                      <span className="text-[11px] text-slate-400 italic">금액조정</span>
                                    ) : (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <TaxStatusSelect
                                          transactionId={row.ar.transactionId}
                                          initial={row.ar.transaction.taxStatus}
                                          matched={matched}
                                          onChanged={() => fetchData(true)}
                                        />
                                        {editingPersonTx === row.ar.transactionId || !row.ar.transaction.salesPerson ? (
                                          <select
                                            autoFocus={editingPersonTx === row.ar.transactionId}
                                            className={`text-[10px] border rounded px-1 py-0.5 ${
                                              row.ar.transaction.salesPerson
                                                ? 'bg-blue-50 border-blue-300 text-blue-700'
                                                : 'bg-amber-50 border-amber-300 text-amber-700'
                                            }`}
                                            defaultValue={row.ar.transaction.salesPerson ?? ''}
                                            onClick={e => e.stopPropagation()}
                                            onBlur={() => setEditingPersonTx(null)}
                                            onChange={e => {
                                              e.stopPropagation()
                                              const v = e.target.value
                                              setEditingPersonTx(null)
                                              if (v === '__custom__') {
                                                const name = prompt('담당자 이름 입력:')
                                                if (name?.trim()) handleAssignPerson(row.ar.transactionId, name.trim())
                                              } else if (v && v !== row.ar.transaction.salesPerson) {
                                                handleAssignPerson(row.ar.transactionId, v)
                                              }
                                            }}
                                          >
                                            <option value="">담당자</option>
                                            {personList.map(p => <option key={p} value={p}>{p}</option>)}
                                            <option value="__custom__">기타</option>
                                          </select>
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            onClick={e => { e.stopPropagation(); setEditingPersonTx(row.ar.transactionId) }}
                                            className="gap-1 bg-blue-50 border-blue-200 text-blue-700 text-[10px] px-1.5 cursor-pointer hover:bg-blue-100 transition-colors"
                                            title="클릭해서 담당자 변경"
                                          >
                                            <User className="w-3 h-3" />{row.ar.transaction.salesPerson}
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 pl-3" onClick={e => e.stopPropagation()}>
                                    <MemoCell rowType="SALE" rowId={row.ar.id} initial={client.memos?.[`SALE__${row.ar.id}`] ?? ''} />
                                  </td>
                                  <td className="text-center text-slate-400">{expandedAr === row.ar.id ? '▼' : '▶'}</td>
                                </tr>
                                {expandedAr === row.ar.id && (
                                  <tr key={`s-d-${row.ar.id}`} className="bg-slate-50/60">
                                    <td colSpan={8} className="px-3 py-2">
                                      <p className="text-[11px] text-slate-500 font-medium mb-1">품목</p>
                                      {row.ar.transaction.items.length === 0 ? (
                                        <p className="text-xs text-slate-400 py-1">품목 정보 없음</p>
                                      ) : (
                                        <table className="w-full text-xs">
                                          <thead className="text-slate-500">
                                            <tr className="border-b border-slate-200">
                                              <th className="text-left py-1 font-normal">품목</th>
                                              <th className="text-right py-1 font-normal w-20">수량</th>
                                              <th className="text-right py-1 font-normal w-24">단가</th>
                                              <th className="text-right py-1 font-normal w-28">금액</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {row.ar.transaction.items.map((it, i) => (
                                              <tr key={i} className="border-b border-slate-100 last:border-0">
                                                <td className="py-1 text-slate-700">{it.productName}</td>
                                                <td className="py-1 text-right text-slate-600">{it.quantity.toLocaleString()}</td>
                                                <td className="py-1 text-right text-slate-600">{formatKRW(it.unitPrice)}</td>
                                                <td className="py-1 text-right font-medium text-slate-800">{formatKRW(it.amount)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          }
                          if (row.kind === 'pay') {
                            const correction = isCorrectionPay(row.pay.notes)
                            return (
                              <tr key={`p-${row.pay.id}`} className={`border-b border-slate-100 ${correction ? 'bg-slate-50/50' : 'bg-blue-50/30'}`}>
                                <td className="py-2 text-slate-600">{fmtDate(row.ts)}</td>
                                <td></td>
                                <td className={`py-2 text-right font-bold ${correction ? 'text-slate-500' : 'text-blue-600'}`}>
                                  {correction ? '⚙️ ' : '+'}{formatKRW(row.pay.amount)}
                                </td>
                                <td></td><td></td>
                                <td className="py-2 pl-3 text-slate-500 text-[11px]">{correction ? '잔액 조정' : row.pay.notes ?? '일계표 입금'}</td>
                                <td className="py-2 pl-3">
                                  <MemoCell rowType="PAYMENT" rowId={row.pay.id} initial={client.memos?.[`PAYMENT__${row.pay.id}`] ?? ''} />
                                </td>
                                <td></td>
                              </tr>
                            )
                          }
                          if (row.kind === 'bank') {
                            return (
                              <tr key={`b-${row.bank.id}`} className="border-b border-slate-100 bg-green-50/30">
                                <td className="py-2 text-slate-600">{fmtDate(row.ts)}</td>
                                <td></td><td></td>
                                <td className="py-2 text-right font-bold text-green-600">+{formatKRW(row.bank.amount)}</td>
                                <td></td>
                                <td className="py-2 pl-3 text-slate-500 text-[11px]">🟢 {row.bank.rawCounterparty || row.bank.rawDescription}</td>
                                <td className="py-2 pl-3">
                                  <MemoCell rowType="BANK" rowId={row.bank.id} initial={client.memos?.[`BANK__${row.bank.id}`] ?? ''} />
                                </td>
                                <td></td>
                              </tr>
                            )
                          }
                          // tax
                          return (
                            <tr key={`t-${row.tax.id}`} className="border-b border-slate-100 bg-purple-50/30">
                              <td className="py-2 text-slate-600">{fmtDate(row.ts)}</td>
                              <td></td><td></td><td></td>
                              <td className="py-2 text-right font-bold text-purple-600">{formatKRW(row.tax.totalAmount)}</td>
                              <td className="py-2 pl-3 text-slate-500 text-[11px]">📄 {row.tax.itemName ?? ''} · 공급가 {formatKRW(row.tax.supplyAmount)}</td>
                              <td className="py-2 pl-3">
                                <MemoCell rowType="TAX" rowId={row.tax.id} initial={client.memos?.[`TAX__${row.tax.id}`] ?? ''} />
                              </td>
                              <td></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  )
                        })()}
                      </CardContent>
                    </Card>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}

      {/* 회수 다이얼로그 */}
      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>미수금 회수</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">거래처: <strong>{payDialog?.clientName}</strong></p>
            <p className="text-sm">잔여 미수금: <strong className="text-red-600">{formatKRW(payDialog?.remaining || 0)}</strong></p>
            <div><Label>회수 금액 (원)</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(parseInt(e.target.value) || 0)} /></div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPayAmount(payDialog?.remaining || 0)}>전액</Button>
              <Button className="flex-1" onClick={handlePayment}>회수 처리</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 일괄 담당자 지정 다이얼로그 */}
      <Dialog open={!!bulkDialog} onOpenChange={() => { setBulkDialog(null); setBulkPerson(''); setBulkCustom('') }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>일괄 담당자 지정</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <strong>{bulkDialog?.clientName}</strong>의 미지정 거래 <strong>{bulkDialog?.unassignedIds.length}건</strong>에<br />
              담당자를 일괄 지정합니다.
            </p>
            <div>
              <Label>담당자</Label>
              <select className="w-full mt-1 border rounded px-2 py-2 text-sm" value={bulkPerson} onChange={e => setBulkPerson(e.target.value)}>
                <option value="">선택…</option>
                {personList.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="__custom__">기타 (직접 입력)</option>
              </select>
              {bulkPerson === '__custom__' && (
                <Input className="mt-2" placeholder="담당자 이름" value={bulkCustom} onChange={e => setBulkCustom(e.target.value)} />
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setBulkDialog(null); setBulkPerson(''); setBulkCustom('') }}>취소</Button>
              <Button className="flex-1" onClick={handleBulkAssign}>일괄 지정</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
