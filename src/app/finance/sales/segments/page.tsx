/**
 * 24셀 영업 매트릭스 (Phase 2 #2a ③)
 *
 * 각 셀의 핵심 메시지·영업 시퀀스·전형적 거절·전환 팁을 명문화.
 * AI 영업 추천(ai_sales_recommendations)이 이 데이터를 기반으로 동작.
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
import SegmentMatrixSales from '@/components/v11/sales/SegmentMatrixSales'
import type { SegmentRow } from '@/components/v11/sales/SegmentMessageDialog'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('segments')
      .select(
        'id, occupation, division, core_message, sales_sequence, avg_cycle_days, recommended_catalog, typical_objections, conversion_tips',
      )
      .order('occupation')
      .order('division')

    return { segments: (data ?? []) as SegmentRow[], error: error?.message ?? null }
  } catch (e) {
    return {
      segments: [] as SegmentRow[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function SegmentsPage() {
  const { segments, error } = await loadData()

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
            v1.1 · #2a ③ 24셀 영업 매트릭스
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">24셀 영업 매트릭스</h1>
        <p className="mt-1 text-sm text-slate-500">
          6직업군 × 4제품군 = 24셀. 각 셀별로 핵심 메시지·영업 시퀀스·전형적 거절·전환 팁을 명문화하면
          AI 영업 추천이 정확해집니다.
        </p>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p>{error}</p>
                <p className="mt-1 text-xs">
                  스키마 확장(segments에 sales_sequence 등)이 필요할 수 있습니다 — Supabase에
                  v11.1_sales_strategy.sql 적용 후 재시도.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>매트릭스</CardTitle>
          <CardDescription>
            셀 클릭 → 영업 메시지 / 시퀀스 / 평균 사이클 / 거절 사유 / 전환 팁 편집
          </CardDescription>
        </CardHeader>
        <CardContent>
          {segments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              segments 마스터 데이터가 없습니다 (스키마 적용 시 자동 생성됨)
            </p>
          ) : (
            <SegmentMatrixSales segments={segments} />
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="h-4 w-4 text-amber-600" />
            매트릭스 활용
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>핵심 메시지</strong>: 이 셀의 거래처에게 디안이 어떤 가치를 주는지 한
              문장으로
            </li>
            <li>
              <strong>영업 시퀀스</strong>: 첫 컨택부터 수주까지 정형화된 단계 (예: 컨셉 미팅 →
              무드보드 송부 → 샘플북 → 큐레이션 제안)
            </li>
            <li>
              <strong>평균 사이클</strong>: 첫 컨택 ~ 수주까지 평균 일수 (사이클 추적의 기준)
            </li>
            <li>
              <strong>전형적 거절 사유</strong>: 이 셀에서 자주 듣는 반대 의견 → AI가 응대
              스크립트 학습
            </li>
            <li>
              <strong>전환 팁</strong>: 이 셀에서 효과적인 접근법, 강조 포인트, 가격 정책
            </li>
          </ul>
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            💡 모든 셀을 채울 필요는 없습니다 — 디안이 자주 만나는 셀부터 차차 채우세요.
            처음에는 인테리어 프로젝트 × 소파/벽원단 같은 핵심 셀부터 시작 권장.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
