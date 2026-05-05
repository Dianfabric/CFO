/**
 * 거래처 360도 뷰 (Phase 2 #2a ②)
 *
 * 한 거래처의 모든 영업 데이터 통합:
 * - 프로필 (24셀, 등급, 라이프사이클, Dream 100)
 * - 활동 이력 (sales_activities)
 * - 거래 이력 (transactions)
 * - 미수금 현황
 * - 단계 전환 이력
 * - 거절 사유
 * - 니즈 카드
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
  Trophy,
  Phone,
  AlertCircle,
  TrendingUp,
  Calendar,
  Mail,
  User as UserIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  SALES_STAGE_LABEL,
  SALES_STAGE_COLOR,
  CLIENT_TIER_COLOR,
  CLIENT_TIER_LABEL,
  LIFECYCLE_LABEL,
  LIFECYCLE_COLOR,
  SALES_ACTIVITY_LABEL,
  OBJECTION_LABEL,
  segmentLabel,
} from '@/lib/v11-labels'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import StageChangeButton from '@/components/v11/sales/StageChangeButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientView360Page({ params }: PageProps) {
  const { id } = await params
  const clientId = parseInt(id, 10)
  if (!Number.isFinite(clientId)) notFound()

  const supabase = await createClient()

  const [clientRes, activitiesRes, transactionsRes, transitionsRes, objectionsRes, needsRes] =
    await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
      supabase
        .from('sales_activities')
        .select('*')
        .eq('client_id', clientId)
        .order('activity_date', { ascending: false })
        .limit(50),
      supabase
        .from('transactions')
        .select(
          'id, transaction_date, total_amount, total_cost, margin_amount, stage, payment_received_amount, payment_due_date',
        )
        .eq('client_id', clientId)
        .order('transaction_date', { ascending: false })
        .limit(20),
      supabase
        .from('stage_transitions')
        .select('*')
        .eq('client_id', clientId)
        .order('transition_date', { ascending: false })
        .limit(10),
      supabase
        .from('sales_objections')
        .select('*')
        .eq('client_id', clientId)
        .order('occurred_at', { ascending: false })
        .limit(10),
      supabase
        .from('need_cards')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

  if (clientRes.error || !clientRes.data) {
    return (
      <div className="space-y-4">
        <Link
          href="/finance/clients"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-3 w-3" />
          거래처 관리
        </Link>
        <p className="text-sm text-rose-600">
          거래처를 찾을 수 없습니다. {clientRes.error?.message}
        </p>
      </div>
    )
  }

  const c = clientRes.data
  const activities = activitiesRes.data ?? []
  const transactions = transactionsRes.data ?? []
  const transitions = transitionsRes.data ?? []
  const objections = objectionsRes.data ?? []
  const needs = needsRes.data ?? []

  // 거래 통계
  const totalRevenue = transactions.reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const totalMargin = transactions.reduce((s, t) => s + Number(t.margin_amount || 0), 0)
  const outstanding = transactions.reduce((s, t) => {
    const out = Number(t.total_amount || 0) - Number(t.payment_received_amount || 0)
    return s + Math.max(0, out)
  }, 0)

  return (
    <div className="space-y-6">
      <Link
        href="/finance/clients"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        거래처 관리
      </Link>

      {/* 헤더: 거래처 프로필 */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                v1.1 · #2a ② 360도 뷰
              </span>
            </div>
            <div className="flex items-center gap-2">
              {c.dream100 && <Trophy className="h-5 w-5 text-amber-500" />}
              <h1 className="text-2xl font-bold text-slate-900">{c.name}</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {segmentLabel(c.occupation, c.primary_division)}
              {c.tier && (
                <>
                  {' · '}
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                      CLIENT_TIER_COLOR[c.tier] ?? 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {CLIENT_TIER_LABEL[c.tier] ?? c.tier}
                  </span>
                </>
              )}
              {c.lifecycle_stage && (
                <>
                  {' · '}
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                      LIFECYCLE_COLOR[c.lifecycle_stage] ?? 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {LIFECYCLE_LABEL[c.lifecycle_stage] ?? c.lifecycle_stage}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* 7단계 + 변경 버튼 */}
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">현재 7단계:</span>
              <span
                className={cn(
                  'rounded px-2 py-1 text-xs font-bold',
                  SALES_STAGE_COLOR[c.current_stage ?? ''] ?? 'bg-slate-100 text-slate-600',
                )}
              >
                {SALES_STAGE_LABEL[c.current_stage ?? ''] ?? '미설정'}
              </span>
              <span className="text-[11px] text-slate-400">
                마지막 컨택: {c.last_contact_date ?? '없음'}
              </span>
            </div>
            <StageChangeButton
              clientId={c.id}
              clientName={c.name}
              currentStage={c.current_stage}
            />
          </CardContent>
        </Card>
      </div>

      {/* KPI 4개 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="누적 매출" value={formatKRW(totalRevenue)} icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} />
        <KPI
          label="누적 공헌이익"
          value={formatKRW(totalMargin)}
          hint={
            totalRevenue > 0
              ? `마진 ${((totalMargin / totalRevenue) * 100).toFixed(1)}%`
              : ''
          }
        />
        <KPI label="거래 건수" value={String(transactions.length)} hint="최근 20건" />
        <KPI
          label="미수금"
          value={formatKRW(outstanding)}
          tone={outstanding > 0 ? 'rose' : 'default'}
          icon={
            outstanding > 0 ? <AlertCircle className="h-4 w-4 text-rose-500" /> : undefined
          }
        />
      </div>

      {/* 연락처 */}
      {(c.contact_person || c.contact_phone || c.contact_email) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">연락처</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
              {c.contact_person && (
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-slate-400" />
                  <span>{c.contact_person}</span>
                </div>
              )}
              {c.contact_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{c.contact_phone}</span>
                </div>
              )}
              {c.contact_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span>{c.contact_email}</span>
                </div>
              )}
            </div>
            {c.notes && (
              <p className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                💬 {c.notes}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 활동 이력 + 거래 이력 (2열) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">영업 활동 이력 ({activities.length})</CardTitle>
            <CardDescription>최근 50건</CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">활동 없음</p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {activities.map((a) => (
                  <li key={a.id} className="border-b last:border-0 pb-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-700">
                        {SALES_ACTIVITY_LABEL[a.activity_type] ?? a.activity_type}
                      </span>
                      <span className="text-slate-500">{a.activity_date}</span>
                      {Number(a.value_generated) > 0 && (
                        <span className="text-emerald-600 tabular-nums">
                          +{formatKRW(Number(a.value_generated))}
                        </span>
                      )}
                    </div>
                    {a.outcome && (
                      <p className="mt-0.5 text-slate-700">{a.outcome}</p>
                    )}
                    {a.next_action && (
                      <p className="mt-0.5 text-[11px] text-blue-700">
                        → 다음: {a.next_action} {a.next_action_date && `(${a.next_action_date})`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">거래 이력 ({transactions.length})</CardTitle>
            <CardDescription>최근 20건</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">거래 없음</p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {transactions.map((t) => {
                  const out =
                    Number(t.total_amount || 0) - Number(t.payment_received_amount || 0)
                  return (
                    <li key={t.id} className="border-b last:border-0 pb-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">
                          <Calendar className="mr-0.5 inline h-3 w-3" />
                          {t.transaction_date}
                        </span>
                        <span className="text-[10px] uppercase text-slate-500">
                          {t.stage}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-700 tabular-nums">
                          매출 {formatKRW(Number(t.total_amount))}
                        </span>
                        {out > 0 && (
                          <span className="text-rose-600 tabular-nums">
                            미수 {formatKRW(out)}
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 단계 전환 + 거절 사유 + 니즈 카드 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">단계 전환 이력</CardTitle>
          </CardHeader>
          <CardContent>
            {transitions.length === 0 ? (
              <p className="text-center text-sm text-slate-400">없음</p>
            ) : (
              <ul className="space-y-1.5 text-[11px]">
                {transitions.map((t) => (
                  <li key={t.id} className="text-slate-700">
                    <span className="text-slate-400">{t.transition_date}:</span>{' '}
                    {SALES_STAGE_LABEL[t.from_stage ?? '']?.split('. ')[1] ?? '-'} →{' '}
                    <strong>
                      {SALES_STAGE_LABEL[t.to_stage]?.split('. ')[1] ?? t.to_stage}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">거절 사유</CardTitle>
          </CardHeader>
          <CardContent>
            {objections.length === 0 ? (
              <p className="text-center text-sm text-slate-400">없음</p>
            ) : (
              <ul className="space-y-1.5 text-[11px]">
                {objections.map((o) => (
                  <li key={o.id} className="text-slate-700">
                    <span
                      className={cn(
                        'mr-1 rounded px-1 py-0.5 text-[10px] font-semibold',
                        o.resolved
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700',
                      )}
                    >
                      {OBJECTION_LABEL[o.kind] ?? o.kind}
                    </span>
                    {o.description ?? '-'}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">니즈 카드</CardTitle>
          </CardHeader>
          <CardContent>
            {needs.length === 0 ? (
              <p className="text-center text-sm text-slate-400">없음</p>
            ) : (
              <ul className="space-y-1.5 text-[11px]">
                {needs.map((n) => (
                  <li key={n.id} className="text-slate-700">
                    <span className="rounded bg-purple-100 px-1 py-0.5 text-[10px] font-semibold text-purple-700">
                      {n.category ?? '기타'}
                    </span>{' '}
                    {n.description}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KPI({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'rose'
  icon?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">{label}</span>
          {icon}
        </div>
        <div
          className={cn(
            'text-2xl font-bold tabular-nums',
            tone === 'rose' ? 'text-rose-700' : 'text-slate-900',
          )}
        >
          {value}
        </div>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </CardContent>
    </Card>
  )
}
