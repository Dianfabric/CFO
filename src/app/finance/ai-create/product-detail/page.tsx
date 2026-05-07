/**
 * AI Create — 상세페이지 에이전트 허브
 *
 * 진입점: /finance/ai-create/product-detail
 * 구성:
 *   1. Hero — 에이전트 소개 + 새로 만들기 CTA
 *   2. 예시 두 가지 (premium / luxury preview 링크)
 *   3. 최근 Runs 목록 (filesystem 에서 read)
 *
 * Server Component — listRuns() 가 fs 접근하므로 동적 렌더.
 */
import Link from 'next/link'
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { listRuns, type RunSummary } from '@/lib/v11-ai-create/storage'
import type { DianTier, RunStatus } from '@/lib/v11-ai-create/types'

export const dynamic = 'force-dynamic'

// ============================================================
// 표시 헬퍼
// ============================================================

const TIER_LABEL: Record<DianTier, string> = {
  value: '저가',
  mid: '중가',
  premium: '프리미엄',
  luxury: '럭셔리',
}

const TIER_DOT: Record<DianTier, string> = {
  value: 'bg-emerald-500',
  mid: 'bg-blue-500',
  premium: 'bg-[var(--color-action)]',
  luxury: 'bg-foreground',
}

const STATUS_LABEL: Record<RunStatus, string> = {
  queued: '대기 중',
  'running:section': '섹션 계획 중',
  'running:copy': '카피 작성 중',
  'running:image': '이미지 프롬프트 중',
  'running:render': '렌더링 중',
  'running:review': '검수 중',
  done: '완료',
  error: '오류',
}

function StatusBadge({ status }: { status: RunStatus }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] tracking-[-0.012em] text-foreground">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
        완료
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] tracking-[-0.012em] text-red-600">
        <AlertCircle className="w-3.5 h-3.5" strokeWidth={2} />
        오류
      </span>
    )
  }
  if (status.startsWith('running')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] tracking-[-0.012em] text-[var(--color-action)]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
        {STATUS_LABEL[status]}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)]">
      <Clock className="w-3.5 h-3.5" strokeWidth={2} />
      {STATUS_LABEL[status]}
    </span>
  )
}

