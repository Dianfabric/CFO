/**
 * 심리·인지과학 프레임워크 라이브러리 (#9)
 * - 8종 seed 정의를 카드로 표시
 * - 추천 티어/직업군 표시
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, Brain, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TIER_LABEL: Record<string, string> = {
  value: '저가',
  mid: '중가',
  premium: '프리미엄',
  luxury: '럭셔리',
}

const OCCUPATION_LABEL: Record<string, string> = {
  interior_project: '인테리어 프로젝트',
  brand_furniture: '브랜드 가구',
  project_furniture: '프로젝트 가구',
  commercial_reupholster: '천갈이',
  curtain_styling: '커튼 스타일링',
  display: '디스플레이',
}

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sales_psychology_frameworks')
      .select('*')
      .eq('active', true)
      .order('display_order')
    return { rows: data ?? [], error: error?.message }
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export default async function FrameworksPage() {
  const { rows, error } = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/sales/materials"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        영업자료 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #9 영업자료
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Brain className="h-5 w-5 text-slate-500" />
          심리·인지과학 프레임워크
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          영업자료 생성에 적용할 8종 프레임워크 — 위저드에서 자동 추천 + 직접 선택 가능
        </p>
      </div>

      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-xs text-slate-700">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
            <p>
              위저드 Step 3 에서 거래처의 <strong>티어 + 직업군</strong>을 기반으로 가장 적합한
              프레임워크 1~2개가 자동 추천됩니다. 직접 선택·수정도 가능합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-200 bg-rose-50/30">
          <CardContent className="py-3 text-xs text-rose-700">
            ⚠ 데이터 로드 실패: {error}
            <p className="mt-1 italic">
              ※ <code>v11.9_sales_materials.sql</code> 적용 후 다시 시도하세요.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((f) => (
          <Card key={f.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{f.name}</CardTitle>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">{f.key}</p>
                </div>
              </div>
              <CardDescription className="text-xs leading-relaxed">
                {f.summary}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {f.principles && (f.principles as string[]).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    핵심 원리
                  </p>
                  <ul className="mt-1 space-y-1 text-xs text-slate-700">
                    {(f.principles as string[]).map((p, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500">추천 티어</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(f.recommended_tiers as string[]).map((t) => (
                      <span
                        key={t}
                        className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800"
                      >
                        {TIER_LABEL[t] ?? t}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500">추천 직업군</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(f.recommended_occupations as string[]).map((o) => (
                      <span
                        key={o}
                        className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-800"
                      >
                        {OCCUPATION_LABEL[o] ?? o}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {f.prompt_template && (
                <div className="rounded-md bg-slate-50 p-2">
                  <p className="text-[10px] font-bold uppercase text-slate-500">
                    AI 적용 가이드
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[11px] italic text-slate-600">
                    {f.prompt_template}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {rows.length === 0 && !error && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-slate-400">
              프레임워크가 등록되지 않았습니다.
            </p>
            <p className="mt-1 text-xs italic text-slate-400">
              ※ <code>v11.9_sales_materials.sql</code>의 seed가 적용되었는지 확인하세요.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
