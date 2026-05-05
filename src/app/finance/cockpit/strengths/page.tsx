/**
 * 강점 자기인식 (Phase 7 #7 ⑦, 드러커)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import StrengthsForm from '@/components/v11/cockpit/StrengthsForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'self_strengths, strengths_description, strengths_evidence, strengths_blindspots, golden_hours_start, golden_hours_end',
      )
      .eq('id', user.id)
      .maybeSingle()

    return { profile: data, error: error?.message ?? null }
  } catch (e) {
    return null
  }
}

export default async function StrengthsPage() {
  const data = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/cockpit"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        코크핏
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #7 ⑦ 강점 자기인식
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Award className="h-5 w-5 text-amber-500" />
          강점 자기인식
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          드러커: "강점에 집중하라. 약점을 메우는 데 시간 쓰지 마라" — 본인만 조회
        </p>
      </div>

      {data?.error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {data.error}
        </div>
      )}

      <StrengthsForm
        defaults={{
          self_strengths: data?.profile?.self_strengths ?? [],
          strengths_description: data?.profile?.strengths_description ?? '',
          strengths_evidence: data?.profile?.strengths_evidence ?? '',
          strengths_blindspots: data?.profile?.strengths_blindspots ?? '',
          golden_hours_start: data?.profile?.golden_hours_start ?? '',
          golden_hours_end: data?.profile?.golden_hours_end ?? '',
        }}
      />

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 강점 도출 가이드 (드러커 Run!)</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="ml-4 list-decimal space-y-2 text-xs text-slate-700">
            <li>
              <strong>피드백 분석법 (Feedback Analysis)</strong>: 중요한 결정·계획을 할 때마다,
              <strong> 예상 결과를 적어두라</strong>. 9~12개월 후 실제와 비교하면 강점이 보인다.
            </li>
            <li>
              <strong>강점이 자라는 곳에 시간 투자</strong>: 약점 보완에 쓰는 시간 = 기회 비용.
              평범한 영역에서 평균이 되려는 것보다 강점에서 탁월해지는 게 효율적.
            </li>
            <li>
              <strong>지적 오만 경계</strong>: "내 분야가 아니라 안 한다"가 아니라 "내 강점을 발휘할
              수 있는 곳을 찾는다".
            </li>
            <li>
              <strong>나쁜 습관 발견</strong>: 강점을 무력화하는 행동 패턴 (예: 분석은 잘하는데
              결정 미루기).
            </li>
            <li>
              <strong>매너 문제</strong>: 사람들과 잘 안 맞는다면 사회적 매너 부족일 수도. 강점만이
              아니라 매너도 강점.
            </li>
            <li>
              <strong>해서는 안 되는 일</strong>: 강점이 없는 영역에는 시간을 쓰지 않는다 (외주·위임).
            </li>
            <li>
              <strong>최소한의 노력으로 평균 도달이 어려운 영역</strong>: 그곳은 진짜 약점. 인정하고
              우회.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
