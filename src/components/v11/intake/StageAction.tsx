'use client'
/**
 * Stage 4 — 실행 체크리스트
 * 자동 액션 버튼 + 수동 체크박스
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ExternalLink,
  Wand2,
  Megaphone,
  Send,
  Calendar,
  Home,
} from 'lucide-react'
import {
  toggleActionItem,
  actionCreateMarketingContent,
  actionCreateSampleRequests,
  actionCreateSlackAnnouncement,
} from '@/app/finance/operations/intake/actions'
import type { ActionKind } from '@/lib/v11-intake/types'

interface ActionItem {
  id: number
  label: string
  description: string | null
  action_kind: string
  action_url: string | null
  completed: boolean
  completed_at: string | null
  display_order: number
}

interface SampleRow {
  id: number
  name: string
  division: string | null
  recommended_tier: string | null
  product_name?: string
  recommended_occupations: string[] | null
  generated_material_ids: number[] | null
  content_item_ids: number[] | null
  sample_request_ids: number[] | null
  priority_client_ids: number[] | null
  marketing_angle: string | null
}

const ICON_BY_KIND: Record<string, typeof Wand2> = {
  manual: Circle,
  showroom: Home,
  sales_material: Wand2,
  marketing_content: Megaphone,
  sample_send: Send,
  wam: Calendar,
  slack: Send,
  asset: ExternalLink,
}

interface Props {
  sample: SampleRow
  items: ActionItem[]
}

export default function StageAction({ sample, items }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [actionPending, setActionPending] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleToggle = (item: ActionItem) => {
    const newState = !item.completed
    startTransition(async () => {
      const res = await toggleActionItem(item.id, newState)
      if (!res.ok) {
        setMsg({ ok: false, text: res.error ?? '실패' })
      } else {
        router.refresh()
      }
    })
  }

  // 자동 액션: 영업자료 생성 → 위저드 페이지로 이동 (쿼리스트링으로 미리 채움)
  const handleSalesMaterialAction = (item: ActionItem) => {
    const params = new URLSearchParams()
    params.set('product_name', sample.name)
    if (sample.recommended_tier) params.set('tier', sample.recommended_tier)
    if (sample.recommended_occupations?.[0])
      params.set('occupation', sample.recommended_occupations[0])
    params.set('intake_id', String(sample.id))
    router.push(`/finance/sales/materials/new?${params.toString()}`)
    handleToggle(item)
  }

  // 자동 액션: 마케팅 콘텐츠 카드 생성
  const handleMarketingAction = async (item: ActionItem) => {
    setMsg(null)
    setActionPending(`marketing-${item.id}`)
    const res = await actionCreateMarketingContent(sample.id)
    setActionPending(null)
    if (res.ok && res.content_id) {
      setMsg({
        ok: true,
        text: `마케팅 콘텐츠 카드 생성 완료. 마케팅 카테고리에서 편집하세요.`,
      })
      handleToggle(item)
    } else {
      setMsg({ ok: false, text: res.error ?? '실패' })
    }
  }

  // 자동 액션: 샘플 발송 등록
  const handleSampleSendAction = async (item: ActionItem) => {
    setMsg(null)
    setActionPending(`sample-${item.id}`)
    const res = await actionCreateSampleRequests(sample.id)
    setActionPending(null)
    if (res.ok) {
      setMsg({ ok: true, text: `샘플 요청 ${res.created}건 자동 등록 완료.` })
      handleToggle(item)
    } else {
      setMsg({ ok: false, text: res.error ?? '실패' })
    }
  }

  // 자동 액션: 슬랙 공지 등록
  const handleSlackAction = async (item: ActionItem) => {
    setMsg(null)
    setActionPending(`slack-${item.id}`)
    const res = await actionCreateSlackAnnouncement(sample.id)
    setActionPending(null)
    if (res.ok) {
      setMsg({
        ok: true,
        text: `슬랙 공지 등록 완료. 팀 공유 페이지에서 발송할 수 있습니다.`,
      })
      handleToggle(item)
    } else {
      setMsg({ ok: false, text: res.error ?? '실패' })
    }
  }

  // 자동 액션: WAM 안건 (현재는 메모만 — WAM 시스템과 별도 연계는 추후)
  const handleWamAction = (item: ActionItem) => {
    handleToggle(item)
    setMsg({
      ok: true,
      text: '체크 완료. WAM 페이지에서 안건을 직접 추가하세요. (자동 연계 v0.2)',
    })
  }

  const renderAction = (item: ActionItem) => {
    const kind = item.action_kind as ActionKind
    const isPending = actionPending?.startsWith(`${kind}-`) || actionPending?.includes(String(item.id))

    if (item.completed) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToggle(item)}
          className="h-7 text-xs text-emerald-600"
        >
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          완료
        </Button>
      )
    }

    if (kind === 'sales_material') {
      return (
        <Button size="sm" onClick={() => handleSalesMaterialAction(item)}>
          <Wand2 className="mr-1 h-3.5 w-3.5" />
          위저드 열기
        </Button>
      )
    }
    if (kind === 'marketing_content') {
      return (
        <Button
          size="sm"
          onClick={() => handleMarketingAction(item)}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Megaphone className="mr-1 h-3.5 w-3.5" />
          )}
          카드 생성
        </Button>
      )
    }
    if (kind === 'sample_send') {
      return (
        <Button
          size="sm"
          onClick={() => handleSampleSendAction(item)}
          disabled={isPending || (sample.priority_client_ids?.length ?? 0) === 0}
          title={
            (sample.priority_client_ids?.length ?? 0) === 0
              ? 'Stage 3에서 우선 거래처를 선택하세요'
              : ''
          }
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-1 h-3.5 w-3.5" />
          )}
          {sample.priority_client_ids?.length ?? 0}곳 등록
        </Button>
      )
    }
    if (kind === 'slack') {
      return (
        <Button size="sm" onClick={() => handleSlackAction(item)} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-1 h-3.5 w-3.5" />
          )}
          공지 등록
        </Button>
      )
    }
    if (kind === 'wam') {
      return (
        <Button size="sm" variant="outline" onClick={() => handleWamAction(item)}>
          <Calendar className="mr-1 h-3.5 w-3.5" />
          체크 + 메모
        </Button>
      )
    }

    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleToggle(item)}
        disabled={pending}
      >
        <Circle className="mr-1 h-3.5 w-3.5" />
        체크
      </Button>
    )
  }

  const completedCount = items.filter((i) => i.completed).length
  const totalCount = items.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">Stage 4 · 실행</h3>
        <span className="text-xs font-semibold text-emerald-700">
          {completedCount}/{totalCount} 완료
        </span>
      </div>

      <div className="h-2 rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{
            width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%',
          }}
        />
      </div>

      <p className="text-xs text-slate-500">
        모든 액션이 완료되면 자동으로 Stage 5 (추적) 으로 이동합니다.
      </p>

      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = ICON_BY_KIND[item.action_kind] ?? Circle
          return (
            <li
              key={item.id}
              className={`rounded-lg border p-3 ${
                item.completed
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    item.completed ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      item.completed ? 'text-slate-500 line-through' : 'text-slate-900'
                    }`}
                  >
                    {item.label}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                  )}
                </div>
                <div className="shrink-0">{renderAction(item)}</div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* 결과 표시 */}
      {(sample.generated_material_ids?.length ?? 0) > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          ✓ 영업자료 {sample.generated_material_ids?.length}건 생성
        </div>
      )}
      {(sample.content_item_ids?.length ?? 0) > 0 && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900">
          ✓ 마케팅 콘텐츠 카드 {sample.content_item_ids?.length}건 생성
        </div>
      )}
      {(sample.sample_request_ids?.length ?? 0) > 0 && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          ✓ 샘플 요청 {sample.sample_request_ids?.length}건 자동 등록
        </div>
      )}

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
            msg.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  )
}
