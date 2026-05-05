/**
 * 가격 의사결정 목록 (Phase 1 ⑩, PRD #4 ③)
 *
 * 4단계 워크플로우 통과한 가격 결정의 모든 흐름:
 * - 작성 중 → 승인 → 시행 → 90일 검증 완료
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
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Star,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createDecision } from '@/app/finance/pricing/actions'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TYPE_LABEL: Record<string, string> = {
  new_product: '신제품',
  price_increase: '가격 인상',
  price_decrease: '가격 인하',
  discount: '할인 정책',
  differentiation: '거래처 차별화',
}

const TYPE_TONE: Record<string, string> = {
  new_product: 'bg-blue-100 text-blue-700',
  price_increase: 'bg-rose-100 text-rose-700',
  price_decrease: 'bg-emerald-100 text-emerald-700',
  discount: 'bg-amber-100 text-amber-700',
  differentiation: 'bg-purple-100 text-purple-700',
}

interface DecisionListRow {
  id: number
  decision_date: string
  type: string
  previous_price: number | null
  decided_price: number | null
  decision_rationale: string | null
  ceo_approved: boolean
  approved_at: string | null
  validation_due_date: string | null
  validation_completed: boolean
  quality_score: number | null
  created_at: string
}

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('price_decisions')
      .select(
        'id, decision_date, type, previous_price, decided_price, decision_rationale, ceo_approved, approved_at, validation_due_date, validation_completed, quality_score, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(100)

    return {
      decisions: (data ?? []) as DecisionListRow[],
      error: error?.message ?? null,
    }
  } catch (e) {
    return {
      decisions: [] as DecisionListRow[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

function statusOf(d: DecisionListRow): { label: string; tone: string; icon: React.ReactNode } {
  if (d.validation_completed) {
    return {
      label: '검증 완료',
      tone: 'bg-emerald-100 text-emerald-700',
      icon: <CheckCircle className="h-3 w-3" />,
    }
  }
  if (d.ceo_approved) {
    const dueDate = d.validation_due_date ? new Date(d.validation_due_date) : null
    const overdue = dueDate && dueDate < new Date()
    if (overdue) {
      return {
        label: '검증 필요',
        tone: 'bg-rose-100 text-rose-700',
        icon: <AlertTriangle className="h-3 w-3" />,
      }
    }
    return {
      label: '시행 중',
      tone: 'bg-blue-100 text-blue-700',
      icon: <Clock className="h-3 w-3" />,
    }
  }
  return {
    label: '작성 중',
    tone: 'bg-slate-100 text-slate-600',
    icon: <Clock className="h-3 w-3" />,
  }
}

export default async function PricingListPage() {
  const { decisions, error } = await loadData()

  const draftCount = decisions.filter((d) => !d.ceo_approved).length
  const inFlightCount = decisions.filter((d) => d.ceo_approved && !d.validation_completed).length
  const overdueCount = decisions.filter(
    (d) =>
      d.ceo_approved &&
      !d.validation_completed &&
      d.validation_due_date &&
      new Date(d.validation_due_date) < new Date(),
  ).length
  const completedCount = decisions.filter((d) => d.validation_completed).length

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · Phase 1 ⑩
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">4단계 가격 워크플로우</h1>
          <p className="mt-1 text-sm text-slate-500">
            전략 → 분석 → 결정 → 실행 + 90일 검증. &quot;그때그때&quot; 가격 결정 차단.
          </p>
        </div>
        <form action={createDecision}>
          <Button type="submit">
            <Plus className="mr-1 h-4 w-4" />새 결정 시작
          </Button>
        </form>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>{error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI 4개 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">작성 중</div>
            <div className="text-2xl font-bold tabular-nums text-slate-700">
              {draftCount}
            </div>
            <div className="text-[11px] text-slate-400">미승인 — 4단계 채워서 승인 요청</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">시행 중</div>
            <div className="text-2xl font-bold tabular-nums text-blue-700">
              {inFlightCount}
            </div>
            <div className="text-[11px] text-slate-400">승인 후 90일 검증 대기</div>
          </CardContent>
        </Card>
        <Card className={overdueCount > 0 ? 'border-rose-300' : ''}>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">검증 필요</div>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                overdueCount > 0 ? 'text-rose-600' : 'text-slate-400',
              )}
            >
              {overdueCount}
            </div>
            <div className="text-[11px] text-slate-400">90일 경과 — 결과 점검 필요</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">검증 완료</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700">
              {completedCount}
            </div>
            <div className="text-[11px] text-slate-400">결과의 질 평가 완료</div>
          </CardContent>
        </Card>
      </div>

      {/* 결정 리스트 */}
      <Card>
        <CardHeader>
          <CardTitle>의사결정 이력</CardTitle>
          <CardDescription>
            클릭하면 4단계 상세 작성·편집 화면으로 이동합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {decisions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-slate-500">
                아직 가격 의사결정이 없습니다.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                상단의 &quot;새 결정 시작&quot; 버튼으로 첫 4단계 워크플로우를 시작하세요.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="px-4 py-2 text-left">결정일</th>
                    <th className="px-4 py-2 text-left">유형</th>
                    <th className="px-4 py-2 text-left">상태</th>
                    <th className="px-4 py-2 text-right">이전 → 결정</th>
                    <th className="px-4 py-2 text-left">근거</th>
                    <th className="px-4 py-2 text-right">검증일 / 점수</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d) => {
                    const status = statusOf(d)
                    const change =
                      d.previous_price && d.decided_price
                        ? ((Number(d.decided_price) - Number(d.previous_price)) /
                            Number(d.previous_price)) *
                          100
                        : null
                    return (
                      <tr key={d.id} className="border-b hover:bg-slate-50 last:border-0">
                        <td className="px-4 py-2">
                          <Link
                            href={`/finance/pricing/${d.id}`}
                            className="font-medium text-slate-700 hover:underline"
                          >
                            {d.decision_date}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              TYPE_TONE[d.type] ?? 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {TYPE_LABEL[d.type] ?? d.type}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              status.tone,
                            )}
                          >
                            {status.icon}
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-xs tabular-nums">
                          {d.previous_price ? formatKRW(Number(d.previous_price)) : '—'}
                          {' → '}
                          {d.decided_price ? formatKRW(Number(d.decided_price)) : '—'}
                          {change !== null && (
                            <span
                              className={cn(
                                'ml-1 text-[10px] font-semibold',
                                change > 0 ? 'text-rose-600' : 'text-emerald-600',
                              )}
                            >
                              ({change > 0 ? '+' : ''}
                              {change.toFixed(1)}%)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 max-w-xs truncate text-xs text-slate-600">
                          {d.decision_rationale ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-[11px] text-slate-500">
                          {d.validation_due_date ?? '—'}
                          {d.quality_score && (
                            <div className="mt-0.5 inline-flex items-center gap-0.5 text-amber-500">
                              {Array.from({ length: d.quality_score }).map((_, i) => (
                                <Star key={i} className="h-2.5 w-2.5 fill-current" />
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 추가 페이지 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">⚡ 가격 결정 페이지</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link href="/finance/pricing/workbook">
            <Card className="cursor-pointer transition hover:border-purple-300 hover:bg-purple-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">② 가치 정의 워크북</div>
                <div className="text-[11px] text-slate-500">라인별 가치 3요소</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/pricing/policies">
            <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">⑤ 거래처 차별화</div>
                <div className="text-[11px] text-slate-500">VIP·대량 할인율</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/pricing/promotions">
            <Card className="cursor-pointer transition hover:border-amber-300 hover:bg-amber-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">⑥ 프로모션 정책</div>
                <div className="text-[11px] text-slate-500">시즌·번들·티어</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/pricing/simulator">
            <Card className="cursor-pointer transition hover:border-emerald-300 hover:bg-emerald-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">⑦ 가격 시뮬레이터</div>
                <div className="text-[11px] text-slate-500">탄력성 시뮬레이션</div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* 가이드 */}
      <Card className="border-amber-100 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-sm">📌 4단계 워크플로우 핵심</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>1. 전략 (Why)</strong> — 포지셔닝과 이익 목표를 먼저 정한다. 가격 변경의 목적이
              명확해야 한다.
            </li>
            <li>
              <strong>2. 시장 분석 (Where)</strong> — 원가, 경쟁사 가격, 고객 지불용의를 분석. 데이터
              없이 결정 안 한다.
            </li>
            <li>
              <strong>3. 가격 결정 (What)</strong> — 후보 가격 3개를 비교 시뮬레이션. 단일 가격이
              아니라 옵션 비교.
            </li>
            <li>
              <strong>4. 실행 (How)</strong> — 시행일, 가격 심리학, 가치 소통 계획까지 정한다.
            </li>
            <li>
              <strong>승인</strong> — 4단계가 다 채워져야 CEO가 승인할 수 있다. 자동으로 90일 검증
              예정일이 잡힌다.
            </li>
            <li>
              <strong>90일 검증</strong> — 결과가 예측대로 나왔는지 점검. 1~5점 품질 점수로 의사결정
              자체의 질을 평가. 다음 결정의 학습 자료가 된다.
            </li>
          </ul>
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            💡 <strong>지몬의 핵심</strong>: 가격은 회사의 가장 강력한 이익 레버다. &quot;그때그때&quot;
            결정하지 말고, 매번 4단계를 거치는 것만으로도 이익이 5~10% 늘어난다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
