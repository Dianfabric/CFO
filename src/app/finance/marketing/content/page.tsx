/**
 * 콘텐츠 캘린더 (Phase 3 #2b ②)
 */
import Link from 'next/link'
import { Sparkles, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ContentBoard, { type ContentRow } from '@/components/v11/marketing/ContentBoard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .order('publish_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(200)
    return { items: (data ?? []) as ContentRow[], error: error?.message ?? null }
  } catch (e) {
    return {
      items: [] as ContentRow[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function ContentPage() {
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
            v1.1 · #2b ② 콘텐츠 캘린더
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">콘텐츠 캘린더</h1>
        <p className="mt-1 text-sm text-slate-500">
          인스타·블로그·룩북·뉴스레터를 5단계로 추적 — 아이디어부터 발행 후 KPI까지
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error} — v11.2_marketing.sql 적용 필요
        </div>
      )}

      <ContentBoard items={items} />
    </div>
  )
}
