/**
 * 영업 허브 (Phase 2 #2a 진입점)
 *
 * 영업 KPI 요약 + 7단계 깔때기 + 빠른 진입.
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  Users,
  Phone,
  Send,
  Target,
  Trophy,
  TrendingUp,
  AlertCircle,
  PlusCircle,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SALES_STAGE_LABEL, SALES_STAGE_COLOR } from '@/lib/v11-labels'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface FunnelRow {
  current_stage: string
  client_count: number
  dream100_count: number
  recent_count: number
}

async function loadData() {
  try {
    const supabase = await createClient()

    const today = new Date()
    const last7 = new Date(today)
    last7.setDate(last7.getDate() - 7)
    const last7Str = last7.toISOString().split('T')[0]
    const last30 = new Date(today)
    last30.setDate(last30.getDate() - 30)
    const last30Str = last30.toISOString().split('T')[0]

    const [funnelRes, recentActivities, kpis30, dream100] = await Promise.all([
      supabase.from('sales_funnel').select('*'),
      supabase
        .from('sales_activities')
        .select(
          'id, activity_type, activity_date, value_generated, client_id, outcome',
        )
        .gte('activity_date', last7Str)
        .order('activity_date', { ascending: false })
        .limit(20),
      supabase
        .from('sales_activities')
        .select('activity_type, value_generated')
        .gte('activity_date', last30Str),
      supabase
        .from('clients')
        .select('id, name, current_stage, last_contact_date')
        .eq('dream100', true)
        .eq('active', true)
        .order('last_contact_date', { ascending: true, nullsFirst: true })
        .limit(10),
    ])

    const funnel = (funnelRes.data ?? []) as FunnelRow[]
    const totalClients = funnel.reduce((s, f) => s + Number(f.client_count || 0), 0)

    // 30일 KPI 집계
    const acts30 = kpis30.data ?? []
    const meetings30 = acts30.filter(
      (a) => a.activity_type === 'meeting' || a.activity_type === 'visit',
    ).length
    const samples30 = acts30.filter((a) => a.activity_type === 'sample_send').length
    const calls30 = acts30.filter((a) => a.activity_type === 'call').length
    const valueGen30 = acts30.reduce(
      (s, a) => s + Number(a.value_generated || 0),
      0,
    )

    return {
      funnel,
      totalClients,
      recentActivities: recentActivities.data ?? [],
      meetings30,
      samples30,
      calls30,
      valueGen30,
      dream100: dream100.data ?? [],
      errors: [funnelRes.error, recentActivities.error, kpis30.error, dream100.error].filter(
        Boolean,
      ) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      funnel: [] as FunnelRow[],
      totalClients: 0,
      recentActivities: [],
      meetings30: 0,
      samples30: 0,
      calls30: 0,
      valueGen30: 0,
      dream100: [] as Array<{ id: number; name: string; current_stage: string; last_contact_date: string | null }>,
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function SalesHubPage() {
  const data = await loadData()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · Phase 2 · #2a 영업 전략
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">영업 허브</h1>
          <p className="mt-1 text-sm text-slate-500">
            7단계 깔때기 · 30일 KPI · Dream 100 진입점
          </p>
        </div>
        <Link href="/finance/sales/activities">
          <Button>
            <PlusCircle className="mr-1 h-4 w-4" />
            활동 기록
          </Button>
        </Link>
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
                <p className="mt-1 text-xs text-rose-700">
                  스키마 마이그레이션이 필요할 수 있습니다 — Supabase SQL Editor에 {' '}
                  <code className="rounded bg-white px-1">
                    supabase/migrations/v11.1_sales_strategy.sql
                  </code>{' '}
                  적용 후 재시도.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI 4개 (30일) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">미팅 (30일)</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {data.meetings30}
            </div>
            <p className="text-[11px] text-slate-400">대면 + 방문</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">샘플 발송</span>
              <Send className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {data.samples30}
            </div>
            <p className="text-[11px] text-slate-400">디안 영업의 핵심 활동</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">전화·연락</span>
              <Phone className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {data.calls30}
            </div>
            <p className="text-[11px] text-slate-400">선행지표</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">활동 발생 매출</span>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {formatKRW(data.valueGen30)}
            </div>
            <p className="text-[11px] text-slate-400">활동에서 즉시 발생</p>
          </CardContent>
        </Card>
      </div>

      {/* 7단계 깔때기 */}
      <Card>
        <CardHeader>
          <CardTitle>7단계 영업 깔때기 (트레이시)</CardTitle>
          <CardDescription>
            전체 거래처 {data.totalClients}곳의 단계별 분포
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.funnel.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              거래처 데이터가 없습니다 — 일계표 업로드 또는 직접 등록 후 단계를 부여하세요
            </p>
          ) : (
            <div className="space-y-2">
              {data.funnel.map((row) => {
                const ratio =
                  data.totalClients > 0
                    ? (Number(row.client_count) / data.totalClients) * 100
                    : 0
                return (
                  <div key={row.current_stage} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                          SALES_STAGE_COLOR[row.current_stage] ?? 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {SALES_STAGE_LABEL[row.current_stage] ?? row.current_stage}
                      </span>
                      <span className="tabular-nums text-slate-600">
                        <strong>{row.client_count}</strong> 곳 ({ratio.toFixed(0)}%)
                        {row.dream100_count > 0 && (
                          <span className="ml-1 text-amber-600">
                            · 🌟 D100 {row.dream100_count}
                          </span>
                        )}
                        {row.recent_count > 0 && (
                          <span className="ml-1 text-emerald-600">
                            · 14일 활동 {row.recent_count}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-blue-400 transition-all"
                        style={{ width: `${Math.min(ratio, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dream 100 + 최근 활동 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Dream 100
            </CardTitle>
            <CardDescription>
              가장 가지고 싶은 거래처 (last_contact 오래된 순)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.dream100.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                Dream 100 표적이 없습니다. 거래처 관리 페이지에서 설정하세요.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.dream100.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-md border border-amber-100 bg-amber-50/30 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-3 w-3 text-amber-500" />
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        <span
                          className={cn(
                            'rounded px-1 py-0.5 text-[9px] font-semibold',
                            SALES_STAGE_COLOR[c.current_stage] ??
                              'bg-slate-100 text-slate-600',
                          )}
                        >
                          {SALES_STAGE_LABEL[c.current_stage] ?? '미설정'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        마지막 컨택: {c.last_contact_date ?? '없음'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 활동 (7일)</CardTitle>
            <CardDescription>{data.recentActivities.length}건</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivities.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                최근 7일 영업 활동이 없습니다
              </p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {data.recentActivities.slice(0, 10).map((a) => (
                  <li
                    key={a.id}
                    className="text-xs text-slate-700 border-b last:border-0 py-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.activity_type}</span>
                      <span className="text-[10px] text-slate-400">
                        {a.activity_date}
                      </span>
                    </div>
                    {a.outcome && (
                      <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                        {a.outcome}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">⚡ 영업 페이지</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Link href="/finance/sales/activities">
            <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
              <CardContent className="space-y-1 py-3">
                <Phone className="h-5 w-5 text-blue-500" />
                <div className="text-sm font-semibold">활동 다이어리</div>
                <div className="text-[11px] text-slate-500">통화·미팅·샘플 기록</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/sales/segments">
            <Card className="cursor-pointer transition hover:border-purple-300 hover:bg-purple-50/30">
              <CardContent className="space-y-1 py-3">
                <Target className="h-5 w-5 text-purple-500" />
                <div className="text-sm font-semibold">24셀 영업 매트릭스</div>
                <div className="text-[11px] text-slate-500">셀별 메시지·시퀀스</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/sales/kpi">
            <Card className="cursor-pointer transition hover:border-emerald-300 hover:bg-emerald-50/30">
              <CardContent className="space-y-1 py-3">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                <div className="text-sm font-semibold">영업 KPI</div>
                <div className="text-[11px] text-slate-500">선행·후행 지표</div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          준비 중인 페이지: 거래처 360도 뷰 (②), 니즈 카드 (④), 7단계 트래커 (⑤),
          영업 자기경영 (⑦)
        </p>
      </div>
    </div>
  )
}
