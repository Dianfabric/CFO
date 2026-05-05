/**
 * 활동 다이어리 (Phase 2 #2a ①)
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  SALES_ACTIVITY_LABEL,
  SALES_STAGE_LABEL,
  SALES_STAGE_COLOR,
} from '@/lib/v11-labels'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import ActivityForm from '@/components/v11/sales/ActivityForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ActivityRow {
  id: number
  activity_type: string
  activity_date: string
  duration_minutes: number | null
  outcome: string | null
  value_generated: number | null
  next_action: string | null
  next_action_date: string | null
  stage_before: string | null
  stage_after: string | null
  notes: string | null
  client_id: number
  clients: { name: string } | null
}

async function loadData() {
  try {
    const supabase = await createClient()

    const [actsRes, clientsRes] = await Promise.all([
      supabase
        .from('sales_activities')
        .select(
          'id, activity_type, activity_date, duration_minutes, outcome, value_generated, next_action, next_action_date, stage_before, stage_after, notes, client_id, clients!inner(name)',
        )
        .order('activity_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(100),
      supabase
        .from('clients')
        .select('id, name, current_stage')
        .eq('active', true)
        .order('name'),
    ])

    return {
      activities: ((actsRes.data ?? []) as unknown) as ActivityRow[],
      clients: clientsRes.data ?? [],
      errors: [actsRes.error, clientsRes.error].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      activities: [] as ActivityRow[],
      clients: [],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function ActivitiesPage() {
  const data = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/sales"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        영업 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2a ① 활동 다이어리
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">영업 활동 다이어리</h1>
        <p className="mt-1 text-sm text-slate-500">
          모든 활동(전화·미팅·샘플)을 기록하면 AI가 패턴을 학습합니다. 단계 전환은 자동으로
          거래처 7단계에 반영됩니다.
        </p>
      </div>

      {data.errors.length > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                {data.errors.slice(0, 2).map((e, i) => (
                  <div key={i}>{e.message}</div>
                ))}
                <p className="mt-1 text-xs">
                  스키마 적용이 필요할 수 있습니다 — Supabase에 v11.1_sales_strategy.sql 적용 후
                  재시도.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 입력 폼 (항상 노출) */}
      <ActivityForm clients={data.clients} />

      {/* 활동 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>활동 이력 (최근 100건)</CardTitle>
          <CardDescription>
            본인 또는 CEO·임원이 등록한 활동 (RLS 적용)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.activities.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">
              아직 영업 활동이 없습니다. 위 폼에서 첫 활동을 기록하세요.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="px-3 py-2 text-left">날짜</th>
                    <th className="px-3 py-2 text-left">거래처</th>
                    <th className="px-3 py-2 text-left">유형</th>
                    <th className="px-3 py-2 text-left">단계 변동</th>
                    <th className="px-3 py-2 text-left">결과</th>
                    <th className="px-3 py-2 text-right">발생 매출</th>
                    <th className="px-3 py-2 text-left">다음 행동</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activities.map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-1.5 text-slate-600">{a.activity_date}</td>
                      <td className="px-3 py-1.5 font-medium text-slate-700">
                        {a.clients?.name ?? `#${a.client_id}`}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                          {SALES_ACTIVITY_LABEL[a.activity_type] ?? a.activity_type}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        {a.stage_after &&
                        a.stage_before &&
                        a.stage_after !== a.stage_before ? (
                          <span className="text-[10px]">
                            <span className="text-slate-500">
                              {SALES_STAGE_LABEL[a.stage_before]?.split('. ')[1] ??
                                a.stage_before}
                            </span>{' '}
                            →{' '}
                            <span
                              className={cn(
                                'rounded px-1 py-0.5 font-semibold',
                                SALES_STAGE_COLOR[a.stage_after] ??
                                  'bg-slate-100 text-slate-600',
                              )}
                            >
                              {SALES_STAGE_LABEL[a.stage_after]?.split('. ')[1] ??
                                a.stage_after}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 max-w-xs truncate text-slate-600">
                        {a.outcome ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">
                        {a.value_generated && Number(a.value_generated) > 0
                          ? formatKRW(Number(a.value_generated))
                          : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {a.next_action ? (
                          <span className="text-[11px]">
                            {a.next_action}
                            {a.next_action_date && (
                              <span className="ml-1 text-slate-400">
                                ({a.next_action_date})
                              </span>
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
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
