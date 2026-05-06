/**
 * 영업자료 자산 라이브러리 (#9)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, Library, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AssetForm from '@/components/v11/sales-materials/AssetForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sales_material_assets')
      .select(
        'id, kind, title, description, external_url, body_text, source, tags, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(100)
    return { rows: data ?? [], error: error?.message }
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export default async function AssetLibraryPage() {
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
          <Library className="h-5 w-5 text-slate-500" />
          자산 라이브러리
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          영업자료 생성 시 참고할 자산 — 해외 기사·인터뷰 URL, 본문 텍스트, 레퍼런스
        </p>
      </div>

      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-xs text-slate-700">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
            <div className="space-y-1">
              <p>
                <strong>해외 자료 등록 권장</strong> — 이태리·프랑스 직조사 카탈로그, 디자인
                매거진 인터뷰, 트렌드 리포트 등을 미리 등록해 두세요.
              </p>
              <p>
                위저드의 Step 4 (소스 자료) 에서 검색·선택할 수 있고, AI가 본문을 참고해
                자료를 생성합니다.
              </p>
              <p className="text-[11px] italic">
                ※ 이미지 업로드는 v0.2 에서 추가 예정. 현재는 URL·텍스트만 지원.
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
          <CardTitle className="text-base">자산 목록</CardTitle>
          <CardDescription className="text-xs">최근 100건</CardDescription>
        </CardHeader>
        <CardContent>
          <AssetForm
            rows={rows.map((r) => ({
              ...r,
              tags: (r.tags ?? []) as string[],
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
