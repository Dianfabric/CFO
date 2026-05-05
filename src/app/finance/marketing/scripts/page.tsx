/**
 * Hook · Story · Offer 매트릭스 (Phase 3 #2b ④, 러셀 4부작)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ScriptsLibrary, { type ScriptRow } from '@/components/v11/marketing/ScriptsLibrary'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const [scriptsRes, segmentsRes] = await Promise.all([
      supabase
        .from('marketing_scripts')
        .select('*, segments(occupation, division)')
        .order('effectiveness_score', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false }),
      supabase
        .from('segments')
        .select('id, occupation, division')
        .order('occupation')
        .order('division'),
    ])
    return {
      scripts: ((scriptsRes.data ?? []) as unknown) as ScriptRow[],
      segments: segmentsRes.data ?? [],
      errors: [scriptsRes.error, segmentsRes.error].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      scripts: [] as ScriptRow[],
      segments: [],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function ScriptsPage() {
  const data = await loadData()

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
            v1.1 · #2b ④ Hook·Story·Offer
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Hook · Story · Offer 매트릭스</h1>
        <p className="mt-1 text-sm text-slate-500">
          러셀 4부작 — 모든 마케팅 메시지의 기본 구조. 24셀별로 효과적인 스크립트 라이브러리화.
        </p>
      </div>

      {data.errors.length > 0 && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {data.errors[0].message} — v11.2_marketing.sql 적용 필요
        </div>
      )}

      <ScriptsLibrary scripts={data.scripts} segments={data.segments} />

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 러셀 4부작 — Hook · Story · Offer · CTA</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>Hook</strong>: 첫 한 문장 — 스크롤 멈춤 / 질문·통계·자극적 주장 / 3초 안에 결정
            </li>
            <li>
              <strong>Story</strong>: 감정 연결 — 공감·서사·변화의 순간 / "왜 이게 의미 있는가"
            </li>
            <li>
              <strong>Offer</strong>: 가치 제안 — 무엇을 / 왜 지금 / 위험 제거 / 시급성
            </li>
            <li>
              <strong>Call to Action</strong>: 단 하나의 행동 — DM·상담·견적·구독 / 모호함 X
            </li>
            <li>
              <strong>24셀별 라이브러리화</strong> — 같은 디안이라도 인테리어 디자이너와 가구 브랜드
              MD에게는 다른 메시지. 셀별 효과 점수로 검증.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
