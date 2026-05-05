/**
 * 브랜드 정체성 (Phase 3 #2b ① 빅 아이디어 + 페르소나 + 시각 정체성)
 */
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, ChevronLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import BrandIdentityForm, {
  type BrandIdentityRow,
} from '@/components/v11/marketing/BrandIdentityForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('brand_identity')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    return { data: data as BrandIdentityRow | null, error: error?.message ?? null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) }
  }
}

export default async function BrandPage() {
  const { data, error } = await loadData()

  if (!data) {
    return (
      <div className="space-y-4">
        <Link
          href="/finance/marketing"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-3 w-3" />
          마케팅 허브
        </Link>
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">brand_identity 테이블 미적용</p>
                <p className="mt-1 text-xs">
                  Supabase에 v11.2_marketing.sql 적용 후 재시도. {error}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

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
            v1.1 · #2b ① 브랜드 정체성
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">브랜드 정체성</h1>
        <p className="mt-1 text-sm text-slate-500">
          빅 아이디어 + 페르소나 + 스토리 + 시각 정체성. 모든 콘텐츠·캠페인의 기준점.
        </p>
      </div>

      <BrandIdentityForm data={data} />
    </div>
  )
}
