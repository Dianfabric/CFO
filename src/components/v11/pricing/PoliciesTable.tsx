'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
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
import { Plus, Trash2, Loader2, X } from 'lucide-react'
import { upsertPricingPolicy, deletePricingPolicy } from '@/app/finance/pricing/actions'
import { PRICE_TIER_LABEL, DIVISION_LABEL } from '@/lib/v11-labels'
import { cn } from '@/lib/utils'

export interface PolicyRow {
  id: number
  client_id: number
  line_id: number
  discount_rate: number
  notes: string | null
  effective_from: string | null
  clients: { name: string } | null
  product_lines: { name: string; tier: string; division: string; brand_name: string | null } | null
}

interface ClientLite {
  id: number
  name: string
}
interface LineLite {
  id: number
  name: string
  tier: string
  division: string
  brand_name: string | null
}

export default function PoliciesTable({
  policies,
  clients,
  lines,
}: {
  policies: PolicyRow[]
  clients: ClientLite[]
  lines: LineLite[]
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          정책 추가
        </Button>
      </div>

      {adding && (
        <PolicyForm clients={clients} lines={lines} onClose={() => setAdding(false)} />
      )}

      <Card>
        <CardContent className="p-0">
          {policies.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">
              아직 거래처별 가격 정책이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="px-3 py-2 text-left">거래처</th>
                    <th className="px-3 py-2 text-left">제품 라인</th>
                    <th className="px-3 py-2 text-left">티어</th>
                    <th className="px-3 py-2 text-right">할인율</th>
                    <th className="px-3 py-2 text-left">메모</th>
                    <th className="px-3 py-2 text-right">시행일</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((p) => (
                    <PolicyRowItem key={p.id} policy={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PolicyRowItem({ policy }: { policy: PolicyRow }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [discount, setDiscount] = useState(String(policy.discount_rate))
  const [notes, setNotes] = useState(policy.notes ?? '')

  function handleSave() {
    startTransition(async () => {
      const res = await upsertPricingPolicy({
        id: policy.id,
        client_id: policy.client_id,
        line_id: policy.line_id,
        discount_rate: Number(discount),
        notes: notes || null,
      })
      if (res.ok) {
        setEditing(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!confirm('이 정책을 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deletePricingPolicy(policy.id)
      router.refresh()
    })
  }

  const isLuxury = policy.product_lines?.tier === 'luxury'

  return (
    <tr className={cn('border-b last:border-0', isLuxury && Number(discount) > 0 && 'bg-rose-50/30')}>
      <td className="px-3 py-1.5 font-medium text-slate-700">
        {policy.clients?.name ?? `#${policy.client_id}`}
      </td>
      <td className="px-3 py-1.5">
        <div className="font-medium text-slate-800">
          {policy.product_lines?.name}
          {policy.product_lines?.brand_name && (
            <span className="ml-1 text-slate-400">({policy.product_lines.brand_name})</span>
          )}
        </div>
        <div className="text-[10px] text-slate-500">
          {DIVISION_LABEL[policy.product_lines?.division ?? ''] ?? '—'}
        </div>
      </td>
      <td className="px-3 py-1.5">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold',
            policy.product_lines?.tier === 'luxury'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-700',
          )}
        >
          {PRICE_TIER_LABEL[policy.product_lines?.tier ?? ''] ?? policy.product_lines?.tier}
        </span>
      </td>
      <td className="px-3 py-1.5 text-right">
        {editing ? (
          <Input
            type="number"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="h-7 w-20 text-xs text-right"
          />
        ) : (
          <span
            className={cn(
              'tabular-nums font-semibold',
              Number(policy.discount_rate) > 0 ? 'text-blue-700' : 'text-slate-400',
            )}
          >
            {Number(policy.discount_rate).toFixed(1)}%
          </span>
        )}
        {isLuxury && Number(policy.discount_rate) > 0 && (
          <div className="text-[9px] text-rose-600">⚠ 럭셔리 할인</div>
        )}
      </td>
      <td className="px-3 py-1.5 text-slate-600">
        {editing ? (
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-7 text-xs"
          />
        ) : (
          <span className="line-clamp-1">{policy.notes ?? '—'}</span>
        )}
      </td>
      <td className="px-3 py-1.5 text-right text-[10px] text-slate-500 tabular-nums">
        {policy.effective_from ?? '—'}
      </td>
      <td className="px-3 py-1.5 text-right">
        {editing ? (
          <div className="flex gap-1 justify-end">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              className="h-6 px-2 text-[10px]"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : '저장'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={isPending}
              className="h-6 px-2 text-[10px]"
            >
              취소
            </Button>
          </div>
        ) : (
          <div className="flex gap-1 justify-end">
            <button
              onClick={() => setEditing(true)}
              disabled={isPending}
              className="rounded px-2 py-1 text-[10px] text-blue-600 hover:bg-blue-50"
            >
              편집
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded p-1 text-rose-500 hover:bg-rose-50"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

function PolicyForm({
  clients,
  lines,
  onClose,
}: {
  clients: ClientLite[]
  lines: LineLite[]
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [lineId, setLineId] = useState('')
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cid = parseInt(clientId, 10)
    const lid = parseInt(lineId, 10)
    if (!Number.isFinite(cid) || !Number.isFinite(lid)) {
      setError('거래처와 제품 라인을 선택해 주세요.')
      return
    }

    const selectedLine = lines.find((l) => l.id === lid)
    if (selectedLine?.tier === 'luxury' && Number(discount) > 0) {
      if (!confirm('럭셔리 라인에 할인을 적용하려고 합니다. PRD #4 정책상 럭셔리는 할인 절대 금지입니다. 계속 하시겠습니까?')) {
        return
      }
    }

    startTransition(async () => {
      const res = await upsertPricingPolicy({
        client_id: cid,
        line_id: lid,
        discount_rate: Number(discount) || 0,
        notes: notes || null,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">새 가격 정책</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>거래처 *</Label>
              <Select value={clientId} onValueChange={(v) => setClientId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
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
              <Label>제품 라인 *</Label>
              <Select value={lineId} onValueChange={(v) => setLineId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {lines.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {PRICE_TIER_LABEL[l.tier]} · {l.name}
                      {l.brand_name && ` (${l.brand_name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>할인율 (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="예: 5"
            />
          </div>

          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="이 정책의 근거·계약 조건"
            />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '저장'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
