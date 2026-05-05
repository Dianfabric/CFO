'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  Send,
  RotateCcw,
  CheckCircle,
  XCircle,
  Truck,
} from 'lucide-react'
import {
  updateSampleRequest,
  setSampleRequestStatus,
  deleteSampleRequest,
  upsertSampleItem,
  setSampleItemStatus,
  deleteSampleItem,
} from '@/app/finance/operations/actions'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export interface RequestRow {
  id: number
  client_id: number
  request_date: string
  request_method: string | null
  purpose: string | null
  status: string
  ship_date: string | null
  return_due_date: string | null
  total_items: number | null
  total_cost: number | null
  conversion_value: number | null
  notes: string | null
}

export interface ItemRow {
  id: number
  request_id: number
  product_id: number | null
  product_name: string
  spec: string | null
  quantity: number
  unit_cost: number | null
  status: string
  returned_date: string | null
  conversion_value: number | null
  notes: string | null
}

const METHODS = [
  { value: 'meeting', label: '미팅' },
  { value: 'dm', label: '인스타 DM' },
  { value: 'phone', label: '전화 요청' },
  { value: 'email', label: '이메일' },
  { value: 'auto_curation', label: '자동 큐레이션' },
  { value: 'event', label: '전시·이벤트' },
]

const ITEM_STATUS = [
  { value: 'pending', label: '대기', color: 'bg-slate-100 text-slate-700' },
  { value: 'sent', label: '발송됨', color: 'bg-blue-100 text-blue-700' },
  { value: 'returned', label: '반환됨', color: 'bg-amber-100 text-amber-800' },
  { value: 'lost', label: '분실', color: 'bg-rose-100 text-rose-700' },
  { value: 'converted', label: '전환됨', color: 'bg-emerald-100 text-emerald-700' },
]

