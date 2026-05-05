/**
 * 포지셔닝 매트릭스 (Phase 1 ⑨, PRD #4 ①)
 *
 * 4티어 (저가/중가/프리미엄/럭셔리) × 4제품군 (소파/커튼/벽/소품) = 16셀
 * 각 셀에 product_lines (브랜드/시리즈) 등록.
 *
 * 토요타-렉서스 사례처럼 멀티티어 라인을 명확히 분리.
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, Layers3, AlertCircle, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PositioningMatrix from '@/components/v11/positioning/PositioningMatrix'
import type { ProductLineRow } from '@/components/v11/positioning/ProductLineEditDialog'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PriceTierInfo {
  tier: string
  display_name: string
  display_order: number
  target_margin_min: number | null
  target_margin_max: number | null
  discount_policy: string | null
  description: string | null
}

async function loadData() {
  try {
    const supabase = await createClient()

    const [linesRes, tiersRes] = await Promise.all([
      supabase
        .from('product_lines')
        .select('*')
        .order('tier', { ascending: true })
        .order('division', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('price_tiers')
        .select('*')
        .order('display_order', { ascending: true }),
    ])

    return {
      lines: (linesRes.data ?? []) as ProductLineRow[],
      tiers: (tiersRes.data ?? []) as PriceTierInfo[],
      errors: [linesRes.error, tiersRes.error].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      lines: [] as ProductLineRow[],
      tiers: [] as PriceTierInfo[],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function PositioningPage() {
  const { lines, tiers, errors } = await loadData()

  const activeLines = lines.filter((l) => l.active)
  const totalCells = 4 * 4
  const filledCells = new Set(activeLines.map((l) => `${l.tier}|${l.division}`)).size
  const fillRate = Math.round((filledCells / totalCells) * 100)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · Phase 1 ⑨
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">포지셔닝 매트릭스</h1>
          <p className="mt-1 text-sm text-slate-500">
            4티어 × 4제품군 = 16셀 — 멀티티어 라인을 명확히 분리하여 가격 정책·메시지를 정합니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-slate-500" />
              <div>
                <div className="font-semibold tabular-nums text-slate-700">
                  {activeLines.length}개
                </div>
                <div className="text-[10px] text-slate-400">활성 라인</div>
              </div>
            </div>
          </div>
          <div
            className={
              'rounded-md border px-3 py-2 text-xs ' +
              (fillRate >= 50
                ? 'border-emerald-200 bg-emerald-50'
                : fillRate >= 25
                ? 'border-amber-200 bg-amber-50'
                : 'border-slate-200 bg-slate-50')
            }
          >
            <div className="font-semibold tabular-nums text-slate-700">
              {filledCells} / {totalCells}
            </div>
            <div className="text-[10px] text-slate-500">셀 채움 ({fillRate}%)</div>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">데이터 일부 오류:</p>
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {errors.slice(0, 3).map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4티어 정책 카드 */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="h-4 w-4 text-slate-500" />
            4티어 가격 정책 (PRD #4)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {tiers.map((t) => (
              <div
                key={t.tier}
                className="rounded-md border border-slate-200 bg-white p-3 text-xs"
              >
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {t.display_name}
                </div>
                <div className="mt-1 font-semibold tabular-nums text-slate-800">
                  마진 {t.target_margin_min}~{t.target_margin_max}%
                </div>
                <div className="mt-1.5 text-[10px] text-slate-500 line-clamp-3">
                  {t.discount_policy}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 메인 매트릭스 */}
      <Card>
        <CardHeader>
          <CardTitle>제품 라인업 매트릭스</CardTitle>
          <CardDescription>
            빈 셀 클릭 → 새 라인 추가 · 라인 클릭 → 가치 정의 워크북 편집
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tiers.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              price_tiers 마스터 데이터를 불러오지 못했습니다 (스키마 적용 확인 필요)
            </p>
          ) : (
            <PositioningMatrix lines={lines} tiers={tiers} />
          )}
        </CardContent>
      </Card>

      {/* 가이드 */}
      <Card className="border-amber-100 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-sm">📌 포지셔닝 매트릭스 활용</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>같은 디안 안에서도 티어를 명확히 분리</strong> — 토요타와 렉서스가 같은
              회사이지만 별도 브랜드인 것처럼.
            </li>
            <li>
              <strong>가치 정의 워크북</strong> 작성: 한 라인의 가격이 정당화되려면 어떤 본질적
              가치를 주는지, 확장 가치는 무엇인지, ROI가 어떻게 되는지 명문화.
            </li>
            <li>
              <strong>저가</strong>: 가격 강조 마케팅 OK · <strong>중가</strong>: 제한적 할인 ·
              <strong> 프리미엄</strong>: 가치 강조, 세일 회피 · <strong>럭셔리</strong>: 할인 절대
              금지, Price upon request.
            </li>
            <li>
              모든 셀을 다 채울 필요는 없습니다 — 디안의 강점이 있는 셀만 우선 채우고 나머지는 추후
              결정.
            </li>
            <li>
              한 셀에 <strong>여러 라인</strong>을 둘 수도 있습니다 (예: 프리미엄·소파 라인 안에
              "헤리티지", "시그니처" 두 개의 시리즈).
            </li>
          </ul>
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            💡 <strong>럭셔리 라인 도전</strong> (CLAUDE.md 1) 시 별도 브랜드명을 검토하세요. 같은
            "디안" 이름으로 럭셔리를 하면 기존 중·프리미엄 가치가 희석될 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
