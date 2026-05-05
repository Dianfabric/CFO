/**
 * 가치 정의 워크북 (Phase 6 #4 ②)
 * 모든 product_lines의 가치 정의 필드를 한 곳에서 비교·편집.
 * 포지셔닝 매트릭스 다이얼로그가 단일 라인 편집이라면, 이 페이지는 전체 비교 뷰.
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, AlertCircle, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  PRICE_TIER_LABEL,
  PRICE_TIER_VALUES,
  DIVISION_LABEL,
} from '@/lib/v11-labels'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface LineRow {
  id: number
  name: string
  brand_name: string | null
  tier: string
  division: string
  value_essential: string | null
  value_extended: string | null
  value_roi_note: string | null
  active: boolean
}

const TIER_TONE: Record<string, string> = {
  value: 'border-slate-200 bg-slate-50/50',
  mid: 'border-blue-200 bg-blue-50/30',
  premium: 'border-purple-200 bg-purple-50/30',
  luxury: 'border-amber-200 bg-amber-50/30',
}

async function loadData() {
  try {
    const supabase = await createClient()
    const [linesRes, tiersRes] = await Promise.all([
      supabase
        .from('product_lines')
        .select('*')
        .eq('active', true)
        .order('tier')
        .order('division')
        .order('name'),
      supabase
        .from('price_tiers')
        .select('*')
        .order('display_order'),
    ])
    return {
      lines: (linesRes.data ?? []) as LineRow[],
      tiers: tiersRes.data ?? [],
      errors: [linesRes.error, tiersRes.error].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      lines: [] as LineRow[],
      tiers: [],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function WorkbookPage() {
  const data = await loadData()

  // tier별 그룹핑
  const byTier = new Map<string, LineRow[]>()
  for (const t of PRICE_TIER_VALUES) byTier.set(t, [])
  for (const l of data.lines) {
    if (byTier.has(l.tier)) byTier.get(l.tier)!.push(l)
  }

  // 완성도 계산
  const totalLines = data.lines.length
  const filledLines = data.lines.filter(
    (l) => l.value_essential && l.value_extended && l.value_roi_note,
  ).length
  const fillRate = totalLines > 0 ? Math.round((filledLines / totalLines) * 100) : 0

  return (
    <div className="space-y-6">
      <Link
        href="/finance/pricing"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        가격 결정 허브
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · #4 ② 가치 정의 워크북
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">가치 정의 워크북</h1>
          <p className="mt-1 text-sm text-slate-500">
            모든 라인의 가치 정의를 한 곳에서 비교 — 가격 정당성의 토대
          </p>
        </div>
        <div
          className={cn(
            'rounded-md border px-3 py-2 text-xs',
            fillRate >= 80
              ? 'border-emerald-200 bg-emerald-50'
              : fillRate >= 50
              ? 'border-amber-200 bg-amber-50'
              : 'border-slate-200 bg-slate-50',
          )}
        >
          <div className="font-semibold tabular-nums text-slate-700">
            {filledLines} / {totalLines}
          </div>
          <div className="text-[10px] text-slate-500">
            완성된 워크북 ({fillRate}%)
          </div>
        </div>
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4티어 정책 요약 */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="h-4 w-4 text-slate-500" />
            4티어 가격 정책
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            {data.tiers.map((t) => (
              <div
                key={t.tier}
                className="rounded-md border border-slate-200 bg-white p-2.5 text-xs"
              >
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {t.display_name}
                </div>
                <div className="mt-1 font-semibold tabular-nums text-slate-800">
                  목표 마진 {t.target_margin_min}~{t.target_margin_max}%
                </div>
                <div className="mt-1 text-[10px] text-slate-500 line-clamp-2">
                  {t.discount_policy}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 티어별 라인 워크북 */}
      {PRICE_TIER_VALUES.map((tier) => {
        const lines = byTier.get(tier) ?? []
        if (lines.length === 0) return null
        return (
          <Card key={tier} className={cn('border', TIER_TONE[tier])}>
            <CardHeader>
              <CardTitle className="text-sm">
                {PRICE_TIER_LABEL[tier]} ({lines.length}개 라인)
              </CardTitle>
              <CardDescription>
                각 라인의 가치 3요소 — 클릭 시{' '}
                <Link
                  href="/finance/positioning"
                  className="text-blue-600 hover:underline"
                >
                  포지셔닝 매트릭스
                </Link>
                에서 편집
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lines.map((l) => {
                  const allFilled =
                    l.value_essential && l.value_extended && l.value_roi_note
                  return (
                    <div
                      key={l.id}
                      className={cn(
                        'rounded-md border bg-white p-3 transition',
                        allFilled ? 'border-emerald-200' : 'border-slate-200',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-800">
                            {l.name}
                            {l.brand_name && (
                              <span className="ml-1 text-slate-400 font-normal">
                                ({l.brand_name})
                              </span>
                            )}
                          </h3>
                          <p className="text-[10px] text-slate-500">
                            {DIVISION_LABEL[l.division] ?? l.division}
                          </p>
                        </div>
                        {!allFilled && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            미완성
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <ValueField
                          label="필수 가치"
                          subtitle="한 문장"
                          value={l.value_essential}
                          accent="amber"
                        />
                        <ValueField
                          label="확장 가치"
                          subtitle="특징·차별점"
                          value={l.value_extended}
                          accent="purple"
                        />
                        <ValueField
                          label="ROI 메모"
                          subtitle="가격 정당성"
                          value={l.value_roi_note}
                          accent="emerald"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {data.lines.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-slate-500">
              등록된 제품 라인이 없습니다.{' '}
              <Link href="/finance/positioning" className="text-blue-600 hover:underline">
                포지셔닝 매트릭스
              </Link>
              에서 라인을 먼저 추가하세요.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 가치 정의 워크북 핵심 (PRD #4 ②)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>가치 정의 = 가격 정당성</strong> — 가격이 정당화되려면 어떤 가치를 주는지 명문화
              필요
            </li>
            <li>
              <strong>필수 가치 (Essential)</strong>: 한 문장으로 압축 — 디자이너에게 첫 메시지
            </li>
            <li>
              <strong>확장 가치 (Extended)</strong>: 차별점·특징 — 경쟁사 대비 무엇이 다른가
            </li>
            <li>
              <strong>ROI 메모</strong>: 가격이 비싸 보일 때 어떻게 정당화하는가 — 수명·내구성·시간
              절감 등
            </li>
            <li>
              모든 라인의 워크북이 채워지면 영업·마케팅 메시지가 일관됨 ✓
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function ValueField({
  label,
  subtitle,
  value,
  accent,
}: {
  label: string
  subtitle: string
  value: string | null
  accent: 'amber' | 'purple' | 'emerald'
}) {
  const accentClass = {
    amber: 'text-amber-700',
    purple: 'text-purple-700',
    emerald: 'text-emerald-700',
  }[accent]

  return (
    <div>
      <div className={cn('text-[10px] font-bold uppercase tracking-wide', accentClass)}>
        {label}
      </div>
      <div className="text-[10px] text-slate-400">{subtitle}</div>
      <p
        className={cn(
          'mt-1 text-xs',
          value ? 'text-slate-700' : 'italic text-slate-400',
        )}
      >
        {value ?? '미작성'}
      </p>
    </div>
  )
}
