/**
 * 뉴스레터 캠페인 (Phase 9 #2b)
 * marketing_campaigns 의 newsletter type 만 모아 보기 + 발송 KPI
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
  ChevronLeft,
  Mail,
  AlertCircle,
  ChevronRight,
  Send,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const [newslettersRes, openRateMock] = await Promise.all([
      supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('campaign_type', 'newsletter')
        .order('start_date', { ascending: false, nullsFirst: false })
        .limit(50),
      // 가상 데이터 — 실제 발송 시스템 연동 시 채워짐
      Promise.resolve(null),
    ])
    return { items: newslettersRes.data ?? [], openRateMock }
  } catch {
    return { items: [], openRateMock: null }
  }
}

const STATUSES: Record<string, { label: string; color: string }> = {
  planning: { label: '기획', color: 'bg-slate-100 text-slate-700' },
  active: { label: '진행 중', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '발송 완료', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: '취소', color: 'bg-rose-100 text-rose-700' },
}

export default async function NewsletterPage() {
  const { items } = await loadData()

  const sent = items.filter((c) => c.status === 'completed').length
  const planning = items.filter((c) => c.status === 'planning' || c.status === 'active').length
  const totalReach = items.reduce((s, c) => s + Number(c.metrics_views ?? 0), 0)
  const totalConversions = items.reduce((s, c) => s + Number(c.metrics_conversions ?? 0), 0)
  const totalRevenue = items.reduce((s, c) => s + Number(c.metrics_revenue ?? 0), 0)

  return (
    <div className="space-y-6">
      <Link
        href="/finance/marketing"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        마케팅 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2b 뉴스레터 캠페인
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Mail className="h-5 w-5 text-emerald-500" />
          뉴스레터 캠페인
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          거래처·잠재고객 대상 정기 뉴스레터 — 캠페인 트래커의 newsletter 유형
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">발송 완료</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700">{sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">기획·진행 중</div>
            <div className="text-2xl font-bold tabular-nums text-blue-700">{planning}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">총 도달</div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {totalReach.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">발생 매출</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700">
              {formatKRW(totalRevenue)}
            </div>
            <p className="text-[10px] text-slate-400">전환 {totalConversions}건</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Link
          href="/finance/marketing/campaigns"
          className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Send className="mr-1 h-4 w-4" />
          캠페인 트래커에서 추가
        </Link>
      </div>

      {/* 뉴스레터 리스트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">뉴스레터 이력</CardTitle>
          <CardDescription>최근 50건</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Mail className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">
                아직 뉴스레터 캠페인이 없습니다.{' '}
                <Link
                  href="/finance/marketing/campaigns"
                  className="text-blue-600 hover:underline"
                >
                  캠페인 트래커
                </Link>
                에서 유형을 &quot;뉴스레터&quot;로 설정해 추가하세요.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((c) => {
                const status = STATUSES[c.status] ?? STATUSES.planning
                return (
                  <li key={c.id}>
                    <Link
                      href="/finance/marketing/campaigns"
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{c.name}</span>
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              status.color,
                            )}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                          <span>
                            {c.start_date ?? '?'}{c.end_date && ` ~ ${c.end_date}`}
                          </span>
                          {c.goal && <span className="line-clamp-1">· {c.goal}</span>}
                        </div>
                      </div>
                      <div className="text-right text-[11px] tabular-nums">
                        {Number(c.metrics_views) > 0 && (
                          <div className="text-slate-600">
                            👁 {Number(c.metrics_views).toLocaleString()}
                          </div>
                        )}
                        {Number(c.metrics_revenue) > 0 && (
                          <div className="font-semibold text-emerald-700">
                            {formatKRW(Number(c.metrics_revenue))}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            발송 시스템 연동
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-700">
            현재는 <strong>발송 결과 기록만</strong> 가능합니다. 실제 발송 시스템 연동 옵션:
          </p>
          <ul className="ml-4 mt-2 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>Mailchimp / Stibee / Brevo</strong>: 한국 SaaS 추천
            </li>
            <li>
              <strong>Resend / Postmark</strong>: 개발자 친화적 API
            </li>
            <li>
              <strong>Supabase Edge Function + Email Provider</strong>: 자체 구축
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">
            소규모 팀은 Stibee/Mailchimp 등에서 발송 후 결과만 v1.1 시스템에 기록하는 방식이 효율적.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
