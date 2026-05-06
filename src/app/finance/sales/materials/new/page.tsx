/**
 * 영업자료 자동생성 — 위저드 페이지
 */
import Link from 'next/link'
import { ChevronLeft, Sparkles, Wand2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Wizard from '@/components/v11/sales-materials/Wizard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const [clientsQ, productsQ, fwQ, assetsQ] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, occupation, tier, active')
        .eq('active', true)
        .order('name')
        .limit(200),
      supabase
        .from('products')
        .select('id, name, active')
        .eq('active', true)
        .order('name')
        .limit(200),
      supabase
        .from('sales_psychology_frameworks')
        .select(
          'id, key, name, summary, recommended_tiers, recommended_occupations, display_order',
        )
        .eq('active', true)
        .order('display_order'),
      supabase
        .from('sales_material_assets')
        .select('id, kind, title, source')
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    return {
      clients: clientsQ.data ?? [],
      products: productsQ.data ?? [],
      frameworks: fwQ.data ?? [],
      assets: assetsQ.data ?? [],
      error: fwQ.error?.message,
    }
  } catch (e) {
    return {
      clients: [],
      products: [],
      frameworks: [],
      assets: [],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function NewMaterialPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const data = await loadData()

  return (
    <div className="mx-auto max-w-3xl space-y-5">
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
          <Wand2 className="h-5 w-5 text-amber-500" />
          새 자료 만들기
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          5분 안에 끝나는 5단계 위저드 — 대상 → 제품 → 프레임워크 → 소스 → 생성
        </p>
      </div>

      {sp.error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          ⚠ 이전 시도 실패: {sp.error}
        </div>
      )}

      {data.error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          ⚠ 데이터 로드 실패: {data.error}
          <p className="mt-1 italic">
            ※ <code>v11.9_sales_materials.sql</code> 적용 후 다시 시도하세요.
          </p>
        </div>
      )}

      <Wizard
        clients={data.clients.map((c) => ({
          id: c.id,
          name: c.name,
          occupation: c.occupation,
          tier: c.tier,
        }))}
        products={data.products}
        frameworks={data.frameworks.map((f) => ({
          id: f.id,
          key: f.key,
          name: f.name,
          summary: f.summary,
          recommended_tiers: f.recommended_tiers ?? [],
          recommended_occupations: f.recommended_occupations ?? [],
        }))}
        assets={data.assets}
      />
    </div>
  )
}
