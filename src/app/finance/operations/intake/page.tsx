/**
 * 입고 워크플로우 (#10) — 칸반 허브
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
  PackageOpen,
  Plus,
  BookOpen,
  Inbox,
  ClipboardList,
  Target,
  Zap,
  Activity,
  Archive,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Stage } from '@/lib/v11-intake/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STAGES: { key: Stage; label: string; icon: typeof Inbox; cls: string }[] = [
  { key: 'arrived', label: '1. 입고', icon: Inbox, cls: 'border-slate-300 bg-slate-50' },
  {
    key: 'evaluating',
    label: '2. 평가',
    icon: ClipboardList,
    cls: 'border-blue-300 bg-blue-50',
  },
  { key: 'planned', label: '3. 기획', icon: Target, cls: 'border-amber-300 bg-amber-50' },
  {
    key: 'in_action',
    label: '4. 실행',
    icon: Zap,
    cls: 'border-emerald-300 bg-emerald-50',
  },
  {
    key: 'tracking',
    label: '5. 추적',
    icon: Activity,
    cls: 'border-purple-300 bg-purple-50',
  },
  { key: 'archived', label: '종결', icon: Archive, cls: 'border-stone-300 bg-stone-50' },
]

const TIER_BG: Record<string, string> = {
  value: 'bg-blue-100 text-blue-800',
  mid: 'bg-slate-100 text-slate-800',
  premium: 'bg-amber-100 text-amber-800',
  luxury: 'bg-stone-900 text-stone-100',
}

const DIVISION_LABEL: Record<string, string> = {
  sofa: '소파',
  curtain: '커튼',
  wall: '벽',
  accessory: '소품',
}

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('incoming_samples')
      .select(
        'id, name, supplier, source, arrival_date, stage, division, recommended_tier, competitive_score',
      )
      .order('arrival_date', { ascending: false })
      .limit(120)

    return { rows: data ?? [], error: error?.message }
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export default async function IntakeHubPage() {
  const { rows, error } = await loadData()

  const grouped: Record<Stage, typeof rows> = {
    arrived: [],
    evaluating: [],
    planned: [],
    in_action: [],
    tracking: [],
    archived: [],
  }
  for (const r of rows) {
    const s = (r.stage as Stage) ?? 'arrived'
    if (grouped[s]) grouped[s].push(r)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #10 입고 워크플로우
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <PackageOpen className="h-5 w-5 text-slate-500" />
          신제품 샘플 입고 워크플로우
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          입고 → 평가 → 기획 → 실행 → 추적 — 5단계 칸반 보드
        </p>
      </div>

      {/* 액션 영역 */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/finance/operations/intake/new"
          className="inline-flex h-9 items-center rounded-md bg-amber-600 px-4 text-xs font-semibold text-white shadow hover:bg-amber-700"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          신규 입고 등록
        </Link>
        <Link
          href="/finance/operations/intake/playbook"
          className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <BookOpen className="mr-1 h-3.5 w-3.5" />
          플레이북 (24셀×4티어 표준 행동)
        </Link>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50/30">
          <CardContent className="py-3 text-xs text-rose-700">
            ⚠ 데이터 로드 실패: {error}
            <p className="mt-1 italic">
              ※ <code>v11.10_sample_intake.sql</code> 적용 후 다시 시도하세요.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 칸반 통계 카드 */}
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s) => {
          const Icon = s.icon
          const count = grouped[s.key].length
          return (
            <Card key={s.key} className={`border-2 ${s.cls}`}>
              <CardContent className="py-3 text-center">
                <Icon className="mx-auto h-4 w-4 text-slate-600" />
                <p className="mt-1 text-[11px] font-semibold text-slate-700">{s.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{count}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 칸반 보드 */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        {STAGES.filter((s) => s.key !== 'archived').map((s) => {
          const items = grouped[s.key]
          return (
            <div key={s.key} className="space-y-2">
              <div
                className={`rounded-md border-2 p-2 text-center ${s.cls}`}
              >
                <span className="text-xs font-bold text-slate-800">{s.label}</span>
                <span className="ml-2 text-xs text-slate-500">({items.length})</span>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {items.length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-200 px-2 py-3 text-center text-[10px] italic text-slate-400">
                    비어있음
                  </p>
                ) : (
                  items.slice(0, 12).map((r) => (
                    <Link
                      key={r.id}
                      href={`/finance/operations/intake/${r.id}`}
                      className="block rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm hover:border-slate-300 hover:shadow"
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-[9px]">
                          {r.source === 'overseas' ? '🌍' : '🇰🇷'}
                        </span>
                        {r.recommended_tier && (
                          <span
                            className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
                              TIER_BG[r.recommended_tier]
                            }`}
                          >
                            {r.recommended_tier}
                          </span>
                        )}
                        {r.division && (
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] text-slate-700">
                            {DIVISION_LABEL[r.division]}
                          </span>
                        )}
                        {r.competitive_score && (
                          <span className="ml-auto text-[9px] text-slate-500">
                            {'★'.repeat(r.competitive_score)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 font-semibold text-slate-900">
                        {r.name}
                      </p>
                      {r.supplier && (
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">
                          {r.supplier}
                        </p>
                      )}
                      <p className="mt-0.5 text-[9px] text-slate-400">
                        {r.arrival_date}
                      </p>
                    </Link>
                  ))
                )}
                {items.length > 12 && (
                  <p className="rounded-md bg-slate-50 px-2 py-1 text-center text-[9px] text-slate-500">
                    + {items.length - 12} 더보기
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 종결 (archived) — 별도 컴팩트 영역 */}
      {grouped.archived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Archive className="h-3.5 w-3.5 text-slate-500" />
              종결 ({grouped.archived.length})
            </CardTitle>
            <CardDescription className="text-xs">
              회고가 끝나고 아카이브된 입고 — 학습 자료로 보관
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-xs sm:grid-cols-2">
              {grouped.archived.slice(0, 20).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/finance/operations/intake/${r.id}`}
                    className="flex items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                  >
                    <span className="text-[9px] text-slate-400">
                      {r.arrival_date}
                    </span>
                    <span className="truncate text-slate-700">{r.name}</span>
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
