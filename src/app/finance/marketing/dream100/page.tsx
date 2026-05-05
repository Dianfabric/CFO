/**
 * 마케팅 드림 100 (Phase 3.5 #2b ⑤)
 */
import Link from 'next/link'
import { Sparkles, ChevronLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import Dream100Board, { type Dream100Row } from '@/components/v11/marketing/Dream100Board'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('marketing_dream100')
      .select('*')
      .order('influence_score', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(200)
    return { items: (data ?? []) as Dream100Row[], error: error?.message ?? null }
  } catch (e) {
    return {
      items: [] as Dream100Row[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function Dream100Page() {
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
            v1.1 · #2b ⑤ 드림 100
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">마케팅 드림 100</h1>
        <p className="mt-1 text-sm text-slate-500">
          러셀 — 가장 협업하고 싶은 인플루언서·잡지·디자이너·브랜드 100명·곳을 추적
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error} — v11.3_marketing_round35.sql 적용 필요
        </div>
      )}

      <Dream100Board items={items} />

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 드림 100 활용</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>발굴</strong>: 인스타·잡지·핀터레스트·전시에서 영감 받은 인물·브랜드 즉시
              등록
            </li>
            <li>
              <strong>조사 완료</strong>: 핸들·팔로워·과거 협업 이력·연락처 정리
            </li>
            <li>
              <strong>컨택 시도</strong>: DM·이메일·미팅 요청 — 다음 행동 명시
            </li>
            <li>
              <strong>대화 중</strong>: 답신 후 관계 형성
            </li>
            <li>
              <strong>협업 진행</strong>: 룩북 협찬·인터뷰·콜라보 등 진행
            </li>
            <li>
              <strong>거절·종료</strong>: 결과 기록 → 다음 시즌 재시도 학습
            </li>
          </ul>
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            💡 영향력(1~10)이 높을수록 우선 컨택. 한 번에 100명에 닿으려 하지 말고, 매주 5명씩
            깊게 — 12주 누적 60명.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
