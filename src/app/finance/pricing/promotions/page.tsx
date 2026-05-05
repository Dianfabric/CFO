/**
 * 프로모션 정책 (Phase 6 #4 ⑥)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PromotionsList, { type PromoRow } from '@/components/v11/pricing/PromotionsList'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('price_promotions')
      .select('*')
      .order('start_date', { ascending: false, nullsFirst: false })
      .limit(100)
    return { items: (data ?? []) as PromoRow[], error: error?.message ?? null }
  } catch (e) {
    return {
      items: [] as PromoRow[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function PromotionsPage() {
  const { items, error } = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/pricing"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        가격 결정 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #4 ⑥ 프로모션 정책
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">프로모션 정책</h1>
        <p className="mt-1 text-sm text-slate-500">
          % 할인 · 대량 · 번들 · 티어 업그레이드 — 럭셔리는 자동 보호
        </p>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                {error} — v11.5_promotions.sql 적용 필요
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <PromotionsList items={items} />

      <Card className="border-rose-100 bg-rose-50/30">
        <CardHeader>
          <CardTitle className="text-sm">⚠ 프로모션 운영 원칙</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>한 번 시작하면 거두기 어렵다</strong> — 디자이너는 다음에도 같은 할인을
              기대함
            </li>
            <li>
              <strong>4단계 워크플로우</strong>로 사전 검증된 결정만 실행
            </li>
            <li>
              <strong className="text-rose-700">럭셔리 절대 금지</strong> — 시스템에서 자동
              경고. exclude_luxury 옵션 활성화 권장
            </li>
            <li>
              <strong>시간 제한</strong>: 무기한 프로모션은 가격 정상화 어려움 — 종료일 명시
            </li>
            <li>
              <strong>가치 강조 우선</strong>: 가격 할인보다 무료 샘플·번들·서비스 추가가 더 좋은
              유인
            </li>
            <li>
              종료 후 <strong>uses_count</strong> 와 <strong>발생 매출</strong>로 ROI 검증
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
