/**
 * 입고 워크플로우 — 샘플 상세 (단계 진행)
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  ChevronLeft,
  PackageOpen,
  Inbox,
  ClipboardList,
  Target,
  Zap,
  Activity,
  Archive,
  BookOpen,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import StageEvaluation from '@/components/v11/intake/StageEvaluation'
import StagePlan from '@/components/v11/intake/StagePlan'
import StageAction from '@/components/v11/intake/StageAction'
import StageTracking from '@/components/v11/intake/StageTracking'
import type { Stage } from '@/lib/v11-intake/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STAGES: { key: Stage; label: string; icon: typeof Inbox }[] = [
  { key: 'arrived', label: '1 입고', icon: Inbox },
  { key: 'evaluating', label: '2 평가', icon: ClipboardList },
  { key: 'planned', label: '3 기획', icon: Target },
  { key: 'in_action', label: '4 실행', icon: Zap },
  { key: 'tracking', label: '5 추적', icon: Activity },
  { key: 'archived', label: '종결', icon: Archive },
]

const TIER_BG: Record<string, string> = {
  value: 'bg-blue-100 text-blue-800',
  mid: 'bg-slate-100 text-slate-800',
  premium: 'bg-amber-100 text-amber-800',
  luxury: 'bg-stone-900 text-stone-100',
}

const DIVISION_LABEL: Record<string, string> = {
  sofa: '소파',
  curtain: '커튼',
  wall: '벽',
  accessory: '소품',
}

const OCCUPATION_LABEL: Record<string, string> = {
  interior_project: '인테리어 프로젝트',
  brand_furniture: '브랜드 가구',
  project_furniture: '프로젝트 가구',
  commercial_reupholster: '천갈이',
  curtain_styling: '커튼 스타일링',
  display: '디스플레이',
}

async function loadData(id: number) {
  const supabase = await createClient()
  const [sampleQ, actionsQ, reviewsQ, clientsQ, playbookQ] = await Promise.all([
    supabase.from('incoming_samples').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('intake_action_items')
      .select('*')
      .eq('sample_id', id)
      .order('display_order'),
    supabase
      .from('intake_performance_reviews')
      .select('*')
      .eq('sample_id', id),
    supabase
      .from('clients')
      .select('id, name, occupation, tier, active')
      .eq('active', true)
      .order('name')
      .limit(500),
    supabase
      .from('sample_intake_playbook')
      .select('recommended_actions, notes')
      .eq('active', true),
  ])

  if (!sampleQ.data) return null

  // 우선 거래처 추천: 24셀 매칭
  const sample = sampleQ.data
  const allClients = clientsQ.data ?? []
  const recommendedClients = allClients
    .filter((c) => {
      if (!sample.recommended_occupations) return false
      const occs = sample.recommended_occupations as string[]
      return occs.includes(c.occupation ?? '')
    })
    .filter((c) => c.tier === sample.recommended_tier || !sample.recommended_tier)
    .slice(0, 8)

  // 매칭 플레이북 (Stage 4 가이드)
  const matchingPlaybook =
    sample.recommended_tier && sample.division && sample.recommended_occupations?.length
      ? (await supabase
          .from('sample_intake_playbook')
          .select('recommended_actions, notes')
          .eq('division', sample.division)
          .eq('tier', sample.recommended_tier)
          .in(
            'occupation',
            (sample.recommended_occupations as string[]).slice(0, 3),
          )
          .eq('active', true)
          .limit(3)).data ?? []
      : []

  // Stage 5: 자동 측정 KPI
  let metrics = {
    samples_sent: 0,
    samples_returned: 0,
    first_orders: 0,
    revenue_30d: 0,
    revenue_90d: 0,
  }

  if (sample.priority_client_ids && (sample.priority_client_ids as number[]).length > 0) {
    const clientIds = sample.priority_client_ids as number[]
    const sampleReqIds = sample.sample_request_ids as number[] | null

    if (sampleReqIds && sampleReqIds.length > 0) {
      const { data: sentReqs } = await supabase
        .from('sample_requests')
        .select('status')
        .in('id', sampleReqIds)
      metrics.samples_sent = sentReqs?.length ?? 0
      metrics.samples_returned =
        sentReqs?.filter((s) => s.status === 'returned' || s.status === 'lost').length ?? 0
    }

    const arrivalDate = new Date(sample.arrival_date)
    const day30 = new Date(arrivalDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    const day90 = new Date(arrivalDate.getTime() + 90 * 24 * 60 * 60 * 1000)

    const { data: tx } = await supabase
      .from('transactions')
      .select('total_amount, transaction_date, client_id')
      .in('client_id', clientIds)
      .gte('transaction_date', sample.arrival_date)
      .lte('transaction_date', day90.toISOString().slice(0, 10))
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid'])

    if (tx && tx.length > 0) {
      const day30Str = day30.toISOString().slice(0, 10)
      metrics.revenue_30d = tx
        .filter((t) => t.transaction_date <= day30Str)
        .reduce((s, t) => s + Number(t.total_amount || 0), 0)
      metrics.revenue_90d = tx.reduce((s, t) => s + Number(t.total_amount || 0), 0)
      metrics.first_orders = new Set(tx.map((t) => t.client_id)).size
    }
  }

  return {
    sample,
    actions: actionsQ.data ?? [],
    reviews: reviewsQ.data ?? [],
    allClients,
    recommendedClients,
    matchingPlaybook,
    metrics,
  }
}

export default async function IntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numId = Number(id)
  if (Number.isNaN(numId)) notFound()

  const data = await loadData(numId)
  if (!data) notFound()

  const m = data.sample
  const stage = (m.stage as Stage) ?? 'arrived'
  const stageIndex = STAGES.findIndex((s) => s.key === stage)

  return (
    <div className="space-y-6">
      <Link
        href="/finance/operations/intake"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        입고 워크플로우 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #10 입고 · ID {m.id}
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <PackageOpen className="h-5 w-5 text-slate-500" />
          {m.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {m.source === 'overseas' ? '🌍 해외' : '🇰🇷 국내'}
          {m.supplier && ` · ${m.supplier}`}
          {' · 입고 '}
          {m.arrival_date}
          {' · 수량 '}
          {m.sample_count} {m.unit}
        </p>
      </div>

      {/* 스텝 인디케이터 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2">
            {STAGES.map((s, i) => {
              const Icon = s.icon
              const isActive = stage === s.key
              const isPast = i < stageIndex
              return (
                <div key={s.key} className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      isActive
                        ? 'bg-amber-600 text-white shadow-md ring-4 ring-amber-200'
                        : isPast
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={`text-[10px] font-semibold ${
                      isActive
                        ? 'text-amber-700'
                        : isPast
                          ? 'text-emerald-700'
                          : 'text-slate-400'
                    } hidden md:inline`}
                  >
                    {s.label}
                  </span>
                  {i < STAGES.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 ${
                        isPast ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 메타 요약 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] font-semibold uppercase text-slate-500">티어</p>
            {m.recommended_tier ? (
              <span
                className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-bold ${
                  TIER_BG[m.recommended_tier]
                }`}
              >
                {m.recommended_tier}
              </span>
            ) : (
              <p className="mt-1 text-xs text-slate-400 italic">미정</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] font-semibold uppercase text-slate-500">
              제품군
            </p>
            <p className="mt-1 text-sm font-bold">
              {m.division ? DIVISION_LABEL[m.division] : '미정'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] font-semibold uppercase text-slate-500">
              경쟁력
            </p>
            <p className="mt-1 text-sm font-bold">
              {m.competitive_score ? '★'.repeat(m.competitive_score) : '미평가'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] font-semibold uppercase text-slate-500">소재</p>
            <p className="mt-1 text-sm font-bold truncate">{m.material ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      {(m.colors as string[])?.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <span className="text-[11px] font-semibold uppercase text-slate-500">
            컬러:
          </span>
          {(m.colors as string[]).map((c) => (
            <span
              key={c}
              className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {m.differentiator && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="py-3">
            <p className="text-[10px] font-bold uppercase text-amber-700">
              차별화 포인트
            </p>
            <p className="mt-1 text-sm text-amber-900">{m.differentiator}</p>
          </CardContent>
        </Card>
      )}

      {/* 매칭 플레이북 표시 (Stage 4 시) */}
      {stage === 'in_action' && data.matchingPlaybook.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-3.5 w-3.5 text-blue-600" />
              매칭 플레이북 (24셀 표준 행동 요령)
            </CardTitle>
            <CardDescription className="text-xs">
              이 24셀×티어 조합에 추천되는 표준 액션
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.matchingPlaybook.map((p, i) => (
              <div key={i} className="rounded-md border border-blue-200 bg-white p-3">
                {p.notes && (
                  <p className="mb-2 text-xs italic text-slate-600">{p.notes}</p>
                )}
                <ul className="space-y-1 text-xs text-slate-700">
                  {(p.recommended_actions as string[]).map((a, j) => (
                    <li key={j} className="flex items-start gap-1">
                      <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-blue-500" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 단계별 폼 */}
      <Card>
        <CardContent className="py-5">
          {(stage === 'arrived' || stage === 'evaluating') && (
            <StageEvaluation sample={m} />
          )}
          {stage === 'planned' && (
            <StagePlan
              sample={m}
              recommendedClients={data.recommendedClients}
              allClients={data.allClients}
            />
          )}
          {stage === 'in_action' && (
            <StageAction sample={m} items={data.actions} />
          )}
          {(stage === 'tracking' || stage === 'archived') && (
            <StageTracking
              sample={m}
              reviews={
                data.reviews as unknown as Array<{
                  id: number
                  review_kind: '30d' | '90d' | 'final'
                  what_worked: string | null
                  what_didnt: string | null
                  lessons_learned: string | null
                  measured_metrics: Record<string, number>
                  reviewed_at: string
                }>
              }
              metrics={data.metrics}
            />
          )}
        </CardContent>
      </Card>

      {/* 적합 직업군 표시 (참고) */}
      {(m.recommended_occupations as string[])?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">적합 직업군 (AI 추천)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {(m.recommended_occupations as string[]).map((o) => (
                <li
                  key={o}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {OCCUPATION_LABEL[o] ?? o}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {m.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">메모</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{m.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
