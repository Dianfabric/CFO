/**
 * 재무 메인 대시보드 (Phase 1 ① / PRD #3 ①)
 *
 * Server Component — Supabase에서 데이터 fetch.
 * - 미인증 상태: RLS가 transactions 차단 → 빈 차트 + 빈 KPI (페이지 자체는 정상 렌더)
 * - CEO 인증 후: 본인 회사 전체 데이터 표시
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, TrendingUp, Wallet, AlertCircle, Receipt } from 'lucide-react'
import KPICard from '@/components/v11/finance/KPICard'
import SegmentMatrix from '@/components/v11/finance/SegmentMatrix'
import TierBreakdown from '@/components/v11/finance/TierBreakdown'
import MonthlyPLChart from '@/components/v11/finance/MonthlyPLChart'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/formatters'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadDashboardData() {
  try {
    const supabase = await createClient()

    const [monthlyRes, segmentRes, tierRes, arRes, todayRes] = await Promise.all([
      supabase.from('monthly_pl').select('*').order('month', { ascending: false }).limit(12),
      supabase.from('revenue_by_segment').select('*'),
      supabase.from('revenue_by_tier').select('*'),
      supabase
        .from('outstanding_payments')
        .select('client_id, transaction_count, total_outstanding')
        .limit(100),
      // 오늘 KPI: 가장 최근 일일결산
      supabase
        .from('daily_closes')
        .select('*')
        .order('close_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    return {
      monthly: monthlyRes.data ?? [],
      segments: segmentRes.data ?? [],
      tiers: tierRes.data ?? [],
      receivables: arRes.data ?? [],
      todayClose: todayRes.data ?? null,
      errors: [
        monthlyRes.error,
        segmentRes.error,
        tierRes.error,
        arRes.error,
        todayRes.error,
      ].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      monthly: [],
      segments: [],
      tiers: [],
      receivables: [],
      todayClose: null,
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function FinanceDashboardPage() {
  const { monthly, segments, tiers, receivables, todayClose, errors } = await loadDashboardData()

  // KPI 계산
  const todayRevenue = Number(todayClose?.total_revenue) || 0
  const todayMargin = Number(todayClose?.contribution_margin) || 0
  const todayTxCount = Number(todayClose?.transaction_count) || 0

  // 이번 달 (가장 최근 month_pl 행)
  const thisMonth = monthly[0]
  const monthRevenue = Number(thisMonth?.revenue) || 0
  const monthMargin = Number(thisMonth?.contribution_margin) || 0
  const monthMarginRate = Number(thisMonth?.contribution_margin_rate) || 0

  // 미수금
  const totalOutstanding = receivables.reduce(
    (sum, r) => sum + (Number(r.total_outstanding) || 0),
    0,
  )

  const isEmpty =
    monthly.length === 0 &&
    segments.every((s) => Number(s.revenue) === 0) &&
    !todayClose

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 신규 · Phase 1 ①
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">재무 메인 대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">
            매일 보는 화면 — 오늘 / 이번 달 / 트렌드 / 24셀 매트릭스 / 4티어 분포
          </p>
        </div>

        <div className="text-right text-xs text-slate-400">
          <div>데이터 출처: Supabase (v1.1 DB)</div>
          <div>v1.0 데이터와 별도 · 동기화 후 합산 가능</div>
        </div>
      </div>

      {/* 비어있을 때 안내 배너 */}
      {isEmpty && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold">아직 데이터가 비어 있습니다.</p>
                <p className="mt-1 text-amber-800">
                  Phase 1 ②(거래 입력 페이지)가 만들어지면 직접 입력하실 수 있고, 또는
                  Phase 0.5 마스터 데이터 동기화 시점에 한 번에 채워집니다. 그 때까지는
                  구조와 빈 차트만 보입니다.
                </p>
                <p className="mt-2 text-[11px] text-amber-700">
                  💡 24셀 매트릭스와 4티어 분포는 데이터가 없어도 셀 구조가 보입니다 ―
                  비즈니스 모델을 한눈에 확인할 수 있도록.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 에러 배너 (인증 누락 등) */}
      {errors.length > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div className="text-sm text-rose-900">
                <p className="font-semibold">데이터 가져오는 중 일부 오류가 있습니다.</p>
                <ul className="mt-1 list-disc pl-4 text-rose-800">
                  {errors.slice(0, 3).map((e, i) => (
                    <li key={i} className="text-[11px]">{e.message}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-rose-700">
                  대부분 인증 미연결 또는 RLS 차단입니다. v1.1 로그인 페이지 추가 후 정상 동작합니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          label="오늘 매출"
          value={formatKRW(todayRevenue)}
          hint={todayClose ? `${todayTxCount}건 거래` : '거래 없음'}
          icon={TrendingUp}
          tone={todayRevenue > 0 ? 'positive' : 'neutral'}
        />
        <KPICard
          label="이번 달 매출"
          value={formatKRW(monthRevenue)}
          hint={thisMonth ? `${thisMonth.transaction_count}건 · ${thisMonth.active_clients}고객` : '데이터 없음'}
          icon={Receipt}
          tone={monthRevenue > 0 ? 'positive' : 'neutral'}
        />
        <KPICard
          label="이번 달 공헌이익"
          value={formatKRW(monthMargin)}
          hint={monthRevenue > 0 ? `이익률 ${monthMarginRate.toFixed(1)}%` : '데이터 없음'}
          icon={Wallet}
          tone={monthMargin > 0 ? 'positive' : 'neutral'}
        />
        <KPICard
          label="미수금 잔액"
          value={formatKRW(totalOutstanding)}
          hint={receivables.length > 0 ? `${receivables.length}건` : '미수 없음'}
          icon={AlertCircle}
          tone={totalOutstanding > 0 ? 'negative' : 'neutral'}
        />
      </div>

      {/* 메인 차트 그리드 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 월별 P&L (2/3 폭) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>월별 매출 · 변동비 · 공헌이익률</CardTitle>
            <CardDescription>최근 12개월 추이</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyPLChart data={monthly} />
          </CardContent>
        </Card>

        {/* 4티어 분포 (1/3 폭) */}
        <Card>
          <CardHeader>
            <CardTitle>4티어 매출 비중</CardTitle>
            <CardDescription>저가 → 럭셔리 분포</CardDescription>
          </CardHeader>
          <CardContent>
            {tiers.length > 0 ? (
              <TierBreakdown data={tiers} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                티어 마스터 데이터를 불러오지 못했습니다
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 24셀 매트릭스 (full width) */}
      <Card>
        <CardHeader>
          <CardTitle>24셀 매출 매트릭스</CardTitle>
          <CardDescription>
            6직업군 × 4제품군 — 셀 색상 강도가 매출 비중을 나타냅니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {segments.length > 0 ? (
            <SegmentMatrix data={segments} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              세그먼트 마스터 데이터를 불러오지 못했습니다
            </p>
          )}
        </CardContent>
      </Card>

      {/* 추가 분석 페이지 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">⚡ 추가 재무 분석</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link href="/finance/accounting">
            <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">회계법인 연동</div>
                <div className="text-[11px] text-slate-500">월결산 export</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/equity">
            <Card className="cursor-pointer transition hover:border-emerald-300 hover:bg-emerald-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">자기자본 분석</div>
                <div className="text-[11px] text-slate-500">YTD 손익 + 비교</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/bsc">
            <Card className="cursor-pointer transition hover:border-purple-300 hover:bg-purple-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">BSC 4관점</div>
                <div className="text-[11px] text-slate-500">통합 점검</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/ltv">
            <Card className="cursor-pointer transition hover:border-amber-300 hover:bg-amber-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">LTV·CAC</div>
                <div className="text-[11px] text-slate-500">거래처 수익성</div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* 다음 단계 안내 (개발 가이드) */}
      <Card className="border-slate-200 bg-slate-50">
        <CardContent>
          <div className="space-y-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">📌 Phase 1 다음 페이지 (예정)</p>
            <ul className="ml-4 list-disc space-y-0.5">
              <li>② 거래 입력 — 모든 데이터의 출발점 (PRD #2c ②)</li>
              <li>③ 일일 운영 대시보드 — 매일 아침 진입 (PRD #2c ①)</li>
              <li>④ 매출 인수분해 — 24셀 상세 분해 (PRD #3 ②)</li>
              <li>⑤ 12주 대시보드 — 사이클 운영 (PRD #1 ①)</li>
            </ul>
            <p className="pt-1 text-[11px] text-slate-500">
              v1.0 11개 메뉴는 그대로 운영 중입니다. 사이드바에서 그대로 접근하실 수 있습니다.
              <Link href="/" className="ml-2 text-blue-600 hover:underline">
                → v1.0 대시보드로
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
