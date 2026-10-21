/**
 * 12주 사이클 대시보드 (Phase 1 ⑤, PRD #1 ①)
 *
 * 사이클의 리듬대로 구성 (대표 지시 2026-10-21 개편):
 * - 사이클 종료 시: 전환 위저드 (회고 → 1장 요약 → 새 사이클 시작)
 * - 진행 중: 큰 목표·주차 스트립 + 직원별 진행 (CycleDashboardSummary)
 * - KPI 모아보기 차트 → 자동 후행지표 → 리듬별 도구 (매일/매주/사이클)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  TrendingUp,
  Wallet,
  Users,
  CalendarCheck,
  Repeat,
  Flag,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { calculateCycleProgress } from '@/lib/v11-cycle'
import { formatKRW } from '@/lib/formatters'
import CycleStartCard from '@/components/v11/cycle/CycleStartCard'
import CycleTransitionCard from '@/components/v11/cycle/CycleTransitionCard'
import CycleDashboardSummary from '@/components/v11/cycle/CycleDashboardSummary'
import CycleKpiBoard from '@/components/v11/cycle/CycleKpiBoard'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Cycle {
  id: number
  cycle_number: number
  start_date: string
  end_date: string
  vision_statement: string | null
  status: string
}

async function loadCycleData() {
  try {
    const supabase = await createClient()

    // 활성 사이클
    const { data: cycle, error: e1 } = await supabase
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (e1 || !cycle) {
      return {
        cycle: null,
        revenue: 0,
        margin: 0,
        activeClients: 0,
        prevRevenue: 0,
        error: e1?.message ?? '활성 사이클이 없습니다',
      }
    }

    // 사이클 기간 동안의 거래 (자동 후행지표)
    const { data: txCurrent } = await supabase
      .from('transactions')
      .select('client_id, total_amount, margin_amount')
      .gte('transaction_date', cycle.start_date)
      .lte('transaction_date', cycle.end_date)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid'])

    // 직전 사이클(또는 같은 길이의 직전 기간) 비교
    const cycleLength =
      Math.ceil(
        (new Date(cycle.end_date).getTime() - new Date(cycle.start_date).getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1
    const prevEnd = new Date(cycle.start_date)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - cycleLength + 1)

    const { data: txPrev } = await supabase
      .from('transactions')
      .select('total_amount')
      .gte('transaction_date', prevStart.toISOString().split('T')[0])
      .lte('transaction_date', prevEnd.toISOString().split('T')[0])
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid'])

    const revenue = (txCurrent ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )
    const margin = (txCurrent ?? []).reduce(
      (s, t) => s + Number(t.margin_amount || 0),
      0,
    )
    const activeClients = new Set(
      (txCurrent ?? []).map((t) => t.client_id).filter(Boolean),
    ).size
    const prevRevenue = (txPrev ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )

    return {
      cycle: cycle as Cycle,
      revenue,
      margin,
      activeClients,
      prevRevenue,
      error: null,
    }
  } catch (e) {
    return {
      cycle: null,
      revenue: 0,
      margin: 0,
      activeClients: 0,
      prevRevenue: 0,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

// 리듬별 도구 — 운영 주기에 따라 3그룹
const TOOL_GROUPS: Array<{
  label: string
  icon: 'daily' | 'weekly' | 'cycle'
  hint: string
  tools: Array<{ href: string; title: string; desc: string }>
}> = [
  {
    label: '매일',
    icon: 'daily',
    hint: '선행지표를 매일 챙기면 후행지표는 따라옵니다',
    tools: [
      { href: '/finance/cycle/employees', title: '직원별 12주 OKR', desc: '목표 → KR → 주간 → 일일 투두 입력' },
      { href: '/finance/cycle/indicators', title: '선·후행 지표', desc: '활동 → 결과 흐름 + 페이스' },
    ],
  },
  {
    label: '매주 월요일',
    icon: 'weekly',
    hint: 'WAM(주간 회의)에서 점수표 갱신 + 다음 주 우선순위',
    tools: [
      { href: '/finance/cycle/wam', title: '주간 WAM (AI 자동)', desc: '매주 월요일 8시 자동 생성 · 회의실 모드' },
      { href: '/finance/cycle/wam-scorecard', title: 'WAM 자동 점수표', desc: '이번 주 자동 집계' },
      { href: '/finance/cycle/suggestions', title: '건의사항', desc: '주별 작성 · 미해결/해결됨' },
    ],
  },
  {
    label: '사이클 단위',
    icon: 'cycle',
    hint: '12주에 한 번 — 설정과 마무리',
    tools: [
      { href: '/finance/cycle/vision', title: '비전·목표 워크북', desc: '5년 → 3년 → 12주 정합성' },
      { href: '/finance/cycle/summary', title: '사이클 1장 요약', desc: 'KR 점수표 + AI 분석 + 종료/이월' },
      { href: '/finance/cycle/retro', title: '12주 회고', desc: '잘된/안된/학습/다음 집중' },
      { href: '/finance/cycle/history', title: '사이클 이력', desc: '과거 사이클 비교' },
    ],
  },
]

const GROUP_ICON = {
  daily: CalendarCheck,
  weekly: Repeat,
  cycle: Flag,
} as const

export default async function CyclePage() {
  const { cycle, revenue, margin, activeClients, prevRevenue, error } =
    await loadCycleData()

  if (!cycle) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">12주 대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">활성 사이클이 없습니다.</p>
        </div>
        <CycleStartCard error={error} />
      </div>
    )
  }

  const progress = calculateCycleProgress(cycle.start_date, cycle.end_date)
  const revenueDelta =
    prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null

  // 사이클 종료 여부 — KST 기준 (Vercel 서버는 UTC)
  const todayKst = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
  }).format(new Date())
  const cycleEnded = cycle.end_date < todayKst
  const daysSinceEnd = cycleEnded
    ? Math.round(
        (new Date(todayKst + 'T00:00:00').getTime() -
          new Date(cycle.end_date + 'T00:00:00').getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">12주 대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">
            사이클 #{cycle.cycle_number} · {cycle.start_date} ~ {cycle.end_date}
            {!cycleEnded && ` · W${progress.weekNumber}/12`}
          </p>
        </div>
      </div>

      {/* 사이클 종료 → 전환 위저드가 주인공 */}
      {cycleEnded && (
        <CycleTransitionCard
          cycleNumber={cycle.cycle_number}
          endDate={cycle.end_date}
          daysSinceEnd={daysSinceEnd}
          visionStatement={cycle.vision_statement}
          revenue={revenue}
          margin={margin}
        />
      )}

      {cycleEnded && (
        <p className="text-[12px] text-slate-400">
          아래는 종료된 사이클 #{cycle.cycle_number}의 기록입니다. 새 사이클을 시작하면 자동으로 갱신됩니다.
        </p>
      )}

      {/* 큰 목표 + 주차 스트립 + 직원별 진행 */}
      <CycleDashboardSummary />

      {/* KPI 모아보기 차트 (모든 직원 KR 한 화면) */}
      <CycleKpiBoard />

      {/* 자동 후행지표 (transactions 집계) */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-800">
          자동 후행지표 <span className="text-xs font-normal text-slate-400">(거래 데이터에서 자동 집계)</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-1 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">사이클 누적 매출</span>
                <TrendingUp
                  className={cn(
                    'h-4 w-4',
                    revenue > 0 ? 'text-emerald-500' : 'text-slate-300',
                  )}
                />
              </div>
              <div
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  revenue > 0 ? 'text-emerald-700' : 'text-slate-400',
                )}
              >
                {formatKRW(revenue)}
              </div>
              {revenueDelta !== null && (
                <p
                  className={cn(
                    'text-[11px] font-semibold',
                    revenueDelta >= 0 ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  직전 동일 기간 대비 {revenueDelta >= 0 ? '+' : ''}
                  {revenueDelta.toFixed(1)}%
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">사이클 누적 공헌이익</span>
                <Wallet className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-slate-900">
                {formatKRW(margin)}
              </div>
              <p className="text-[11px] text-slate-400">
                마진율{' '}
                {revenue > 0 ? ((margin / revenue) * 100).toFixed(1) + '%' : '—'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">활성 거래처</span>
                <Users className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-slate-900">
                {activeClients.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400">사이클 동안 거래 발생</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 리듬별 도구 — 매일 / 매주 / 사이클 단위 */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-800">
          12주 사이클 도구{' '}
          <span className="text-xs font-normal text-slate-400">(운영 리듬 순서)</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {TOOL_GROUPS.map((g) => {
            const Icon = GROUP_ICON[g.icon]
            return (
              <div
                key={g.label}
                className="bg-white"
                style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}
              >
                <div
                  className="px-3 py-2 flex items-center gap-2"
                  style={{ borderBottom: '1px solid var(--nv-hairline, #e2e8f0)' }}
                >
                  <Icon className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-700">
                    {g.label}
                  </span>
                  <span className="hidden sm:inline text-[10.5px] text-slate-400 truncate">
                    · {g.hint}
                  </span>
                </div>
                <div>
                  {g.tools.map((t) => (
                    <Link
                      key={t.href}
                      href={t.href}
                      className="flex items-baseline gap-2 px-3 py-2.5 min-h-[44px] transition-colors hover:bg-slate-50 active:scale-[0.99]"
                    >
                      <span className="text-[12.5px] font-semibold text-slate-800 shrink-0">
                        {t.title}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate">{t.desc}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 안내 — 접힘 (필요할 때만 펼침) */}
      <details className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700">
          📌 위대한 12주 사용법
        </summary>
        <ul className="ml-4 mt-2 list-disc space-y-1 text-xs text-slate-600">
          <li>
            <strong>3~5개</strong>의 목표만 — 단순화가 핵심
          </li>
          <li>
            <strong>80% 기준</strong>: 100% 목표 중 80%를 넘기면 의미 있는 성과
          </li>
          <li>
            <strong>선행지표</strong> (활동·행동량) → <strong>후행지표</strong> (결과)로 흐름.
            선행지표를 매일 챙기면 후행지표는 자연히 따라옴
          </li>
          <li>
            매주 월요일 WAM에서 <strong>점수표</strong> 갱신 + 다음 주 우선순위 결정
          </li>
          <li>12주 종료 후 1주 휴식 → 다음 사이클 비전·목표 설정</li>
        </ul>
      </details>
    </div>
  )
}
