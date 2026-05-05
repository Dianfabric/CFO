/**
 * CEO 코크핏 4차원 통합 대시보드 (Phase 7 #7 ④)
 * 재무 · 고객 · 자기경영 · 전략
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
  Wallet,
  Users,
  User,
  Target,
  AlertCircle,
  ArrowRight,
  Brain,
  MessageSquare,
  Award,
  Send,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { calculateCycleProgress } from '@/lib/v11-cycle'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0]
    const past30 = new Date()
    past30.setDate(past30.getDate() - 30)
    const past30Str = past30.toISOString().split('T')[0]

    const [
      profile,
      txMonth,
      ar,
      clients,
      activitiesMine,
      goals,
      cycleRes,
      decisions,
      lastCheckin,
      lastBriefing,
      lastOneOnOne,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'full_name, role, self_strengths, strengths_description, golden_hours_start, golden_hours_end',
        )
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('transactions')
        .select('total_amount, margin_amount, client_id')
        .gte('transaction_date', monthStart)
        .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
      supabase.from('outstanding_payments').select('outstanding, days_overdue'),
      supabase.from('clients').select('id, lifecycle_stage').eq('active', true),
      supabase
        .from('sales_activities')
        .select('id, duration_minutes, value_generated')
        .eq('agent_id', user.id)
        .gte('activity_date', past30Str),
      supabase.from('goals').select('current_value, target_value'),
      supabase
        .from('cycles')
        .select('cycle_number, start_date, end_date, vision_statement')
        .eq('status', 'active')
        .order('cycle_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('price_decisions')
        .select('ceo_approved, validation_completed, validation_due_date')
        .order('decision_date', { ascending: false })
        .limit(20),
      supabase
        .from('self_mgmt_checkins')
        .select('checkin_date, overall_reflection')
        .eq('user_id', user.id)
        .order('checkin_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('ai_briefings')
        .select('briefing_date, type')
        .eq('user_id', user.id)
        .order('briefing_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('one_on_one_notes')
        .select('id, meeting_date, counterpart_name')
        .eq('owner_id', user.id)
        .order('meeting_date', { ascending: false })
        .limit(3),
    ])

    return {
      profile: profile.data,
      txMonth: txMonth.data ?? [],
      ar: ar.data ?? [],
      clients: clients.data ?? [],
      activities: activitiesMine.data ?? [],
      goals: goals.data ?? [],
      cycle: cycleRes.data,
      decisions: decisions.data ?? [],
      lastCheckin: lastCheckin.data,
      lastBriefing: lastBriefing.data,
      lastOneOnOnes: lastOneOnOne.data ?? [],
      errors: [
        profile.error,
        txMonth.error,
        ar.error,
        clients.error,
        activitiesMine.error,
        goals.error,
        cycleRes.error,
        decisions.error,
      ].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return null
  }
}

export default async function CockpitPage() {
  const data = await loadData()

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-rose-600">데이터를 불러오지 못했습니다.</p>
      </div>
    )
  }

  // === 재무 ===
  const monthRevenue = data.txMonth.reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const monthMargin = data.txMonth.reduce((s, t) => s + Number(t.margin_amount || 0), 0)
  const arOverdue = data.ar
    .filter((o) => Number(o.days_overdue) > 0)
    .reduce((s, o) => s + Number(o.outstanding || 0), 0)

  // === 고객 ===
  const totalClients = data.clients.length
  const atRisk = data.clients.filter((c) => c.lifecycle_stage === 'at_risk').length

  // === 자기경영 ===
  const totalHours =
    data.activities.reduce((s, a) => s + Number(a.duration_minutes ?? 0), 0) / 60
  const activityValue = data.activities.reduce(
    (s, a) => s + Number(a.value_generated ?? 0),
    0,
  )
  const strengthsCount = (data.profile?.self_strengths ?? []).length

  // === 전략 ===
  let cycleStr = '활성 사이클 없음'
  let cycleWeek = 0
  if (data.cycle) {
    const p = calculateCycleProgress(data.cycle.start_date, data.cycle.end_date)
    cycleStr = `Week ${p.weekNumber}/12 · D-${p.daysRemaining}`
    cycleWeek = p.weekNumber
  }
  const goalsPassed = data.goals.filter(
    (g) =>
      g.target_value &&
      Number(g.current_value || 0) >= Number(g.target_value) * 0.8,
  ).length
  const decisionsActive = data.decisions.filter(
    (d) => d.ceo_approved && !d.validation_completed,
  ).length
  const decisionsOverdue = data.decisions.filter(
    (d) =>
      d.ceo_approved &&
      !d.validation_completed &&
      d.validation_due_date &&
      new Date(d.validation_due_date) < new Date(),
  ).length

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #7 ④ CEO 코크핏 4차원
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          {data.profile?.full_name ?? 'CEO'} 4차원 코크핏
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          재무·고객·자기경영·전략 — 드러커·그로브·캠벨 통합 시각
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
                <p className="mt-1 text-xs">v11.6_cockpit.sql 적용 필요할 수 있음</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4차원 그리드 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 재무 */}
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />1차원 — 재무
            </CardTitle>
            <CardDescription>이번 달 + 위험 신호</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="이번 달 매출" value={formatKRW(monthRevenue)} />
            <Row
              label="마진율"
              value={`${monthRevenue > 0 ? ((monthMargin / monthRevenue) * 100).toFixed(1) : 0}%`}
              tone={monthRevenue > 0 && monthMargin / monthRevenue >= 0.4 ? 'good' : 'neutral'}
            />
            <Row
              label="연체 미수금"
              value={formatKRW(arOverdue)}
              tone={arOverdue > 0 ? 'warn' : 'good'}
            />
            <Link
              href="/finance"
              className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
            >
              재무 메인 <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* 고객 */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />2차원 — 고객
            </CardTitle>
            <CardDescription>거래처 풀의 건강도</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="활성 거래처" value={String(totalClients)} />
            <Row
              label="이탈 위험"
              value={String(atRisk)}
              tone={atRisk > 0 ? 'warn' : 'good'}
            />
            <Link
              href="/finance/clients"
              className="flex items-center gap-1 text-xs text-blue-700 hover:underline"
            >
              거래처 관리 <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* 자기경영 */}
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-amber-600" />3차원 — 자기경영 (드러커)
            </CardTitle>
            <CardDescription>본인의 시간·강점·반성</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="30일 영업 시간"
              value={`${totalHours.toFixed(1)}시간`}
            />
            <Row label="활동 발생 매출" value={formatKRW(activityValue)} />
            <Row
              label="정의된 강점"
              value={strengthsCount > 0 ? `${strengthsCount}가지` : '미정의'}
              tone={strengthsCount >= 3 ? 'good' : 'warn'}
            />
            <Row
              label="마지막 자기경영 점검"
              value={data.lastCheckin?.checkin_date ?? '없음'}
              tone={data.lastCheckin ? 'good' : 'warn'}
            />
            <Row
              label="마지막 AI 브리핑"
              value={
                data.lastBriefing
                  ? `${data.lastBriefing.briefing_date} (${data.lastBriefing.type})`
                  : '없음'
              }
              tone={data.lastBriefing ? 'good' : 'neutral'}
            />
            {data.profile?.golden_hours_start && (
              <Row
                label="골든 아워"
                value={`${data.profile.golden_hours_start} ~ ${data.profile.golden_hours_end ?? '?'}`}
              />
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href="/finance/cockpit/strengths"
                className="text-xs text-amber-700 hover:underline"
              >
                강점 →
              </Link>
              <Link
                href="/finance/cockpit/self"
                className="text-xs text-amber-700 hover:underline"
              >
                5가지 점검 →
              </Link>
              <Link
                href="/finance/cockpit/one-on-one"
                className="text-xs text-amber-700 hover:underline"
              >
                1:1 노트 →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 전략 */}
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />4차원 — 전략
            </CardTitle>
            <CardDescription>12주 사이클 + 가격 결정</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="현재 사이클" value={cycleStr} />
            {data.cycle?.vision_statement && (
              <Row label="비전" value={data.cycle.vision_statement.slice(0, 50)} />
            )}
            <Row
              label="80% 통과 목표"
              value={`${goalsPassed}/${data.goals.length}`}
              tone={data.goals.length > 0 && goalsPassed / data.goals.length >= 0.5 ? 'good' : 'warn'}
            />
            <Row
              label="시행 중 가격 결정"
              value={String(decisionsActive)}
            />
            <Row
              label="검증 필요 (overdue)"
              value={String(decisionsOverdue)}
              tone={decisionsOverdue > 0 ? 'warn' : 'good'}
            />
            <Link
              href="/finance/cycle"
              className="flex items-center gap-1 text-xs text-purple-700 hover:underline"
            >
              12주 대시보드 <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 코크핏 페이지 진입 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">⚡ 코크핏 페이지</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Link href="/finance/briefing">
            <Card className="cursor-pointer transition hover:border-amber-300 hover:bg-amber-50/30">
              <CardContent className="space-y-1 py-3">
                <Brain className="h-5 w-5 text-amber-500" />
                <div className="text-sm font-semibold">① 모닝 브리핑</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/consult">
            <Card className="cursor-pointer transition hover:border-purple-300 hover:bg-purple-50/30">
              <CardContent className="space-y-1 py-3">
                <MessageSquare className="h-5 w-5 text-purple-500" />
                <div className="text-sm font-semibold">② 라이브 컨설팅</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/cockpit/self">
            <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
              <CardContent className="space-y-1 py-3">
                <User className="h-5 w-5 text-blue-500" />
                <div className="text-sm font-semibold">⑤ 자기경영 5가지</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/cockpit/one-on-one">
            <Card className="cursor-pointer transition hover:border-emerald-300 hover:bg-emerald-50/30">
              <CardContent className="space-y-1 py-3">
                <Users className="h-5 w-5 text-emerald-500" />
                <div className="text-sm font-semibold">⑥ 1:1 노트 🔒</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/cockpit/strengths">
            <Card className="cursor-pointer transition hover:border-amber-300 hover:bg-amber-50/30">
              <CardContent className="space-y-1 py-3">
                <Award className="h-5 w-5 text-amber-500" />
                <div className="text-sm font-semibold">⑦ 강점 자기인식</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/cockpit/telegram">
            <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
              <CardContent className="space-y-1 py-3">
                <Send className="h-5 w-5 text-blue-500" />
                <div className="text-sm font-semibold">⑧ 텔레그램봇</div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* 최근 1:1 노트 (본인 only) */}
      {data.lastOneOnOnes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-slate-500" />
              최근 1:1 노트 (본인만 조회 가능)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs">
              {data.lastOneOnOnes.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/finance/cockpit/one-on-one/${n.id}`}
                    className="text-slate-700 hover:text-blue-700 hover:underline"
                  >
                    {n.meeting_date} · {n.counterpart_name ?? '(이름 미입력)'}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'good' | 'neutral' | 'warn'
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-600">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
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
