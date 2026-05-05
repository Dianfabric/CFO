/**
 * 샘플 요청 리스트 (Phase 4 #2c)
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
  PlusCircle,
  ChevronRight,
  Package,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createSampleRequest } from '@/app/finance/operations/actions'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-slate-100 text-slate-700' },
  shipped: { label: '발송됨', color: 'bg-blue-100 text-blue-700' },
  sent: { label: '발송됨', color: 'bg-blue-100 text-blue-700' },
  returned: { label: '반환됨', color: 'bg-amber-100 text-amber-800' },
  partial: { label: '일부 전환', color: 'bg-purple-100 text-purple-700' },
  converted: { label: '전환 완료', color: 'bg-emerald-100 text-emerald-700' },
  lost: { label: '분실', color: 'bg-rose-100 text-rose-700' },
  cancelled: { label: '취소', color: 'bg-slate-200 text-slate-600' },
}

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sample_requests')
      .select('*, clients(name, current_stage, tier)')
      .order('request_date', { ascending: false })
      .limit(100)
    return { items: data ?? [], error: error?.message ?? null }
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export default async function SamplesListPage() {
  const { items, error } = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/operations"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        운영 허브
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · #2c 샘플 요청
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">샘플 요청 트래커</h1>
          <p className="mt-1 text-sm text-slate-500">
            전체 샘플 요청 흐름 — 대기·발송·반환·전환·분실
          </p>
        </div>
        <form action={createSampleRequest}>
          <Button type="submit">
            <PlusCircle className="mr-1 h-4 w-4" />
            새 샘플 요청
          </Button>
        </form>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error} — v11.4_samples.sql 적용 필요
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>요청 이력</CardTitle>
          <CardDescription>최근 100건</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Package className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">
                아직 샘플 요청이 없습니다
              </p>
              <form action={createSampleRequest} className="mt-4">
                <Button type="submit" size="sm">
                  <PlusCircle className="mr-1 h-3.5 w-3.5" />
                  첫 요청 만들기
                </Button>
              </form>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((r) => {
                const status = STATUS_INFO[r.status] ?? STATUS_INFO.pending
                return (
                  <li key={r.id}>
                    <Link
                      href={`/finance/operations/samples/${r.id}`}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <Package className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {r.clients?.name ?? `#${r.client_id}`}
                          </span>
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              status.color,
                            )}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {r.request_date} · 품목 {r.total_items}건 ·{' '}
                          {r.purpose ?? '목적 미설정'}
                          {r.ship_date && (
                            <span className="ml-1">· 발송 {r.ship_date}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-[11px]">
                        {Number(r.total_cost ?? 0) > 0 && (
                          <div className="text-slate-500 tabular-nums">
                            비용 {formatKRW(Number(r.total_cost))}
                          </div>
                        )}
                        {Number(r.conversion_value ?? 0) > 0 && (
                          <div className="text-emerald-700 font-semibold tabular-nums">
                            전환 {formatKRW(Number(r.conversion_value))}
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
    </div>
  )
}
