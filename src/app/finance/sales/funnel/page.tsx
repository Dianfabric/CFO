/**
 * 7단계 영업 프로세스 트래커 (Phase 2 #2a ⑤)
 *
 * Kanban 스타일: 7개 단계 컬럼 + 각 컬럼에 거래처 카드.
 * 카드 클릭 → 단계 이동 모달.
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
  Trophy,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  SALES_STAGE_LABEL,
  SALES_STAGE_VALUES,
  SALES_STAGE_COLOR,
  CLIENT_TIER_COLOR,
  CLIENT_TIER_LABEL,
} from '@/lib/v11-labels'
import StageChangeButton from '@/components/v11/sales/StageChangeButton'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ClientLite {
  id: number
  name: string
  current_stage: string | null
  tier: string | null
  dream100: boolean | null
  last_contact_date: string | null
  lifecycle_stage: string | null
}

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('clients')
      .select(
        'id, name, current_stage, tier, dream100, last_contact_date, lifecycle_stage',
      )
      .eq('active', true)
      .order('dream100', { ascending: false })
      .order('last_contact_date', { ascending: false, nullsFirst: false })

    return {
      clients: (data ?? []) as ClientLite[],
      error: error?.message ?? null,
    }
  } catch (e) {
    return {
      clients: [] as ClientLite[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

function daysSince(date: string | null): number | null {
  if (!date) return null
  const ms = Date.now() - new Date(date).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export default async function FunnelPage() {
  const { clients, error } = await loadData()

  // 단계별 그룹핑
  const byStage = new Map<string, ClientLite[]>()
  for (const s of SALES_STAGE_VALUES) byStage.set(s, [])
  for (const c of clients) {
    const s = c.current_stage ?? 'prospecting'
    if (byStage.has(s)) byStage.get(s)!.push(c)
  }

  return (
    <div className="space-y-6">
      <Link
        href="/finance/sales"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        영업 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2a ⑤ 7단계 트래커
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">7단계 영업 프로세스 트래커</h1>
        <p className="mt-1 text-sm text-slate-500">
          트레이시 7단계 — 카드 클릭 시 단계 이동 (활동 1건 자동 기록 + clients 업데이트)
        </p>
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

      {/* 7개 컬럼 (스크롤 가능) */}
      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[1100px] grid-cols-7 gap-3">
          {SALES_STAGE_VALUES.map((stage) => {
            const list = byStage.get(stage) ?? []
            return (
              <div key={stage} className="space-y-2">
                <div
                  className={cn(
                    'rounded-md px-2 py-1.5 text-center text-xs font-bold',
                    SALES_STAGE_COLOR[stage] ?? 'bg-slate-100 text-slate-700',
                  )}
                >
                  {SALES_STAGE_LABEL[stage]}
                  <span className="ml-1 text-[10px] opacity-70">({list.length})</span>
                </div>

                {list.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-2 py-6 text-center text-[11px] text-slate-400">
                    비어있음
                  </div>
                ) : (
                  list.map((c) => {
                    const dsc = daysSince(c.last_contact_date)
                    const stale = dsc !== null && dsc > 30
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          'rounded-md border bg-white p-2 text-xs shadow-sm',
                          stale ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200',
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              {c.dream100 && (
                                <Trophy className="h-3 w-3 shrink-0 text-amber-500" />
                              )}
                              <span className="truncate font-semibold text-slate-800">
                                {c.name}
                              </span>
                            </div>
                            {c.tier && (
                              <span
                                className={cn(
                                  'mt-0.5 inline-block rounded px-1 py-0.5 text-[9px] font-semibold',
                                  CLIENT_TIER_COLOR[c.tier] ?? 'bg-slate-100 text-slate-600',
                                )}
                              >
                                {CLIENT_TIER_LABEL[c.tier] ?? c.tier}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px]">
                          <span
                            className={cn(
                              'flex items-center gap-0.5',
                              stale ? 'text-rose-600' : 'text-slate-500',
                            )}
                          >
                            <Calendar className="h-2.5 w-2.5" />
                            {dsc === null
                              ? '컨택 없음'
                              : dsc === 0
                              ? '오늘'
                              : `${dsc}일 전`}
                          </span>
                          <StageChangeButton
                            clientId={c.id}
                            clientName={c.name}
                            currentStage={c.current_stage}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 가이드 */}
      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 트레이시 7단계 영업 프로세스</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="ml-4 list-decimal space-y-1 text-xs text-slate-700">
            <li>
              <strong>탐색 (Prospecting)</strong> — 잠재 거래처 발굴, 니즈 가설 수립
            </li>
            <li>
              <strong>관계 형성 (Rapport)</strong> — 친밀감과 신뢰 구축, 첫 컨택
            </li>
            <li>
              <strong>니즈 파악 (Needs)</strong> — 인터뷰·관찰로 진짜 니즈 확인
            </li>
            <li>
              <strong>제안 (Presentation)</strong> — 큐레이션·샘플·견적
            </li>
            <li>
              <strong>이의 처리 (Objection)</strong> — 반대 의견에 응대 → 거절 학습 누적
            </li>
            <li>
              <strong>성사 (Closing)</strong> — 수주·계약, 첫 거래 발생
            </li>
            <li>
              <strong>사후 관리 (Follow-up)</strong> — 재구매·추천 유도, LTV 극대화
            </li>
          </ol>
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50/50 p-2 text-[11px] text-rose-800">
            ⚠ 30일 이상 컨택 없는 거래처는 빨간색 표시 — 이탈 위험. 우선 후속 조치하세요.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
