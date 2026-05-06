'use client'
/**
 * Stage 5 — 추적 (30/90일 회고)
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  Save,
  AlertCircle,
  CheckCircle2,
  Archive,
} from 'lucide-react'
import {
  saveReview,
  archiveIntake,
} from '@/app/finance/operations/intake/actions'

interface ReviewRow {
  id: number
  review_kind: '30d' | '90d' | 'final'
  what_worked: string | null
  what_didnt: string | null
  lessons_learned: string | null
  measured_metrics: Record<string, number>
  reviewed_at: string
}

interface SampleRow {
  id: number
  arrival_date: string
  revenue_target_30d: number | null
  revenue_target_90d: number | null
}

interface Metrics {
  samples_sent: number
  samples_returned: number
  first_orders: number
  revenue_30d: number
  revenue_90d: number
}

interface Props {
  sample: SampleRow
  reviews: ReviewRow[]
  metrics: Metrics
}

export default function StageTracking({ sample, reviews, metrics }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [archivePending, setArchivePending] = useState(false)
  const [activeKind, setActiveKind] = useState<'30d' | '90d' | 'final'>('30d')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const reviewByKind = (k: string) => reviews.find((r) => r.review_kind === k)
  const r30 = reviewByKind('30d')
  const r90 = reviewByKind('90d')
  const rFinal = reviewByKind('final')
  const current = reviewByKind(activeKind)

  const arrivalDate = new Date(sample.arrival_date)
  const day30 = new Date(arrivalDate.getTime() + 30 * 24 * 60 * 60 * 1000)
  const day90 = new Date(arrivalDate.getTime() + 90 * 24 * 60 * 60 * 1000)
  const today = new Date()
  const daysSinceArrival = Math.floor(
    (today.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
  )

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await saveReview({
        sample_id: sample.id,
        review_kind: activeKind,
        what_worked: (fd.get('what_worked') as string) || undefined,
        what_didnt: (fd.get('what_didnt') as string) || undefined,
        lessons_learned: (fd.get('lessons_learned') as string) || undefined,
        measured_metrics: metrics as unknown as Record<string, number>,
      })
      setMsg({
        ok: res.ok,
        text: res.ok
          ? `${activeKind} 회고 저장 완료`
          : res.error ?? '저장 실패',
      })
      if (res.ok) router.refresh()
    })
  }

  const handleArchive = () => {
    if (!confirm('이 입고를 종결(archive)합니다. 칸반에서는 "종결" 영역으로 이동합니다. 계속할까요?')) return
    setArchivePending(true)
    ;(async () => {
      const res = await archiveIntake(sample.id)
      setArchivePending(false)
      if (res.ok) {
        router.refresh()
      } else {
        setMsg({ ok: false, text: res.error ?? '실패' })
      }
    })()
  }

  const target30Pct =
    sample.revenue_target_30d && sample.revenue_target_30d > 0
      ? (metrics.revenue_30d / sample.revenue_target_30d) * 100
      : null
  const target90Pct =
    sample.revenue_target_90d && sample.revenue_target_90d > 0
      ? (metrics.revenue_90d / sample.revenue_target_90d) * 100
      : null

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-slate-900">Stage 5 · 추적</h3>

      {/* 자동 측정 KPI */}
      <Card className="border-purple-200 bg-purple-50/30">
        <CardContent className="py-4">
          <p className="text-[11px] font-bold uppercase text-purple-700">
            자동 측정 KPI (입고 {daysSinceArrival}일 경과)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="샘플 발송" value={metrics.samples_sent.toString()} />
            <Metric
              label="샘플 회수/분실"
              value={metrics.samples_returned.toString()}
            />
            <Metric label="첫 거래 발생" value={metrics.first_orders.toString()} />
            <Metric
              label="30일 매출"
              value={metrics.revenue_30d.toLocaleString('ko-KR')}
              suffix="원"
              percent={target30Pct}
            />
            <Metric
              label="90일 매출"
              value={metrics.revenue_90d.toLocaleString('ko-KR')}
              suffix="원"
              percent={target90Pct}
            />
          </div>
        </CardContent>
      </Card>

      {/* 회고 탭 */}
      <div>
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { k: '30d' as const, label: `30일 (${day30.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })})`, done: !!r30 },
            { k: '90d' as const, label: `90일 (${day90.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })})`, done: !!r90 },
            { k: 'final' as const, label: '최종', done: !!rFinal },
          ].map((tab) => (
            <button
              key={tab.k}
              type="button"
              onClick={() => setActiveKind(tab.k)}
              className={`px-3 py-2 text-xs font-medium border-b-2 ${
                activeKind === tab.k
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tab.done && ' ✓'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-3" key={activeKind}>
          <div>
            <Label className="text-xs">잘 된 점 (what worked)</Label>
            <Textarea
              name="what_worked"
              defaultValue={current?.what_worked ?? ''}
              rows={3}
              placeholder="예: 인테리어 디자이너 5명 중 3명이 샘플 청구. 그 중 2명이 첫 거래."
            />
          </div>
          <div>
            <Label className="text-xs">안 된 점 (what didn&apos;t)</Label>
            <Textarea
              name="what_didnt"
              defaultValue={current?.what_didnt ?? ''}
              rows={3}
              placeholder="예: 소파 라인은 반응이 약했음. 원단 무게가 가구 양산에 부담."
            />
          </div>
          <div>
            <Label className="text-xs">학습 (다음 입고에 적용할 것)</Label>
            <Textarea
              name="lessons_learned"
              defaultValue={current?.lessons_learned ?? ''}
              rows={3}
              placeholder="예: 가벼운 리넨 라인은 커튼 스타일링 직군에 우선 배포. 가구 직군은 무게 명시 필요."
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            {activeKind} 회고 저장
          </Button>
        </form>
      </div>

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

      <div className="border-t border-slate-200 pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleArchive}
          disabled={archivePending}
          className="text-stone-700"
        >
          {archivePending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Archive className="mr-1 h-3.5 w-3.5" />
          )}
          입고 종결 (Archive)
        </Button>
        <p className="mt-1 text-[10px] text-slate-500">
          최종 회고가 끝나면 종결 처리. 학습은 칸반 &quot;종결&quot; 영역에 보존.
        </p>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  suffix,
  percent,
}: {
  label: string
  value: string
  suffix?: string
  percent?: number | null
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-bold text-slate-900">
        {value}
        {suffix && <span className="ml-0.5 text-[10px] font-normal text-slate-500">{suffix}</span>}
      </p>
      {percent != null && (
        <p
          className={`text-[10px] font-semibold ${
            percent >= 100
              ? 'text-emerald-600'
              : percent >= 50
                ? 'text-amber-600'
                : 'text-slate-500'
          }`}
        >
          목표 대비 {percent.toFixed(0)}%
        </p>
      )}
    </div>
  )
}
