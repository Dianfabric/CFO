/**
 * 12주 사이클 대시보드 (Phase 1 ⑤, PRD #1 ①)
 *
 * 매일 아침 회사 전체 진행 상황 조회.
 * - 상단: Week N/12 + 사이클 종료일 + 다음 WAM
 * - 12주 목표 카드들 (선행/후행 분리)
 * - 자동 후행지표 (현재 사이클 동안의 매출/이익/거래처)
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
  Calendar,
  Clock,
  TrendingUp,
  Wallet,
  Users,
  AlertCircle,
  Target,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { calculateCycleProgress, daysUntilNextMonday } from '@/lib/v11-cycle'
import { formatKRW } from '@/lib/formatters'
import GoalsList from '@/components/v11/cycle/GoalsList'
import type { GoalRow } from '@/components/v11/cycle/GoalEditDialog'
import CycleStartCard from '@/components/v11/cycle/CycleStartCard'
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
        goals: [],
        revenue: 0,
        margin: 0,
        activeClients: 0,
        prevRevenue: 0,
        error: e1?.message ?? '활성 사이클이 없습니다',
      }
    }

    // 목표
    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .eq('cycle_id', cycle.id)
      .order('display_order', { ascending: true })

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
      goals: (goals ?? []) as GoalRow[],
      revenue,
      margin,
      activeClients,
      prevRevenue,
      error: null,
    }
  } catch (e) {
    return {
      cycle: null,
      goals: [] as GoalRow[],
      revenue: 0,
      margin: 0,
      activeClients: 0,
      prevRevenue: 0,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function CyclePage() {
  const { cycle, goals, revenue, margin, activeClients, prevRevenue, error } =
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
  const wamDday = daysUntilNextMonday()
  const revenueDelta =
    prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · Phase 1 ⑤
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">12주 대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">
            사이클 #{cycle.cycle_number} · {cycle.start_date} ~ {cycle.end_date}
          </p>
        </div>
      </div>

      {/* 사이클 진행 카드 (큰 진행 바) */}
      <Card className="overflow-hidden">
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-slate-900">
                  Week {progress.weekNumber}
                </span>
                <span className="text-lg text-slate-400">/ 12</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                <Calendar className="mr-1 inline h-3 w-3" />
                시작 {cycle.start_date} · 종료 {cycle.end_date}
                {' · '}
                <strong className="text-slate-700">D-{progress.daysRemaining}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {wamDday <= 7 && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-800">
                  <Clock className="mr-1 inline h-3 w-3" />
                  다음 WAM: <strong>{wamDday === 0 ? '오늘' : `D-${wamDday}`}</strong>
                </div>
              )}
              <div className="text-right">
                <div className="text-xl font-bold tabular-nums text-emerald-600">
                  {Math.round(progress.totalProgress * 100)}%
                </div>
                <div className="text-[10px] text-slate-400">사이클 진행</div>
              </div>
            </div>
          </div>

          {/* 진행 바 */}
          <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
              style={{ width: `${progress.totalProgress * 100}%` }}
            />
            {/* 12주 마커 */}
            {Array.from({ length: 11 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full w-px bg-white/40"
                style={{ left: `${((i + 1) / 12) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>W1</span>
            <span>W4</span>
            <span>W7</span>
            <span>W10</span>
            <span>W12</span>
          </div>
        </CardContent>
      </Card>

      {/* 비전 (있으면) */}
      {cycle.vision_statement && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  사이클 비전
                </div>
                <p className="mt-1 text-sm text-slate-800">{cycle.vision_statement}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* 12주 목표 */}
      <GoalsList goals={goals} cycleId={cycle.id} />

      {/* 추가 페이지 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">⚡ 12주 사이클 도구</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Link href="/finance/cycle/indicators">
            <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">선·후행 지표</div>
                <div className="text-[11px] text-slate-500">활동 → 결과 흐름 + 페이스</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/cycle/vision">
            <Card className="cursor-pointer transition hover:border-purple-300 hover:bg-purple-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">비전·목표 워크북</div>
                <div className="text-[11px] text-slate-500">5년 → 3년 → 12주 정합성</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/cycle/retro">
            <Card className="cursor-pointer transition hover:border-amber-300 hover:bg-amber-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">12주 회고</div>
                <div className="text-[11px] text-slate-500">잘된/안된/학습/다음 집중</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/cycle/wam-scorecard">
            <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">WAM 자동 점수표</div>
                <div className="text-[11px] text-slate-500">이번 주 자동 집계</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/cycle/history">
            <Card className="cursor-pointer transition hover:border-slate-300 hover:bg-slate-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">사이클 이력</div>
                <div className="text-[11px] text-slate-500">과거 사이클 비교</div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* 안내 */}
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-sm">📌 위대한 12주 사용법</CardTitle>
          <CardDescription className="text-xs">
            매일 보면서 진행 상황 점검 → 매주 월요일 WAM(주간 회의)에서 갱신
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-600">
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
        </CardContent>
      </Card>
    </div>
  )
}
