/**
 * BSC 4관점 통합 대시보드 (Phase 5 #3 ④)
 * 카플란-노턴 Balanced Scorecard.
 * 재무 · 고객 · 내부 프로세스 · 학습/성장 4관점.
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
  Wallet,
  Users,
  Settings,
  Zap,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/formatters'
import { calculateCycleProgress } from '@/lib/v11-cycle'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()

    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split('T')[0]
    const past90 = new Date()
    past90.setDate(past90.getDate() - 90)
    const past90Str = past90.toISOString().split('T')[0]

    const [txMonth, txPast90, ar, clients, samples90, activities90, goals, cycleRes, scripts, books] =
      await Promise.all([
        supabase
          .from('transactions')
          .select('total_amount, total_cost, margin_amount, client_id')
          .gte('transaction_date', monthStart)
          .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
        supabase
          .from('transactions')
          .select('total_amount, client_id, transaction_date')
          .gte('transaction_date', past90Str)
          .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
        supabase.from('outstanding_payments').select('outstanding, days_overdue'),
        supabase.from('clients').select('id, current_stage, lifecycle_stage, created_at').eq('active', true),
        supabase
          .from('sample_items')
          .select('status, conversion_value, request_id')
          .gte('request_id', 1),
        supabase
          .from('sales_activities')
          .select('id, value_generated')
          .gte('activity_date', past90Str),
        supabase.from('goals').select('current_value, target_value'),
        supabase
          .from('cycles')
          .select('start_date, end_date')
          .eq('status', 'active')
          .order('cycle_number', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('marketing_scripts').select('effectiveness_score'),
        supabase.from('sample_books').select('id').eq('status', 'active'),
      ])

    return {
      txMonth: txMonth.data ?? [],
      txPast90: txPast90.data ?? [],
      ar: ar.data ?? [],
      clients: clients.data ?? [],
      samples90: samples90.data ?? [],
      activities90: activities90.data ?? [],
      goals: goals.data ?? [],
      cycle: cycleRes.data,
      scripts: scripts.data ?? [],
      books: books.data ?? [],
      errors: [
        txMonth.error,
        txPast90.error,
        ar.error,
        clients.error,
        samples90.error,
        activities90.error,
        goals.error,
        cycleRes.error,
        scripts.error,
        books.error,
      ].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      txMonth: [],
      txPast90: [],
      ar: [],
      clients: [],
      samples90: [],
      activities90: [],
      goals: [],
      cycle: null,
      scripts: [],
      books: [],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function BSCPage() {
  const data = await loadData()

  // === 재무 (Financial) ===
  const monthRevenue = data.txMonth.reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const monthMargin = data.txMonth.reduce((s, t) => s + Number(t.margin_amount || 0), 0)
  const marginRate = monthRevenue > 0 ? (monthMargin / monthRevenue) * 100 : 0
  const arOutstanding = data.ar.reduce((s, o) => s + Number(o.outstanding || 0), 0)
  const arOverdue = data.ar
    .filter((o) => Number(o.days_overdue) > 0)
    .reduce((s, o) => s + Number(o.outstanding || 0), 0)

  // === 고객 (Customer) ===
  const totalClients = data.clients.length
  const newClients = data.clients.filter((c) => {
    const created = new Date(c.created_at)
    const past90 = new Date()
    past90.setDate(past90.getDate() - 90)
    return created > past90
  }).length
  const atRisk = data.clients.filter((c) => c.lifecycle_stage === 'at_risk').length
  const churned = data.clients.filter((c) => c.lifecycle_stage === 'churned').length
  const active90 = new Set(
    data.txPast90.map((t) => t.client_id).filter(Boolean) as number[],
  ).size

  // === 내부 프로세스 (Internal Process) ===
  const samplesSent = data.samples90.length
  const samplesConverted = data.samples90.filter((s) => s.status === 'converted').length
  const sampleConvRate = samplesSent > 0 ? (samplesConverted / samplesSent) * 100 : 0
  const sampleRevenue = data.samples90.reduce(
    (s, i) => s + Number(i.conversion_value || 0),
    0,
  )
  const totalActivities = data.activities90.length
  const activityValue = data.activities90.reduce(
    (s, a) => s + Number(a.value_generated || 0),
    0,
  )

  // === 학습·성장 (Learning & Growth) ===
  const goalsTotal = data.goals.length
  const goalsPassed = data.goals.filter(
    (g) =>
      g.target_value &&
      Number(g.current_value || 0) >= Number(g.target_value) * 0.8,
  ).length
  const goalProgress =
    data.goals.length > 0
      ? data.goals.reduce((s, g) => {
          const t = Number(g.target_value) || 0
          if (t === 0) return s
          return s + Math.min(1, Number(g.current_value || 0) / t)
        }, 0) / data.goals.length
      : 0
  const scriptCount = data.scripts.length
  const avgScriptScore =
    data.scripts.length > 0
      ? data.scripts.reduce((s, sc) => s + (Number(sc.effectiveness_score) || 0), 0) /
        data.scripts.length
      : 0
  const activeBooks = data.books.length
  let cycleStr = '활성 사이클 없음'
  if (data.cycle) {
    const p = calculateCycleProgress(data.cycle.start_date, data.cycle.end_date)
    cycleStr = `Week ${p.weekNumber}/12 · D-${p.daysRemaining}`
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #3 ④ BSC 4관점
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">BSC 4관점 대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          카플란·노턴 Balanced Scorecard — 재무·고객·내부 프로세스·학습/성장 균형 점검
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

      {/* 4관점 그리드 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 재무 */}
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
              재무 (Financial)
            </CardTitle>
            <CardDescription>이번 달 + 미수금</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Metric label="이번 달 매출" value={formatKRW(monthRevenue)} />
            <Metric label="공헌이익" value={formatKRW(monthMargin)} />
            <Metric
              label="마진율"
              value={`${marginRate.toFixed(1)}%`}
              tone={marginRate >= 40 ? 'good' : marginRate >= 25 ? 'neutral' : 'warn'}
            />
            <Metric label="총 미수금" value={formatKRW(arOutstanding)} />
            <Metric
              label="연체 미수금"
              value={formatKRW(arOverdue)}
              tone={arOverdue === 0 ? 'good' : arOverdue > 5_000_000 ? 'warn' : 'neutral'}
            />
          </CardContent>
        </Card>

        {/* 고객 */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              고객 (Customer)
            </CardTitle>
            <CardDescription>거래처 풀 + 90일 활성</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Metric label="전체 활성 거래처" value={String(totalClients)} />
            <Metric
              label="90일 활성 (거래 발생)"
              value={`${active90} (${totalClients > 0 ? ((active90 / totalClients) * 100).toFixed(0) : 0}%)`}
              tone={active90 / Math.max(1, totalClients) >= 0.5 ? 'good' : 'warn'}
            />
            <Metric label="신규 거래처 (90일)" value={String(newClients)} tone="good" />
            <Metric
              label="이탈 위험"
              value={String(atRisk)}
              tone={atRisk > 0 ? 'warn' : 'good'}
            />
            <Metric
              label="이탈 (Churned)"
              value={String(churned)}
              tone={churned > 0 ? 'warn' : 'neutral'}
            />
          </CardContent>
        </Card>

        {/* 내부 프로세스 */}
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-purple-600" />
              내부 프로세스 (Internal Process)
            </CardTitle>
            <CardDescription>샘플·영업 활동 효율 (90일)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Metric label="샘플 발송 (90일)" value={String(samplesSent)} />
            <Metric
              label="샘플 전환율"
              value={`${sampleConvRate.toFixed(1)}%`}
              tone={sampleConvRate >= 30 ? 'good' : sampleConvRate >= 15 ? 'neutral' : 'warn'}
            />
            <Metric label="샘플 발생 매출" value={formatKRW(sampleRevenue)} tone="good" />
            <Metric label="영업 활동 (90일)" value={String(totalActivities)} />
            <Metric label="활동 발생 매출" value={formatKRW(activityValue)} />
          </CardContent>
        </Card>

        {/* 학습·성장 */}
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              학습·성장 (Learning & Growth)
            </CardTitle>
            <CardDescription>12주 사이클 + 자산 누적</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Metric label="현재 사이클" value={cycleStr} />
            <Metric
              label={`12주 목표 진행 (${goalsPassed}/${goalsTotal})`}
              value={`${(goalProgress * 100).toFixed(0)}%`}
              tone={goalProgress >= 0.8 ? 'good' : goalProgress >= 0.5 ? 'neutral' : 'warn'}
            />
            <Metric label="HSO 스크립트" value={String(scriptCount)} />
            <Metric
              label="평균 스크립트 효과"
              value={`${avgScriptScore.toFixed(1)}/5`}
              tone={avgScriptScore >= 3.5 ? 'good' : 'neutral'}
            />
            <Metric label="활성 샘플북" value={String(activeBooks)} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-sm">📌 BSC 4관점 핵심</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>재무</strong>: 결과 — 매출·이익·미수금. 가장 후행적
            </li>
            <li>
              <strong>고객</strong>: 결과를 만드는 동력 — 거래처 풀의 건강도
            </li>
            <li>
              <strong>내부 프로세스</strong>: 고객 만족을 만드는 운영 — 샘플 큐레이션·영업 활동
            </li>
            <li>
              <strong>학습·성장</strong>: 모든 것의 토대 — 12주 사이클·축적된 노하우
            </li>
            <li>
              4관점이 균형있게 좋아야 지속 가능. 하나라도 빨간 신호가 있으면 그 영역에 우선 투자
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'good' | 'neutral' | 'warn'
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 last:border-0">
      <span className="text-xs text-slate-600">{label}</span>
      <span
        className={cn(
          'text-sm font-bold tabular-nums',
          tone === 'good'
            ? 'text-emerald-700'
            : tone === 'warn'
            ? 'text-rose-700'
            : 'text-slate-800',
        )}
      >
        {value}
      </span>
    </div>
  )
}
