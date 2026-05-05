/**
 * 영업 자기경영 (Phase 2 #2a ⑦, 트레이시 차원)
 *
 * - 오늘 활동 vs 일일 목표
 * - 이번 주 활동 트렌드
 * - 시간당 매출 (시간 효율)
 * - 활동 다양성 (채널 분산)
 * - 골든 아워 활용도
 *
 * 새 테이블 없이 sales_activities 만으로 계산.
 */
import Link from 'next/link'
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
  Clock,
  Target,
  Activity as ActivityIcon,
  Award,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SALES_ACTIVITY_LABEL } from '@/lib/v11-labels'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 트레이시 자기경영 — 일일 권장 활동량 (디안 영업 기준 — 추후 사용자가 조정 가능)
const DAILY_TARGETS = {
  meetings: 1, // 미팅·방문 1건/일
  samples: 2, // 샘플 발송 2건/일
  contacts: 3, // 신규 컨택 3건/일
  total: 5, // 총 활동 5건/일
}

async function loadData() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const today = new Date().toISOString().split('T')[0]
    const weekStart = new Date()
    const dow = weekStart.getDay()
    weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1))
    const weekStartStr = weekStart.toISOString().split('T')[0]

    const past30Start = new Date()
    past30Start.setDate(past30Start.getDate() - 30)
    const past30Str = past30Start.toISOString().split('T')[0]

    const [todayActs, weekActs, past30Acts, txMonth] = await Promise.all([
      supabase
        .from('sales_activities')
        .select('activity_type, activity_time, duration_minutes, value_generated, client_id')
        .eq('agent_id', user.id)
        .eq('activity_date', today),
      supabase
        .from('sales_activities')
        .select(
          'activity_type, activity_date, activity_time, duration_minutes, value_generated, client_id',
        )
        .eq('agent_id', user.id)
        .gte('activity_date', weekStartStr),
      supabase
        .from('sales_activities')
        .select('activity_type, activity_date, duration_minutes')
        .eq('agent_id', user.id)
        .gte('activity_date', past30Str),
      supabase
        .from('transactions')
        .select('total_amount')
        .gte('transaction_date', past30Str)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
    ])

    return {
      today,
      todayActs: todayActs.data ?? [],
      weekActs: weekActs.data ?? [],
      past30Acts: past30Acts.data ?? [],
      txMonth: txMonth.data ?? [],
      errors: [todayActs.error, weekActs.error, past30Acts.error, txMonth.error].filter(
        Boolean,
      ) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      today: new Date().toISOString().split('T')[0],
      todayActs: [],
      weekActs: [],
      past30Acts: [],
      txMonth: [],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function SalesSelfPage() {
  const data = await loadData()

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-rose-600">로그인이 필요합니다.</p>
      </div>
    )
  }

  // 오늘 카운트
  const todayMeetings = data.todayActs.filter(
    (a) => a.activity_type === 'meeting' || a.activity_type === 'visit',
  ).length
  const todaySamples = data.todayActs.filter((a) => a.activity_type === 'sample_send').length
  const todayContacts = new Set(
    data.todayActs.map((a) => a.client_id).filter(Boolean) as number[],
  ).size
  const todayTotal = data.todayActs.length
  const todayDuration = data.todayActs.reduce(
    (s, a) => s + Number(a.duration_minutes ?? 0),
    0,
  )
  const todayValueGen = data.todayActs.reduce(
    (s, a) => s + Number(a.value_generated ?? 0),
    0,
  )

  // 시간당 매출 (30일)
  const past30Duration = data.past30Acts.reduce(
    (s, a) => s + Number(a.duration_minutes ?? 0),
    0,
  )
  const past30Hours = past30Duration / 60
  const past30Revenue = data.txMonth.reduce((s, t) => s + Number(t.total_amount ?? 0), 0)
  const timeCharge = past30Hours > 0 ? past30Revenue / past30Hours : 0

  // 활동 시간대 분석 (골든 아워) — todayActs와 weekActs 둘 다 활용
  const hourBuckets = new Map<number, number>()
  const allActsWithTime = [
    ...data.todayActs.map((a) => ({ activity_time: a.activity_time as string | null })),
    ...data.weekActs.map((a) => ({ activity_time: a.activity_time as string | null })),
  ]
  for (const a of allActsWithTime) {
    if (a.activity_time) {
      const hour = parseInt(String(a.activity_time).slice(0, 2), 10)
      if (Number.isFinite(hour)) {
        hourBuckets.set(hour, (hourBuckets.get(hour) ?? 0) + 1)
      }
    }
  }
  const goldenHours = Array.from(hourBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  // 이번 주 일별 활동량
  const weekByDay = new Map<string, number>()
  for (const a of data.weekActs) {
    const d = a.activity_date
    weekByDay.set(d, (weekByDay.get(d) ?? 0) + 1)
  }

  // 활동 다양성 (지난 30일)
  const typeBuckets = new Map<string, number>()
  for (const a of data.past30Acts) {
    typeBuckets.set(a.activity_type, (typeBuckets.get(a.activity_type) ?? 0) + 1)
  }
  const diversity = typeBuckets.size

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
            v1.1 · #2a ⑦ 영업 자기경영
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">영업 자기경영</h1>
        <p className="mt-1 text-sm text-slate-500">
          트레이시 — 시간 관리 / 골든 아워 / 활동 다양성 / 일일 목표
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 오늘 KPI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">오늘 ({data.today}) — 일일 목표 대비</CardTitle>
          <CardDescription>
            일일 권장 활동량 — 트레이시 자기경영의 핵심: 매일 작은 활동 누적
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <DailyKPI
              label="미팅·방문"
              actual={todayMeetings}
              target={DAILY_TARGETS.meetings}
              icon={<Target className="h-4 w-4 text-blue-500" />}
            />
            <DailyKPI
              label="샘플 발송"
              actual={todaySamples}
              target={DAILY_TARGETS.samples}
              icon={<Award className="h-4 w-4 text-purple-500" />}
            />
            <DailyKPI
              label="신규 컨택"
              actual={todayContacts}
              target={DAILY_TARGETS.contacts}
              icon={<ActivityIcon className="h-4 w-4 text-emerald-500" />}
            />
            <DailyKPI
              label="총 활동"
              actual={todayTotal}
              target={DAILY_TARGETS.total}
              icon={<ActivityIcon className="h-4 w-4 text-slate-500" />}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
              <span className="font-medium">오늘 영업 시간:</span>{' '}
              <strong className="tabular-nums text-slate-800">
                {(todayDuration / 60).toFixed(1)}시간
              </strong>{' '}
              ({todayDuration}분)
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
              <span className="font-medium">오늘 활동 발생 매출:</span>{' '}
              <strong className="tabular-nums text-emerald-700">
                {formatKRW(todayValueGen)}
              </strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 이번 주 + 시간당 매출 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">이번 주 활동 추이</CardTitle>
            <CardDescription>일별 누적</CardDescription>
          </CardHeader>
          <CardContent>
            {data.weekActs.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">이번 주 활동 없음</p>
            ) : (
              <div className="space-y-2">
                {Array.from(weekByDay.entries())
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([d, count]) => {
                    const dayName = new Date(d).toLocaleDateString('ko-KR', {
                      weekday: 'short',
                      month: 'numeric',
                      day: 'numeric',
                    })
                    const ratio = (count / DAILY_TARGETS.total) * 100
                    return (
                      <div key={d} className="flex items-center gap-2 text-xs">
                        <span className="w-20 shrink-0 text-slate-600">{dayName}</span>
                        <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn(
                              'h-full',
                              ratio >= 100 ? 'bg-emerald-500' : 'bg-blue-400',
                            )}
                            style={{ width: `${Math.min(ratio, 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right tabular-nums text-slate-700">
                          {count}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              시간당 매출 (30일)
            </CardTitle>
            <CardDescription>
              시간 효율 — 영업 활동 1시간당 발생한 회사 전체 매출
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold tabular-nums text-amber-700">
              {formatKRW(timeCharge)}
              <span className="ml-2 text-sm font-normal text-slate-500">/시간</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div>
                30일 영업 시간:{' '}
                <strong className="tabular-nums text-slate-800">
                  {past30Hours.toFixed(0)}시간
                </strong>
              </div>
              <div>
                30일 매출:{' '}
                <strong className="tabular-nums text-slate-800">
                  {formatKRW(past30Revenue)}
                </strong>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              💡 시간당 매출이 높을수록 효율적. 낮으면 활동의 질을 점검 필요.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 골든 아워 + 활동 다양성 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              골든 아워 (활동 집중 시간대)
            </CardTitle>
            <CardDescription>이번 주 활동이 가장 많이 일어난 시간대</CardDescription>
          </CardHeader>
          <CardContent>
            {goldenHours.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                활동 시간 미입력 — 활동 등록 시 시간 입력하면 추적됩니다
              </p>
            ) : (
              <ul className="space-y-2">
                {goldenHours.map(([hour, count], idx) => (
                  <li
                    key={hour}
                    className="flex items-center gap-3 rounded-md border border-amber-100 bg-amber-50/30 p-2 text-sm"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 tabular-nums">
                        {String(hour).padStart(2, '0')}:00 ~ {String(hour).padStart(2, '0')}:59
                      </div>
                      <div className="text-[11px] text-slate-500">{count}건 활동</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-slate-500">
              💡 골든 아워에는 전화·미팅·중요 의사결정을, 그 외 시간에는 행정·정리.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">활동 다양성 (30일)</CardTitle>
            <CardDescription>
              총 {diversity}종 활동 / 12종 — 다양성 {Math.round((diversity / 12) * 100)}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            {typeBuckets.size === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">활동 없음</p>
            ) : (
              <div className="space-y-1.5">
                {Array.from(typeBuckets.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const ratio = (count / data.past30Acts.length) * 100
                    return (
                      <div key={type} className="flex items-center gap-2 text-xs">
                        <span className="w-32 shrink-0 text-slate-700">
                          {SALES_ACTIVITY_LABEL[type] ?? type}
                        </span>
                        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-blue-400"
                            style={{ width: `${Math.min(ratio, 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right tabular-nums text-slate-600">
                          {count}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
            <p className="mt-3 text-[11px] text-slate-500">
              💡 한 채널에만 의존하면 위험 — 전화·미팅·샘플·이메일이 골고루 작동해야 안정.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 트레이시 가이드 */}
      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 트레이시 영업 자기경영 핵심</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>매일 작은 목표</strong>: 일일 권장 활동량을 정하고 매일 80% 이상 달성. 12주
              누적 시 압도적 결과.
            </li>
            <li>
              <strong>골든 아워 사수</strong>: 본인이 가장 집중되는 시간을 영업 활동(전화·미팅)에
              우선 배치.
            </li>
            <li>
              <strong>시간당 매출 추적</strong>: 매출 ÷ 영업 시간 = 시간 효율. 매월 ±10% 이상 개선
              목표.
            </li>
            <li>
              <strong>활동 다양성</strong>: 한 채널에 75% 이상 쏠리면 위험 — 전화·미팅·샘플·이메일을
              골고루.
            </li>
            <li>
              <strong>매일 회고 1분</strong>: 오늘 잘한 것 1개, 개선할 것 1개를 활동 메모에 기록.
              주간 단위로 패턴이 보임.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function DailyKPI({
  label,
  actual,
  target,
  icon,
}: {
  label: string
  actual: number
  target: number
  icon: React.ReactNode
}) {
  const ratio = target > 0 ? (actual / target) * 100 : 0
  const passed = actual >= target
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{label}</span>
        {icon}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            'text-2xl font-bold tabular-nums',
            passed ? 'text-emerald-700' : 'text-slate-900',
          )}
        >
          {actual}
        </span>
        <span className="text-xs text-slate-400">/ {target}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full', passed ? 'bg-emerald-500' : 'bg-amber-400')}
          style={{ width: `${Math.min(ratio, 100)}%` }}
        />
      </div>
    </div>
  )
}
