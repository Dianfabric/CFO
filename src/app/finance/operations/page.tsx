/**
 * 운영 허브 (Phase 4 #2c) — 디안 핵심 차별점: 샘플 추적
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
  Send,
  Package,
  TrendingUp,
  AlertCircle,
  PlusCircle,
  Trophy,
  BookOpen,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createSampleRequest } from '@/app/finance/operations/actions'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()

    const today = new Date()
    const past30 = new Date()
    past30.setDate(past30.getDate() - 30)
    const past30Str = past30.toISOString().split('T')[0]

    const [requestsRecent, items30, topConvertersRes, books] = await Promise.all([
      supabase
        .from('sample_requests')
        .select('*, clients(name)')
        .order('request_date', { ascending: false })
        .limit(15),
      supabase
        .from('sample_items')
        .select('status, unit_cost, quantity, conversion_value, request_id')
        .gte('request_id', 1),
      supabase
        .from('client_sample_analytics')
        .select('*')
        .gt('total_items', 0)
        .order('conversion_rate', { ascending: false })
        .limit(5),
      supabase
        .from('sample_books')
        .select('id, name, season, year, product_count, status')
        .eq('status', 'active')
        .order('year', { ascending: false })
        .limit(8),
    ])

    return {
      recentRequests: requestsRecent.data ?? [],
      items30: items30.data ?? [],
      topConverters: topConvertersRes.data ?? [],
      books: books.data ?? [],
      errors: [requestsRecent.error, items30.error, topConvertersRes.error, books.error].filter(
        Boolean,
      ) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      recentRequests: [],
      items30: [],
      topConverters: [],
      books: [],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function OperationsHubPage() {
  const data = await loadData()

  // KPI 30일
  const totalSent = data.items30.length
  const returned = data.items30.filter((i) => i.status === 'returned').length
  const lost = data.items30.filter((i) => i.status === 'lost').length
  const converted = data.items30.filter((i) => i.status === 'converted').length
  const conversionValue = data.items30.reduce(
    (s, i) => s + Number(i.conversion_value ?? 0),
    0,
  )
  const totalCost = data.items30.reduce(
    (s, i) => s + Number(i.unit_cost ?? 0) * Number(i.quantity ?? 1),
    0,
  )
  const conversionRate = totalSent > 0 ? (converted / totalSent) * 100 : 0
  const roi = totalCost > 0 ? conversionValue / totalCost : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · Phase 4 · #2c 운영 (샘플 추적)
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">운영 허브</h1>
          <p className="mt-1 text-sm text-slate-500">
            <strong>디안 핵심 차별점</strong> — 샘플 큐레이션 → 발송 → 반환/전환 추적
          </p>
        </div>
        <form action={createSampleRequest}>
          <Button type="submit">
            <PlusCircle className="mr-1 h-4 w-4" />
            새 샘플 요청
          </Button>
        </form>
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
                <p className="mt-1 text-xs">v11.4_samples.sql 적용 필요</p>
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
              <span className="text-xs font-medium text-slate-500">샘플 발송 (30일)</span>
              <Send className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {totalSent}
            </div>
            <p className="text-[11px] text-slate-400">
              비용 {formatKRW(totalCost)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">전환율</span>
              <TrendingUp
                className={cn(
                  'h-4 w-4',
                  conversionRate >= 30 ? 'text-emerald-500' : 'text-slate-400',
                )}
              />
            </div>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                conversionRate >= 30 ? 'text-emerald-700' : 'text-slate-900',
              )}
            >
              {conversionRate.toFixed(1)}%
            </div>
            <p className="text-[11px] text-slate-400">
              전환 {converted} / 발송 {totalSent}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">전환 매출</span>
              <Package className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700">
              {formatKRW(conversionValue)}
            </div>
            <p className="text-[11px] text-slate-400">
              샘플에서 발생한 거래 매출
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">샘플 ROI</span>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </div>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                roi >= 5 ? 'text-emerald-700' : roi >= 1 ? 'text-amber-700' : 'text-slate-900',
              )}
            >
              {roi.toFixed(1)}x
            </div>
            <p className="text-[11px] text-slate-400">
              매출 ÷ 샘플 비용 (반환 {returned}, 분실 {lost})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 최근 샘플 요청 + Top 전환 거래처 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" />
              최근 샘플 요청
            </CardTitle>
            <CardDescription>최근 15건</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentRequests.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                아직 샘플 요청이 없습니다
              </p>
            ) : (
              <ul className="space-y-2">
                {data.recentRequests.slice(0, 10).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/finance/operations/samples/${r.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50/50 p-2 text-xs hover:border-blue-300 hover:bg-blue-50/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate">
                          {r.clients?.name ?? `#${r.client_id}`}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {r.request_date} · {r.total_items}건 ·{' '}
                          <span
                            className={cn(
                              'rounded px-1 py-0.5 font-semibold',
                              r.status === 'pending'
                                ? 'bg-slate-100 text-slate-600'
                                : r.status === 'shipped' || r.status === 'sent'
                                ? 'bg-blue-100 text-blue-700'
                                : r.status === 'returned'
                                ? 'bg-amber-100 text-amber-800'
                                : r.status === 'converted'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700',
                            )}
                          >
                            {r.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-emerald-700 tabular-nums">
                        {Number(r.conversion_value ?? 0) > 0 &&
                          formatKRW(Number(r.conversion_value))}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top 전환 거래처
            </CardTitle>
            <CardDescription>샘플 → 거래 전환율 상위 5</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topConverters.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                아직 데이터가 없습니다
              </p>
            ) : (
              <ul className="space-y-2">
                {data.topConverters.map((c, i) => (
                  <li
                    key={c.client_id}
                    className="flex items-center gap-2 rounded-md border border-slate-100 p-2 text-xs"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-800">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 truncate">
                        {c.client_name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {c.total_items}건 → 전환 {c.converted_count} · 매출{' '}
                        {formatKRW(Number(c.total_conversion_value))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold tabular-nums text-emerald-700">
                        {Number(c.conversion_rate).toFixed(0)}%
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 샘플북 + 페이지 진입 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">⚡ 운영 페이지</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Link href="/finance/operations/samples">
            <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
              <CardContent className="space-y-1 py-3">
                <Send className="h-5 w-5 text-blue-500" />
                <div className="text-sm font-semibold">샘플 요청 트래커</div>
                <div className="text-[11px] text-slate-500">
                  발송·반환·전환 전체 흐름
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/operations/sample-books">
            <Card className="cursor-pointer transition hover:border-purple-300 hover:bg-purple-50/30">
              <CardContent className="space-y-1 py-3">
                <BookOpen className="h-5 w-5 text-purple-500" />
                <div className="text-sm font-semibold">시즌 샘플북</div>
                <div className="text-[11px] text-slate-500">SS·FW 룩북 큐레이션</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/operations/clients">
            <Card className="cursor-pointer transition hover:border-emerald-300 hover:bg-emerald-50/30">
              <CardContent className="space-y-1 py-3">
                <Users className="h-5 w-5 text-emerald-500" />
                <div className="text-sm font-semibold">디자이너별 패턴</div>
                <div className="text-[11px] text-slate-500">샘플 사용·전환 패턴</div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* 샘플북 미리보기 */}
      {data.books.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-500" />
              활성 샘플북 ({data.books.length}개)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {data.books.map((b) => (
                <Link
                  key={b.id}
                  href={`/finance/operations/sample-books`}
                  className="rounded-md border border-slate-200 bg-white p-2 text-xs hover:border-purple-300"
                >
                  <div className="font-semibold text-slate-800 truncate">
                    {b.name}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    {b.year && `${b.year} `}
                    {b.season && `· ${b.season.toUpperCase()}`}
                  </div>
                  <div className="mt-1 text-[10px] text-purple-700">
                    제품 {b.product_count}개
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 가이드 */}
      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 디안 샘플 운영 핵심</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>샘플은 인테리어 디자이너의 영감 도구</strong> — 단순 발송 X, 큐레이션과
              스토리가 있는 패키지
            </li>
            <li>
              <strong>시즌 샘플북</strong>: SS·FW 룩북으로 묶어 디자이너 작업실에 비치되도록
            </li>
            <li>
              <strong>전환율 30%+</strong>가 우수 — 거래처별 전환율로 효율적인 큐레이션 가능
            </li>
            <li>
              <strong>반환 vs 분실</strong>: 분실율이 높으면 큐레이션이 맞지 않거나 디자이너가
              관심 없음
            </li>
            <li>
              <strong>샘플 ROI</strong> = 발생 매출 ÷ 샘플 비용 — 5x 이상이 건강한 수준
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
