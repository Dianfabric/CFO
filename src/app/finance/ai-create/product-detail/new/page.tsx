/**
 * AI Create — 상세페이지 위저드 (Server shell)
 *
 * 진입점: /finance/ai-create/product-detail/new
 * 폼은 클라이언트 컴포넌트로 분리.
 */
import Link from 'next/link'
import { ChevronLeft, Sparkles } from 'lucide-react'
import WizardForm from './WizardForm'
import { getDefaultFill, createRun } from '../actions'
import type { WizardFormInput } from '@/lib/v11-ai-create/types'

export const dynamic = 'force-dynamic'

export default async function ProductDetailNewPage() {
  const defaultFillPremium = await getDefaultFill('premium')
  const defaultFillLuxury = await getDefaultFill('luxury')

  // server action 을 직접 client 폼에 prop 으로 전달 (action 형태)
  async function submitAction(input: WizardFormInput) {
    'use server'
    return createRun(input)
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12">
      {/* ============== Hero ============== */}
      <section className="bg-[var(--color-canvas)] section-pad-sm px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto">
          <Link
            href="/finance/ai-create/product-detail"
            className="inline-flex items-center gap-1.5 text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors mb-8"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={1.8} />
            상세페이지
          </Link>

          <div className="text-center max-w-2xl mx-auto">
            <div className="eyebrow mb-5 inline-flex items-center gap-2">
              <Sparkles className="w-3 h-3" strokeWidth={2} />
              <span>새 페이지 만들기</span>
            </div>
            <h1 className="text-display-lg text-foreground">
              제품을 알려주세요.
            </h1>
            <p className="text-lead mt-5 text-[var(--color-ink-muted-48)]">
              제품 정보·티어·셀링 포인트를 입력하면 약 1-2분 안에 13 섹션 카피가 만들어집니다.
            </p>
          </div>
        </div>
      </section>

      {/* ============== Form ============== */}
      <section className="bg-[var(--color-canvas-parchment)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[800px] mx-auto">
          <WizardForm
            submitAction={submitAction}
            defaultFillPremium={defaultFillPremium}
            defaultFillLuxury={defaultFillLuxury}
          />
        </div>
      </section>
    </div>
  )
}
