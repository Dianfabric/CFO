/**
 * 캠페인 트래커 (Phase 3.5 #2b ⑥)
 */
import Link from 'next/link'
import { Sparkles, ChevronLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import CampaignsList, { type CampaignRow } from '@/components/v11/marketing/CampaignsList'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('campaign_performance')
      .select('*')
      .order('start_date', { ascending: false, nullsFirst: false })
      .limit(100)
    return { items: ((data ?? []) as unknown) as CampaignRow[], error: error?.message ?? null }
  } catch (e) {
    return {
      items: [] as CampaignRow[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function CampaignsPage() {
  const { items, error } = await loadData()

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
            v1.1 · #2b ⑥ 캠페인 트래커
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">캠페인 트래커</h1>
        <p className="mt-1 text-sm text-slate-500">
          시즌·신제품·이벤트·뉴스레터 단위로 콘텐츠를 묶어 ROI 추적
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error} — v11.3_marketing_round35.sql 적용 필요
        </div>
      )}

      <CampaignsList items={items} />

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 캠페인 단위 운영</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>시즌 캠페인</strong> (SS·FW): 12주 사이클과 정렬
            </li>
            <li>
              <strong>신제품 출시</strong>: 4티어별 라인업 발표 + 룩북·인스타·블로그 묶음
            </li>
            <li>
              <strong>이벤트·전시</strong>: 박람회·디자인페어 참가 시 통합 트래킹
            </li>
            <li>
              <strong>뉴스레터</strong>: 월간 거래처 대상 발송
            </li>
            <li>
              <strong>협업·콜라보</strong>: 드림 100 인물·브랜드와의 공동 캠페인
            </li>
            <li>
              종료 시 <strong>예산 vs 발생 매출</strong> = ROI 자동 계산
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
