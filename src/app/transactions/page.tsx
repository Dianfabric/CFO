'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Search, Trash2, Receipt, Ship, Upload, CheckCircle, AlertCircle, X } from 'lucide-react'
import {
  formatKRW, formatDate, getTransactionTypeName, getPaymentMethodName,
  getPaymentStatusName, getChannelName,
} from '@/lib/formatters'

interface Product { id: string; name: string; unit: string; sellingPrice: number; purchasePrice: number }
interface Client { id: string; name: string; type: string }
interface TransactionItem {
  productId: string; productName: string; quantity: number; unitPrice: number; notes: string
}
interface Transaction {
  id: string; date: string; type: string; totalAmount: number;
  paymentMethod: string; paymentStatus: string; channel: string;
  description: string | null;
  client: { id: string; name: string } | null;
  items: { id: string; productName: string; quantity: number; unitPrice: number; amount: number;
    product: { id: string; name: string; unit: string } | null }[]
}

const TYPES = [
  { value: 'SALE', label: '매출', color: 'bg-blue-500' },
  { value: 'EXPENSE', label: '비용', color: 'bg-red-500' },
  { value: 'PURCHASE', label: '매입', color: 'bg-yellow-500' },
]
const PAYMENTS = [
  { value: 'CASH', label: '현금' },
  { value: 'CARD', label: '카드' },
  { value: 'TRANSFER', label: '계좌이체' },
  { value: 'CREDIT', label: '외상' },
]
const CHANNELS = [
  { value: 'B2B', label: 'B2B' },
  { value: 'B2C_OFFLINE', label: 'B2C 오프라인' },
  { value: 'B2C_ONLINE', label: 'B2C 온라인' },
]

const emptyItem: TransactionItem = { productId: '', productName: '', quantity: 1, unitPrice: 0, notes: '' }

interface ShippingParsed {
  docType: 'invoice' | 'customs'
  amount: number
  date: string
  vendor: string
  fileName: string
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [searchClient, setSearchClient] = useState('')

