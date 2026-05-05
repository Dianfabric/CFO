/**
 * 가격 의사결정 상세 (4단계 작성·편집)
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Sparkles, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import DecisionForm, { type DecisionRow } from '@/components/v11/pricing/DecisionForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DecisionDetailPage({ params }: PageProps) {
  const { id } = await params
  const decisionId = parseInt(id, 10)
  if (!Number.isFinite(decisionId)) notFound()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('price_decisions')
    .select('*')
    .eq('id', decisionId)
    .maybeSingle()

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/finance/pricing"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-3 w-3" />
          목록으로
        </Link>
        <p className="text-sm text-rose-600">결정 정보를 불러올 수 없습니다. {error?.message}</p>
      </div>
    )
  }

  const decision = data as DecisionRow

  return (
    <div className="space-y-4">
      <Link
        href="/finance/pricing"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        목록으로
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · Phase 1 ⑩ · #{decision.id}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">가격 의사결정</h1>
        <p className="mt-1 text-sm text-slate-500">{decision.decision_date}</p>
      </div>

      <DecisionForm decision={decision} />
    </div>
  )
}