export default function SampleRequestForm({
  request,
  items,
  clients,
}: {
  request: RequestRow
  items: ItemRow[]
  clients: Array<{ id: number; name: string }>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [clientId, setClientId] = useState(String(request.client_id))
  const [requestDate, setRequestDate] = useState(request.request_date)
  const [method, setMethod] = useState(request.request_method ?? '')
  const [purpose, setPurpose] = useState(request.purpose ?? '')
  const [shipDate, setShipDate] = useState(request.ship_date ?? '')
  const [returnDue, setReturnDue] = useState(request.return_due_date ?? '')
  const [notes, setNotes] = useState(request.notes ?? '')

  const [adding, setAdding] = useState(false)

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updateSampleRequest({
        id: request.id,
        client_id: parseInt(clientId, 10),
        request_date: requestDate,
        request_method: method || null,
        purpose: purpose || null,
        ship_date: shipDate || null,
        return_due_date: returnDue || null,
        notes: notes || null,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      router.refresh()
    })
  }

  function handleStatus(status: string) {
    startTransition(async () => {
      const res = await setSampleRequestStatus(request.id, status)
      if (!res.ok) {
        setError(res.error ?? '상태 변경 실패')
        return
      }
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('이 샘플 요청을 삭제하시겠습니까? (모든 품목도 함께)')) return
    startTransition(async () => {
      const res = await deleteSampleRequest(request.id)
      if (!res.ok) {
        setError(res.error ?? '삭제 실패')
        return
      }
      router.push('/finance/operations/samples')
    })
  }

  return (
    <div className="space-y-4">
      {/* 상단 요약 + 상태 버튼 */}
      <Card>
        <CardContent className="space-y-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded px-2 py-1 text-xs font-bold',
                  request.status === 'pending' && 'bg-slate-100 text-slate-700',
                  request.status === 'shipped' && 'bg-blue-100 text-blue-700',
                  request.status === 'returned' && 'bg-amber-100 text-amber-800',
                  request.status === 'converted' && 'bg-emerald-100 text-emerald-700',
                  request.status === 'lost' && 'bg-rose-100 text-rose-700',
                )}
              >
                {request.status}
              </span>
              <span className="text-xs text-slate-500">
                품목 {request.total_items ?? 0}건 · 비용{' '}
                {formatKRW(Number(request.total_cost ?? 0))}
                {Number(request.conversion_value) > 0 && (
                  <span className="ml-2 font-semibold text-emerald-700">
                    · 전환 {formatKRW(Number(request.conversion_value))}
                  </span>
                )}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatus('shipped')}
                disabled={isPending || request.status === 'shipped'}
              >
                <Truck className="mr-1 h-3.5 w-3.5" />
                발송 완료
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatus('returned')}
                disabled={isPending}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                반환
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatus('converted')}
                disabled={isPending}
                className="text-emerald-700"
              >
                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                전환
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatus('lost')}
                disabled={isPending}
                className="text-rose-600"
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                분실
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 요청 정보 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">요청 정보</CardTitle>
            <Button size="sm" variant="ghost" onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="mr-1 h-3.5 w-3.5" />
                  저장
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>거래처 *</Label>
              <Select value={clientId} onValueChange={(v) => setClientId(v ?? clientId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>요청일</Label>
              <Input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>요청 경로</Label>
              <Select value={method} onValueChange={(v) => setMethod(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>목적</Label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="예: 봄 호텔 프로젝트 베이지 톤 큐레이션"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>발송일</Label>
              <Input
                type="date"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>반환 예정일</Label>
              <Input
                type="date"
                value={returnDue}
                onChange={(e) => setReturnDue(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="큐레이션 컨셉·스토리·디자이너 요청사항 등"
            />
          </div>
        </CardContent>
      </Card>

      {/* 품목 리스트 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">샘플 품목 ({items.length})</CardTitle>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              품목 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {adding && (
            <div className="mb-3">
              <ItemAddForm requestId={request.id} onClose={() => setAdding(false)} />
            </div>
          )}

          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              아직 품목이 없습니다. 위에서 추가하세요.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 삭제 */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          className="text-rose-600 hover:bg-rose-50"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          이 요청 삭제
        </Button>
      </div>
    </div>
  )
}

function ItemAddForm({ requestId, onClose }: { requestId: number; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [spec, setSpec] = useState('')
  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      await upsertSampleItem({
        request_id: requestId,
        product_name: name.trim(),
        spec: spec.trim() || null,
        quantity: parseInt(qty, 10) || 1,
        unit_cost: cost ? Number(cost) : 0,
      })
      onClose()
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-blue-200 bg-blue-50/30 p-3 space-y-2"
    >
      <div className="grid grid-cols-4 gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="제품명 *"
          className="col-span-2 h-8 text-xs"
        />
        <Input
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
          placeholder="규격"
          className="h-8 text-xs"
        />
        <Input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="수량"
          className="h-8 text-xs"
          min={1}
        />
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="단가 (원, 선택)"
          className="h-8 flex-1 text-xs"
        />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '추가'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={isPending}>
          취소
        </Button>
      </div>
    </form>
  )
}

function ItemRow({ item }: { item: ItemRow }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingConv, setEditingConv] = useState(false)
  const [convValue, setConvValue] = useState('')

  const status = ITEM_STATUS.find((s) => s.value === item.status) ?? ITEM_STATUS[0]
  const total = (item.unit_cost ?? 0) * (item.quantity ?? 1)

  function handleStatus(newStatus: string) {
    if (newStatus === 'converted') {
      setEditingConv(true)
      return
    }
    startTransition(async () => {
      await setSampleItemStatus(item.id, newStatus)
      router.refresh()
    })
  }

  function handleConvert() {
    startTransition(async () => {
      await setSampleItemStatus(item.id, 'converted', convValue ? Number(convValue) : 0)
      setEditingConv(false)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('이 품목을 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deleteSampleItem(item.id)
      router.refresh()
    })
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-white p-2 text-xs">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-800">
          {item.product_name}
          {item.spec && <span className="ml-1 text-slate-500">[{item.spec}]</span>}
        </div>
        <div className="text-[10px] text-slate-500">
          {item.quantity}개 ·{' '}
          {Number(item.unit_cost ?? 0) > 0 ? formatKRW(Number(item.unit_cost)) : '비용 미설정'}
          {Number(item.conversion_value ?? 0) > 0 && (
            <span className="ml-1 font-semibold text-emerald-700">
              · 전환 {formatKRW(Number(item.conversion_value))}
            </span>
          )}
        </div>
      </div>

      <span
        className={cn(
          'rounded px-1.5 py-0.5 text-[10px] font-semibold',
          status.color,
        )}
      >
        {status.label}
      </span>

      {editingConv ? (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={convValue}
            onChange={(e) => setConvValue(e.target.value)}
            placeholder="전환 매출 (원)"
            className="h-6 w-32 text-[11px]"
          />
          <Button size="sm" onClick={handleConvert} disabled={isPending} className="h-6 text-[10px]">
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : '저장'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingConv(false)}
            disabled={isPending}
            className="h-6 text-[10px]"
          >
            취소
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => handleStatus('sent')}
            disabled={isPending}
            className="rounded px-1 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50"
          >
            발송
          </button>
          <button
            type="button"
            onClick={() => handleStatus('returned')}
            disabled={isPending}
            className="rounded px-1 py-0.5 text-[10px] text-amber-700 hover:bg-amber-50"
          >
            반환
          </button>
          <button
            type="button"
            onClick={() => handleStatus('converted')}
            disabled={isPending}
            className="rounded px-1 py-0.5 text-[10px] text-emerald-700 hover:bg-emerald-50"
          >
            전환
          </button>
          <button
            type="button"
            onClick={() => handleStatus('lost')}
            disabled={isPending}
            className="rounded px-1 py-0.5 text-[10px] text-rose-700 hover:bg-rose-50"
          >
            분실
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded p-0.5 text-rose-500 hover:bg-rose-50"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </li>
  )
}