  // 해외운송비 PDF 자동 등록
  const [shippingOpen, setShippingOpen] = useState(false)
  const [shippingState, setShippingState] = useState<'idle' | 'parsing' | 'parsed' | 'saving' | 'done'>('idle')
  const [shippingItems, setShippingItems] = useState<ShippingParsed[]>([])
  const [shippingError, setShippingError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 거래 입력 폼
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'SALE', clientId: '', description: '',
    paymentMethod: 'TRANSFER', paymentStatus: 'PAID',
    channel: 'B2B', notes: '',
  })
  const [items, setItems] = useState<TransactionItem[]>([{ ...emptyItem }])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterType) params.set('type', filterType)
      if (filterDate) params.set('startDate', filterDate)

      const [txRes, pRes, cRes] = await Promise.all([
        fetch(`/api/transactions?${params}`),
        fetch('/api/products'),
        fetch('/api/clients'),
      ])
      const txData = await txRes.json()
      setTransactions(txData.transactions || [])
      setTotal(txData.total || 0)
      setProducts(await pRes.json())
      setClients(await cRes.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [filterType, filterDate])

  useEffect(() => { fetchData() }, [fetchData])

  const addItem = () => setItems([...items, { ...emptyItem }])
  const removeItem = (idx: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== idx))
  }
  const updateItem = (idx: number, field: keyof TransactionItem, value: string | number) => {
    const updated = [...items]
    if (field === 'productId') {
      const product = products.find(p => p.id === value)
      updated[idx] = {
        ...updated[idx],
        productId: value as string,
        productName: product?.name || '',
        unitPrice: form.type === 'PURCHASE' ? (product?.purchasePrice || 0) : (product?.sellingPrice || 0),
      }
    } else {
      (updated[idx] as unknown as Record<string, unknown>)[field] = value
    }
    setItems(updated)
  }

  const totalAmount = items.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0)

  const handleSave = async () => {
    if (items.every(it => it.unitPrice === 0 && !it.productName)) return
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items }),
      })
      if (res.ok) {
        setDialogOpen(false)
        setForm({
          date: new Date().toISOString().split('T')[0],
          type: 'SALE', clientId: '', description: '',
          paymentMethod: 'TRANSFER', paymentStatus: 'PAID',
          channel: 'B2B', notes: '',
        })
        setItems([{ ...emptyItem }])
        fetchData()
      }
    } catch (err) { console.error(err) }
  }

  const handleShippingFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setShippingState('parsing')
    setShippingError('')
    setShippingItems([])
    try {
      const form = new FormData()
      Array.from(files).forEach(f => form.append('files', f))
      const res = await fetch('/api/shipping-import', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { setShippingError(json.error ?? '파싱 오류'); setShippingState('idle'); return }
      setShippingItems(json.results)
      setShippingState('parsed')
    } catch {
      setShippingError('네트워크 오류')
      setShippingState('idle')
    }
  }

  const handleShippingSave = async () => {
    setShippingState('saving')
    try {
      const res = await fetch('/api/shipping-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: shippingItems }),
      })
      if (!res.ok) { setShippingError('저장 오류'); setShippingState('parsed'); return }
      setShippingState('done')
      fetchData()
    } catch {
      setShippingError('네트워크 오류')
      setShippingState('parsed')
    }
  }

  const openNew = (type: string = 'SALE') => {
    setForm(prev => ({ ...prev, type, date: new Date().toISOString().split('T')[0] }))
    setItems([{ ...emptyItem }])
    setDialogOpen(true)
  }

  const typeVariant = (type: string) => {
    if (type === 'SALE') return 'default' as const
    if (type === 'PURCHASE') return 'outline' as const
    return 'secondary' as const
  }

  const statusVariant = (s: string) => {
    if (s === 'PAID') return 'secondary' as const
    if (s === 'PARTIAL') return 'outline' as const
    return 'destructive' as const
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">거래 관리</h1>
          <p className="text-sm text-slate-500">매출·비용·매입 거래를 기록하고 조회합니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => { setShippingOpen(true); setShippingState('idle'); setShippingItems([]); setShippingError('') }}>
            <Ship className="w-4 h-4" />해외운송비 PDF
          </Button>
          {TYPES.map(t => (
            <Button key={t.value} variant={t.value === 'SALE' ? 'default' : 'outline'}
              size="sm" className="gap-1" onClick={() => openNew(t.value)}>
              <Plus className="w-4 h-4" />{t.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 flex-wrap">
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">전체 구분</option>
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <Input type="date" className="w-40" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <div className="text-sm text-slate-500 flex items-center">총 {total}건</div>
      </div>

      {/* 거래 목록 */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">거래 내역이 없습니다</p>
            <Button variant="outline" className="mt-3" onClick={() => openNew()}>첫 거래 입력하기</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500 bg-slate-50">
                    <th className="p-3 font-medium">날짜</th>
                    <th className="p-3 font-medium">구분</th>
                    <th className="p-3 font-medium">거래처</th>
                    <th className="p-3 font-medium">상세</th>
                    <th className="p-3 font-medium text-right">금액</th>
                    <th className="p-3 font-medium">결제</th>
                    <th className="p-3 font-medium">상태</th>
                    <th className="p-3 font-medium">채널</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="p-3">{formatDate(tx.date)}</td>
                      <td className="p-3"><Badge variant={typeVariant(tx.type)}>{getTransactionTypeName(tx.type)}</Badge></td>
                      <td className="p-3 text-slate-700">{tx.client?.name || '-'}</td>
                      <td className="p-3 text-slate-600 max-w-48 truncate">
                        {tx.items.map(it => it.productName || it.product?.name).filter(Boolean).join(', ') || tx.description || '-'}
                      </td>
                      <td className="p-3 text-right font-medium">{formatKRW(tx.totalAmount)}</td>
                      <td className="p-3 text-slate-600">{getPaymentMethodName(tx.paymentMethod)}</td>
                      <td className="p-3"><Badge variant={statusVariant(tx.paymentStatus)}>{getPaymentStatusName(tx.paymentStatus)}</Badge></td>
                      <td className="p-3 text-slate-500 text-xs">{getChannelName(tx.channel)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 거래 입력 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge>{getTransactionTypeName(form.type)}</Badge> 새 거래 입력
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>구분</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label>날짜</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>채널</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
                  {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            {/* 거래처 */}
            <div>
              <Label>거래처</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}>
                <option value="">선택 안함 (B2C 현금 등)</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* 거래 항목 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">거래 항목</Label>
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus className="w-3 h-3" />항목 추가
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-end p-2 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <Label className="text-xs">제품</Label>
                      <select className="w-full h-8 rounded border border-input bg-background px-2 text-sm"
                        value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}>
                        <option value="">직접 입력</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    {!item.productId && (
                      <div className="w-28">
                        <Label className="text-xs">항목명</Label>
                        <Input className="h-8 text-sm" value={item.productName}
                          onChange={e => updateItem(idx, 'productName', e.target.value)} placeholder="항목명" />
                      </div>
                    )}
                    <div className="w-20">
                      <Label className="text-xs">수량</Label>
                      <Input type="number" className="h-8 text-sm" value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="w-28">
                      <Label className="text-xs">단가</Label>
                      <Input type="number" className="h-8 text-sm" value={item.unitPrice}
                        onChange={e => updateItem(idx, 'unitPrice', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="w-24 text-right">
                      <Label className="text-xs">소계</Label>
                      <p className="h-8 flex items-center justify-end text-sm font-medium">
                        {formatKRW(item.quantity * item.unitPrice)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="h-8 w-8 p-0">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* 합계 */}
            <div className="flex justify-end p-3 bg-blue-50 rounded-lg">
              <div className="text-right">
                <p className="text-xs text-slate-500">합계 (부가세 별도)</p>
                <p className="text-xl font-bold text-blue-700">{formatKRW(totalAmount)}</p>
                <p className="text-xs text-slate-400">부가세 포함: {formatKRW(Math.round(totalAmount * 1.1))}</p>
              </div>
            </div>

            {/* 결제 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>결제 방법</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value, paymentStatus: e.target.value === 'CREDIT' ? 'UNPAID' : 'PAID' })}>
                  {PAYMENTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <Label>결제 상태</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
                  <option value="PAID">완납</option>
                  <option value="PARTIAL">일부결제</option>
                  <option value="UNPAID">미결제</option>
                </select>
              </div>
            </div>

            {form.paymentMethod === 'CREDIT' && (
              <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
                ⚠️ 외상 거래입니다. 저장 시 미수금이 자동 등록됩니다.
              </div>
            )}

            {/* 메모 */}
            <div>
              <Label>메모 (선택)</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="거래 관련 메모" />
            </div>

            <Button onClick={handleSave} className="w-full" size="lg">
              거래 저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* 해외운송비 PDF 자동 등록 다이얼로그 */}
      <Dialog open={shippingOpen} onOpenChange={open => { setShippingOpen(open); if (!open) setShippingState('idle') }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ship className="w-5 h-5 text-blue-600" />해외운송비 PDF 자동 등록
            </DialogTitle>
          </DialogHeader>

          {shippingState === 'done' ? (
            <div className="py-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-medium text-slate-800">등록 완료!</p>
              <p className="text-sm text-slate-500 mt-1">{shippingItems.length}건이 매입으로 등록됐습니다</p>
              <Button className="mt-4" onClick={() => setShippingOpen(false)}>닫기</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 업로드 영역 */}
              {(shippingState === 'idle' || shippingState === 'parsing') && (
                <div
                  className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleShippingFiles(e.dataTransfer.files) }}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden"
                    onChange={e => handleShippingFiles(e.target.files)} />
                  {shippingState === 'parsing' ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                      <p className="text-sm text-blue-600">AI 분석 중...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700">PDF 파일을 끌어다 놓거나 클릭해서 선택</p>
                      <p className="text-xs text-slate-400 mt-1">글로지텍 인보이스 + 수입세금계산서 동시 업로드 가능</p>
                    </>
                  )}
                </div>
              )}

              {/* 오류 */}
              {shippingError && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />{shippingError}
                </div>
              )}

              {/* 파싱 결과 */}
              {shippingState === 'parsed' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">추출 결과 — 확인 후 등록하세요</p>
                  {shippingItems.map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {item.docType === 'invoice' ? '운임 인보이스' : '수입세금계산서'}
                        </span>
                        <button onClick={() => setShippingItems(prev => prev.filter((_, i) => i !== idx))}>
                          <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">업체</Label>
                          <Input className="h-8 text-sm" value={item.vendor}
                            onChange={e => setShippingItems(prev => prev.map((it, i) => i === idx ? { ...it, vendor: e.target.value } : it))} />
                        </div>
                        <div>
                          <Label className="text-xs">날짜</Label>
                          <Input type="date" className="h-8 text-sm" value={item.date}
                            onChange={e => setShippingItems(prev => prev.map((it, i) => i === idx ? { ...it, date: e.target.value } : it))} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">금액 (원)</Label>
                        <Input type="number" className="h-8 text-sm" value={item.amount}
                          onChange={e => setShippingItems(prev => prev.map((it, i) => i === idx ? { ...it, amount: parseInt(e.target.value) || 0 } : it))} />
                      </div>
                      <p className="text-xs text-slate-400">파일: {item.fileName}</p>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-slate-600">
                      합계: <strong>{formatKRW(shippingItems.reduce((s, it) => s + it.amount, 0))}</strong>
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm"
                        onClick={() => { setShippingState('idle'); setShippingItems([]) }}>다시 업로드</Button>
                      <Button size="sm" onClick={handleShippingSave} disabled={shippingItems.length === 0}>
                        {`${shippingItems.length}건 매입 등록`}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