function formatRelTime(iso: string): string {
  const date = new Date(iso)
  const ms = Date.now() - date.getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}일 전`
  return date.toISOString().slice(0, 10)
}

// ============================================================
// 페이지
// ============================================================

export default async function ProductDetailHubPage() {
  const runs = await listRuns()
  const recent = runs.slice(0, 12)

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12">
      {/* ============== Hero ============== */}
      <section className="bg-[var(--color-canvas)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto text-center">
          <Link
            href="/finance/ai-create"
            className="inline-flex items-center gap-1.5 text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors mb-8"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={1.8} />
            AI Create
          </Link>

          <div className="inline-flex h-14 w-14 items-center justify-center rounded-[16px] bg-[var(--color-canvas-parchment)] mb-6">
            <ScrollText className="w-6 h-6 text-foreground" strokeWidth={1.6} />
          </div>

          <div className="eyebrow mb-5 inline-flex items-center gap-2">
            <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
            <span>AI Create · 상세페이지</span>
          </div>
          <h1 className="text-display-xl text-foreground">
            한 페이지에<br />제품의 모든 것을.
          </h1>
          <p className="text-lead mt-7 text-[var(--color-ink-muted-48)] max-w-2xl mx-auto">
            제품 정보를 입력하면 디안 톤의 상세페이지를 자동으로 만듭니다.
            13개 섹션, 4티어 변주, 8개 심리 프레임워크.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/finance/ai-create/product-detail/new">
              <span className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-[15px] text-primary-foreground tracking-tight hover:bg-[#0058b3] active:scale-95 transition-all gap-2">
                <Sparkles className="w-4 h-4" strokeWidth={2} />
                새로 만들기
              </span>
            </Link>
            <Link href="/finance/ai-create/product-detail/preview">
              <span className="inline-flex h-11 items-center justify-center rounded-full bg-transparent px-5 text-[15px] text-primary border border-primary/80 tracking-tight hover:bg-primary/5 active:scale-95 transition-all">
                예시 보기
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============== 예시 두 가지 ============== */}
      <section className="bg-[var(--color-canvas-parchment)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-14">
            <p className="eyebrow mb-4">예시</p>
            <h2 className="text-display-lg text-foreground">
              티어가 바뀌면, 페이지가 바뀝니다.
            </h2>
            <p className="text-lead mt-5 text-[var(--color-ink-muted-48)] max-w-2xl mx-auto">
              같은 제품(SS26 워시드 리넨)을 두 가지 티어로 만든 결과.
              섹션 수·여백·헤드라인·CTA·가격 노출까지 자동 변주.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Premium */}
            <Link
              href="/finance/ai-create/product-detail/preview"
              className="group block bg-card border border-[var(--color-hairline)] rounded-[18px] p-7 hover:shadow-product transition-all"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${TIER_DOT.premium}`} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-muted-48)]">
                  Premium · 13 sections
                </span>
              </div>
              <h3 className="text-[22px] font-semibold tracking-[-0.022em] text-foreground mb-2">
                빛에 가장 가까운 결.
              </h3>
              <p className="text-[14px] tracking-[-0.012em] text-[var(--color-ink-muted-80)] mb-5 leading-relaxed">
                풀 13섹션 · 4컬러 · CTA 2개 (샘플 + 디자인 미팅) · 가격 노출
              </p>
              <div className="inline-flex items-center gap-1 text-[13px] tracking-[-0.012em] text-[var(--color-action)] group-hover:gap-2 transition-all">
                Premium 미리보기
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
            </Link>

            {/* Luxury */}
            <Link
              href="/finance/ai-create/product-detail/preview-luxury"
              className="group block bg-[#272729] text-white border border-transparent rounded-[18px] p-7 hover:shadow-product transition-all"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-white" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">
                  Luxury · 11 sections
                </span>
              </div>
              <h3
                className="text-[22px] tracking-[-0.022em] text-white mb-2"
                style={{ fontWeight: 200 }}
              >
                결.
              </h3>
              <p className="text-[14px] tracking-[-0.012em] text-white/70 mb-5 leading-relaxed">
                11 섹션 · 3컬러 · CTA 1개 (Reserve a Sample) · 가격 미노출
              </p>
              <div className="inline-flex items-center gap-1 text-[13px] tracking-[-0.012em] text-white/90 group-hover:gap-2 transition-all">
                Luxury 미리보기
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ============== 최근 Runs ============== */}
      <section className="bg-[var(--color-canvas)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-3">
            <div>
              <p className="eyebrow mb-3">최근 Runs</p>
              <h2 className="text-display-md text-foreground">
                지금까지 만든 페이지.
              </h2>
            </div>
            <Link
              href="/finance/ai-create/product-detail/new"
              className="inline-flex items-center gap-1.5 text-[14px] tracking-[-0.012em] text-[var(--color-action)] hover:gap-2.5 transition-all"
            >
              새로 만들기
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>

          {recent.length === 0 ? (
            <EmptyRuns />
          ) : (
            <ul className="divide-y divide-[var(--color-hairline)] border-y border-[var(--color-hairline)]">
              {recent.map((r) => (
                <li key={r.run_id}>
                  <RunRow run={r} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ============== Footer ============== */}
      <section className="bg-[var(--color-canvas-parchment)] section-pad-sm px-4 sm:px-6 lg:px-8 border-t border-[var(--color-hairline)]">
        <div className="max-w-[800px] mx-auto text-center">
          <p className="text-lead text-[var(--color-ink-muted-48)]">
            13 섹션 · 4 티어 · 8 프레임워크. 디안의 톤은 자동.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/finance/ai-create">
              <span className="inline-flex h-10 items-center justify-center rounded-full bg-transparent px-5 text-[15px] text-primary border border-primary/80 tracking-tight hover:bg-primary/5 active:scale-95 transition-all">
                다른 에이전트 보기
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// ============================================================
// 보조 컴포넌트
// ============================================================

function EmptyRuns() {
  return (
    <div className="rounded-[18px] border border-dashed border-[var(--color-hairline)] bg-card p-12 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-canvas-parchment)] mb-5">
        <Sparkles className="w-5 h-5 text-foreground" strokeWidth={1.6} />
      </div>
      <p className="text-[16px] font-semibold tracking-[-0.022em] text-foreground mb-2">
        아직 만든 페이지가 없습니다.
      </p>
      <p className="text-[14px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] max-w-md mx-auto mb-6">
        제품 정보를 입력하면 약 1-2분 안에 13 섹션 상세페이지 카피가 만들어집니다.
      </p>
      <Link href="/finance/ai-create/product-detail/new">
        <span className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-[14px] text-primary-foreground tracking-tight hover:bg-[#0058b3] active:scale-95 transition-all gap-2">
          <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
          첫 페이지 만들기
        </span>
      </Link>
    </div>
  )
}

function RunRow({ run }: { run: RunSummary }) {
  return (
    <Link
      href={`/finance/ai-create/product-detail/runs/${run.run_id}`}
      className="flex items-center gap-4 py-4 hover:bg-[var(--color-canvas-parchment)] transition-colors -mx-2 px-2 rounded-md"
    >
      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${TIER_DOT[run.target_tier]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold tracking-[-0.022em] text-foreground truncate">
          {run.product_name}
        </p>
        <p className="text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] mt-1 truncate">
          {TIER_LABEL[run.target_tier]} · {run.target_division} · {formatRelTime(run.updated_at)} ·{' '}
          <span className="font-mono text-[11px]">{run.run_id}</span>
        </p>
      </div>
      <div className="hidden sm:block">
        <StatusBadge status={run.status} />
      </div>
      <ChevronRight
        className="w-4 h-4 text-[var(--color-ink-muted-48)] shrink-0"
        strokeWidth={1.8}
      />
    </Link>
  )
}
