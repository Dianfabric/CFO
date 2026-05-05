'use client'
/**
 * 거래처 편집 다이얼로그 (24셀 매핑 + 기본 정보)
 *
 * key prop으로 다이얼로그를 강제 remount 시켜 폼 초기값을 깔끔하게 처리.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save, AlertCircle } from 'lucide-react'
import {
  OCCUPATION_LABEL,
  OCCUPATION_VALUES,
  DIVISION_LABEL,
  DIVISION_VALUES,
  CLIENT_TIER_LABEL,
  CLIENT_TIER_VALUES,
} from '@/lib/v11-labels'
import { updateClient } from '@/app/finance/clients/actions'

export interface ClientRow {
  id: number
  name: string
  occupation: string | null
  primary_division: string | null
  tier: string | null
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  payment_terms_days: number | null
  notes: string | null
}

const NONE_VALUE = '__none__'

export default function ClientEditDialog({
  client,
  open,
  onOpenChange,
}: {
  client: ClientRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!client) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {/* key=client.id 로 다이얼로그 내용을 매번 새로 마운트 → 폼 초기값 자동 리셋 */}
        <ClientEditFormBody key={client.id} client={client} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ClientEditFormBody({
  client,
  onClose,
}: {
  client: ClientRow
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(client.name ?? '')
  const [occupation, setOccupation] = useState<string>(client.occupation ?? NONE_VALUE)
  const [division, setDivision] = useState<string>(client.primary_division ?? NONE_VALUE)
  const [tier, setTier] = useState<string>(client.tier ?? NONE_VALUE)
  const [contactPerson, setContactPerson] = useState(client.contact_person ?? '')
  const [contactPhone, setContactPhone] = useState(client.contact_phone ?? '')
  const [paymentTerms, setPaymentTerms] = useState<string>(
    String(client.payment_terms_days ?? 30),
  )
  const [notes, setNotes] = useState(client.notes ?? '')

  const occChanged = (client.occupation ?? null) !== (occupation === NONE_VALUE ? null : occupation)
  const divChanged =
    (client.primary_division ?? null) !== (division === NONE_VALUE ? null : division)
  const segmentWillChange = occChanged || divChanged

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await updateClient({
        id: client.id,
        name: name.trim(),
        occupation: occupation === NONE_VALUE ? null : occupation,
        primary_division: division === NONE_VALUE ? null : division,
        tier: tier === NONE_VALUE ? null : tier,
        contact_person: contactPerson.trim() || null,
        contact_phone: contactPhone.trim() || null,
        payment_terms_days: parseInt(paymentTerms) || 30,
        notes: notes.trim() || null,
      })
      if (!res.ok) {
        setError(res.error ?? '저장에 실패했습니다.')
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>거래처 편집</DialogTitle>
        <DialogDescription>
          24셀 매핑(직업군 × 제품군)을 정확히 설정하면 매출 분석이 의미 있어집니다.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 거래처명 */}
        <div className="space-y-1.5">
          <Label htmlFor="cli-name">거래처명</Label>
          <Input
            id="cli-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* 24셀 매핑 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>직업군</Label>
            <Select value={occupation} onValueChange={(v) => setOccupation(v ?? NONE_VALUE)}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>(미설정)</SelectItem>
                {OCCUPATION_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {OCCUPATION_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>주력 제품군</Label>
            <Select value={division} onValueChange={(v) => setDivision(v ?? NONE_VALUE)}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>(미설정)</SelectItem>
                {DIVISION_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {DIVISION_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {segmentWillChange && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            ℹ️ 24셀 매핑이 변경됩니다. 이 거래처의 <strong>이후 거래</strong>부터 새 매핑이
            적용됩니다 (트리거가 BEFORE INSERT 시 채움). 과거 거래는 별도 재매핑 작업이 필요합니다.
          </div>
        )}

        {/* 등급 + 결제조건 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>등급</Label>
            <Select value={tier} onValueChange={(v) => setTier(v ?? NONE_VALUE)}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>(미설정)</SelectItem>
                {CLIENT_TIER_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {CLIENT_TIER_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cli-payment">결제 조건 (일)</Label>
            <Input
              id="cli-payment"
              type="number"
              min={0}
              max={365}
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
          </div>
        </div>

        {/* 연락처 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cli-contact">담당자</Label>
            <Input
              id="cli-contact"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cli-phone">전화</Label>
            <Input
              id="cli-phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
        </div>

        {/* 메모 */}
        <div className="space-y-1.5">
          <Label htmlFor="cli-notes">메모</Label>
          <Input
            id="cli-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="예: 25년 봄 인테리어 큐레이션 프로젝트 진행"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                저장
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
