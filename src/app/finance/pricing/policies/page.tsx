/**
 * 거래처별 가격 차별화 (Phase 6 #4 ⑤)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PoliciesTable, { type PolicyRow } from '@/components/v11/pricing/PoliciesTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const [policiesRes, clientsRes, linesRes] = await Promise.all([
      supabase
        .from('client_pricing_policies')
        .select('*, clients(name), product_lines(name, tier, division, brand_name)')
        .order('id', { ascending: false }),
      supabase.from('clients').select('id, name').eq('active', true).order('name'),
      supabase
        .from('product_lines')
        .select('id, name, tier, division, brand_name')
        .eq('active', true)
        .order('tier')
        .order('name'),
    ])

    return {
      policies: ((policiesRes.data ?? []) as unknown) as PolicyRow[],
      clients: clientsRes.data ?? [],
      lines: linesRes.data ?? [],
      errors: [policiesRes.error, clientsRes.error, linesRes.error].filter(Boolean) as Array<{
        message: string
      }>,
    }
  } catch (e) {
    return {
      policies: [] as PolicyRow[],
      clients: [],
      lines: [],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function PoliciesPage() {
  const data = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/pricing"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        가격 결정 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #4 ⑤ 거래처별 가격 차별화
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">거래처별 가격 차별화 정책</h1>
        <p className="mt-1 text-sm text-slate-500">
          VIP 거래처·대량 구매처에 적용되는 라인별 할인율 — CEO/임원만 편집 가능
        </p>
      </div>

      {data.errors.length > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                {data.errors.slice(0, 2).map((e, i) => (
                  <div key={i}>{e.message}</div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <PoliciesTable policies={data.policies} clients={data.clients} lines={data.lines} />

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 가격 차별화 핵심 원칙 (PRD #4)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>저가 (Value)</strong>: 광고에 가격 강조 가능. 9.99 등 문턱가격
            </li>
            <li>
              <strong>중가 (Mid)</strong>: 제한적 할인 가능 (5~10%)
            </li>
            <li>
              <strong>프리미엄 (Premium)</strong>: 특가·세일 회피. 가치 강조
            </li>
            <li>
              <strong className="text-rose-700">럭셔리 (Luxury)</strong>: ❌ <strong>할인 절대 금지</strong>.
              Price upon request 옵션 가능 — 시스템에서 경고 자동 표시
            </li>
            <li>
              차별화는 <strong>거래처별·라인별</strong>로만 적용. 단일 SKU 단위 할인은 일관성 훼손
              위험
            </li>
            <li>
              모든 정책 변경은 <strong>4단계 가격 워크플로우</strong>로 사전 검증되어야 함
            </li>
          </ul>
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-800">
            ⚠ 할인은 한번 시작하면 거두기 어렵습니다. 신중하게 결정하고, 가능하면 가치 정의(워크북)을
            우선 명문화하세요.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
