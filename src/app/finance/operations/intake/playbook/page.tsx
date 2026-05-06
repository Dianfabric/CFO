/**
 * 입고 워크플로우 — 플레이북 (24셀 × 4티어 표준 행동 요령)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, BookOpen, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PlaybookEditor from '@/components/v11/intake/PlaybookEditor'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sample_intake_playbook')
      .select('*')
      .eq('active', true)
    return { rows: data ?? [], error: error?.message }
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export default async function PlaybookPage() {
  const { rows, error } = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/operations/intake"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        입고 워크플로우 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #10 입고 워크플로우
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <BookOpen className="h-5 w-5 text-slate-500" />
          입고 플레이북
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          24셀 × 4티어별 표준 행동 요령 — Stage 4 실행 단계에서 자동 추천됩니다
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-xs text-blue-900">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-1">
              <p>
                <strong>매트릭스 셀을 클릭하면 편집 가능</strong> — 각 24셀×4티어
                조합에 대한 표준 액션을 정의할 수 있습니다.
              </p>
              <p>
                예시: <strong>인테리어 프로젝트 × 커튼 × 프리미엄</strong> 조합에는
                "스타일링 디자이너 5명 우선 발송, 빛 투과 영상 1건" 같은 액션을
                미리 정해둘 수 있습니다.
              </p>
              <p>
                Stage 4 (실행)에서 해당 샘플의 평가 정보(직업군·제품군·티어)에 매칭되는
                플레이북이 자동으로 표시됩니다.
              </p>
              <p className="text-[11px] italic">
                ※ 시드: 12개 조합이 미리 채워져 있습니다 (자주 쓰는 조합). 나머지는
                직접 채워주세요. CEO·임원만 편집 가능.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-200 bg-rose-50/30">
          <CardContent className="py-3 text-xs text-rose-700">
            ⚠ 데이터 로드 실패: {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">플레이북 매트릭스</CardTitle>
          <CardDescription className="text-xs">
            행: 직업군 × 제품군 (24개) · 열: 4티어 · 셀 클릭 → 편집
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlaybookEditor
            rows={rows.map((r) => ({
              id: r.id,
              occupation: r.occupation,
              division: r.division,
              tier: r.tier,
              recommended_actions: (r.recommended_actions ?? []) as string[],
              notes: r.notes,
              active: r.active,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
