/**
 * 입고 워크플로우 — 신규 입고 등록 페이지 (Stage 1)
 */
import Link from 'next/link'
import { ChevronLeft, Sparkles, PackageOpen } from 'lucide-react'
import IntakeForm from '@/components/v11/intake/IntakeForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function NewIntakePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams

  return (
    <div className="mx-auto max-w-2xl space-y-5">
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
          <PackageOpen className="h-5 w-5 text-amber-500" />
          신규 샘플 입고 등록
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Stage 1 · 입고 사실 등록 → AI 자동 평가 → Stage 2 (평가) 로 진입
        </p>
      </div>

      {sp.error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          ⚠ 이전 시도 실패: {sp.error}
        </div>
      )}

      <IntakeForm />
    </div>
  )
}
