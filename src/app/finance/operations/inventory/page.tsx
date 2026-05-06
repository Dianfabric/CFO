/**
 * 인벤토리 추적 (Phase 9 #2c)
 * 제품 재고 + 부족 경고
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  ChevronLeft,
  Package,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DIVISION_LABEL, PRICE_TIER_LABEL } from '@/lib/v11-labels'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ProductRow {
  id: number
  sku: string
  name: string
  division: string
  current_stock: number | null
  threshold_stock: number | null
  active: boolean
  product_lines: { name: string; tier: string } | null
}

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, name, division, current_stock, threshold_stock, active, product_lines(name, tier)')
      .eq('active', true)
      .order('current_stock', { ascending: true, nullsFirst: false })
      .limit(200)
    return { items: ((data ?? []) as unknown) as ProductRow[], error: error?.message ?? null }
  } catch (e) {
    return {
      items: [] as ProductRow[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function InventoryPage() {
  const { items, error } = await loadData()

  const lowStock = items.filter(
    (p) =>
      p.threshold_stock != null &&
      Number(p.current_stock ?? 0) <= Number(p.threshold_stock),
  )
  const totalStock = items.reduce((s, p) => s + Number(p.current_stock ?? 0), 0)

  return (
    <div className="space-y-6">
      <Link
        href="/finance/operations"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        운영 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2c 인벤토리
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Package className="h-5 w-5 text-slate-500" />
          인벤토리 추적
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          제품 재고 + 임계값 미만 자동 경고
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">활성 제품</div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">총 재고 수량</div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {totalStock.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className={lowStock.length > 0 ? 'border-rose-300' : ''}>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">부족 (임계값 이하)</div>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                lowStock.length > 0 ? 'text-rose-700' : 'text-emerald-700',
              )}
            >
              {lowStock.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 부족 경고 */}
      {lowStock.length > 0 && (
        <Card className="border-rose-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              재고 부족 ({lowStock.length})
            </CardTitle>
            <CardDescription>임계값 이하 — 즉시 발주 검토</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {lowStock.slice(0, 20).map((p) => (
                <li key={p.id} className="px-4 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800">{p.name}</span>
                      <span className="ml-2 text-[10px] text-slate-500">{p.sku}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-rose-700 font-bold tabular-nums">
                        {p.current_stock ?? 0}
                      </span>
                      <span className="text-slate-400 ml-1">/ {p.threshold_stock}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 전체 재고 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">전체 재고 (재고 적은 순)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">
              제품 데이터가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="px-3 py-2 text-left">제품</th>
                    <th className="px-3 py-2 text-left">제품군</th>
                    <th className="px-3 py-2 text-left">티어/라인</th>
                    <th className="px-3 py-2 text-right">현재 재고</th>
                    <th className="px-3 py-2 text-right">임계값</th>
                    <th className="px-3 py-2 text-center">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 100).map((p) => {
                    const cur = Number(p.current_stock ?? 0)
                    const th = Number(p.threshold_stock ?? 0)
                    const low = th > 0 && cur <= th
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-1.5">
                          <div className="font-semibold text-slate-700">{p.name}</div>
                          <div className="text-[10px] text-slate-500">{p.sku}</div>
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">
                          {DIVISION_LABEL[p.division] ?? p.division}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">
                          {p.product_lines && (
                            <>
                              <span className="text-[10px] text-slate-500">
                                {PRICE_TIER_LABEL[p.product_lines.tier]}
                              </span>{' '}
                              <span>{p.product_lines.name}</span>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{cur}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                          {th || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {low ? (
                            <span className="text-rose-600">
                              <AlertTriangle className="inline h-3 w-3" /> 부족
                            </span>
                          ) : (
                            <span className="text-emerald-600">
                              <CheckCircle className="inline h-3 w-3" /> 정상
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardContent className="py-3 text-xs text-slate-700">
          💡 <strong>외부 연동 안내</strong>: 자동 발주 + ERP 연동은 별도 단계. 현재는 임계값 기반
          수동 발주 권장. 재고 입력은 Supabase Table Editor 또는 별도 import 스크립트로.
        </CardContent>
      </Card>
    </div>
  )
}
