/**
 * 배송·물류 (Phase 9 #2c)
 * 운송장·납기 추적 (placeholder + 외부 연동 안내)
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
  Truck,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('transactions')
      .select(
        'id, transaction_date, delivery_date, payment_due_date, total_amount, stage, client_id, clients(name)',
      )
      .in('stage', ['confirmed', 'shipping'])
      .order('delivery_date', { ascending: true, nullsFirst: false })
      .limit(50)
    return { items: data ?? [] }
  } catch {
    return { items: [] }
  }
}

export default async function LogisticsPage() {
  const { items } = await loadData()

  const today = new Date().toISOString().split('T')[0]
  const overdue = items.filter(
    (t) => t.delivery_date && t.delivery_date < today && t.stage === 'confirmed',
  )
  const upcoming = items.filter(
    (t) => t.delivery_date && t.delivery_date >= today && t.stage === 'confirmed',
  )
  const shipping = items.filter((t) => t.stage === 'shipping')

  return (
    <div className="space-y-6">
      <Link
        href="/finance/operations"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        운영 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2c 배송·물류
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Truck className="h-5 w-5 text-slate-500" />
          배송·물류
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          납기 추적 — 거래의 stage가 confirmed/shipping 인 건들
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <Card className={overdue.length > 0 ? 'border-rose-300' : ''}>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">납기 지연</div>
            <div className={overdue.length > 0 ? 'text-2xl font-bold text-rose-700 tabular-nums' : 'text-2xl font-bold text-emerald-700 tabular-nums'}>
              {overdue.length}
            </div>
            <p className="text-[11px] text-slate-400">즉시 조치 필요</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">배송 중</div>
            <div className="text-2xl font-bold tabular-nums text-blue-700">{shipping.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">예정</div>
            <div className="text-2xl font-bold tabular-nums text-slate-700">{upcoming.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* 납기 지연 */}
      {overdue.length > 0 && (
        <Card className="border-rose-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              납기 지연 (즉시 조치)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {overdue.map((t) => (
                <li key={t.id} className="px-4 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold">{(t.clients as { name?: string } | null)?.name ?? '?'}</span>
                      <span className="ml-2 text-rose-600">
                        예정일 {t.delivery_date}
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums text-slate-700">
                      {Number(t.total_amount).toLocaleString()}원
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 진행 리스트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">진행 중·예정 (납기 임박순)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {[...shipping, ...upcoming].length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">진행 중인 거래 없음</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="px-3 py-2 text-left">거래처</th>
                    <th className="px-3 py-2 text-left">단계</th>
                    <th className="px-3 py-2 text-left">거래일</th>
                    <th className="px-3 py-2 text-left">납기 예정일</th>
                    <th className="px-3 py-2 text-right">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {[...shipping, ...upcoming].map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="px-3 py-1.5">{(t.clients as { name?: string } | null)?.name ?? '?'}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            t.stage === 'shipping'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.stage}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-slate-600">{t.transaction_date}</td>
                      <td className="px-3 py-1.5 text-slate-600">{t.delivery_date ?? '—'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {Number(t.total_amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-amber-500" />
            외부 연동 안내
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-700">
            현재는 거래 stage 기반 단순 추적입니다. 다음 단계로 확장 예정:
          </p>
          <ul className="ml-4 mt-2 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>운송장 번호</strong>: transactions 테이블에 tracking_no 컬럼 추가
            </li>
            <li>
              <strong>택배사 API 연동</strong>: 실시간 배송 상태 자동 갱신
            </li>
            <li>
              <strong>납기 알림</strong>: 납기 D-3 자동 알림 (텔레그램·이메일)
            </li>
            <li>
              <strong>물류 비용 분석</strong>: 거래별 운송비 → 마진 정확도 향상
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
