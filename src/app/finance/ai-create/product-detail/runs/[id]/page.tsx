/**
 * AI Create — 상세페이지 결과 뷰어
 *
 * 경로: /finance/ai-create/product-detail/runs/[id]
 *
 * 표시:
 *   - RunMeta (status, timestamps)
 *   - ProductBrief 요약
 *   - SectionPlan (있으면)
 *   - CopyDeck (있으면) — 가독성 있는 한국어 미리보기
 *   - 에러 + 재시도 버튼
 *
 * 진행 중이면 자동 새로고침 (5초마다, meta refresh)
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  RefreshCw,
  Eye,
  FileJson,
  Sparkles,
} from 'lucide-react'
import {
  readRunMeta,
  readProductBrief,
  readSectionPlan,
  readCopyDeck,
} from '@/lib/v11-ai-create/storage'
import { retryRun } from '../../actions'
import type { DianTier, RunStatus } from '@/lib/v11-ai-create/types'

export const dynamic = 'force-dynamic'

const TIER_LABEL: Record<DianTier, string> = {
  value: '저가',
  mid: '중가',
  premium: '프리미엄',
  luxury: '럭셔리',
}

const STATUS_LABEL: Record<RunStatus, string> = {
  queued: '대기 중',
  'running:section': '섹션 계획 작성 중',
  'running:copy': '카피 작성 중',
  'running:image': '이미지 프롬프트 작성 중',
  'running:render': '렌더링 중',
  'running:review': '검수 중',
  done: '완료',
  error: '오류 발생',
}

function isRunning(status: RunStatus): boolean {
  return status === 'queued' || status.startsWith('running')
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function RunViewerPage({ params }: PageProps) {
  const { id } = await params
  const meta = await readRunMeta(id)
  if (!meta) notFound()

  const brief = await readProductBrief(id)
  const plan = await readSectionPlan(id)
  const deck = await readCopyDeck(id)

  const running = isRunning(meta.status)

  async function onRetry() {
    'use server'
    await retryRun(id)
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12">
      {/* meta refresh — 진행 중일 때만 5초마다 */}
      {running && (
        // eslint-disable-next-line @next/next/no-head-element
        <meta httpEquiv="refresh" content="5" />
      )}

      {/* ============== Header ============== */}
      <section className="bg-[var(--color-canvas)] section-pad-sm px-4 sm:px-6 lg:px-8 border-b border-[var(--color-hairline)]">
        <div className="max-w-[1100px] mx-auto">
          <Link
            href="/finance/ai-create/product-detail"
            className="inline-flex items-center gap-1.5 text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors mb-6"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={1.8} />
            상세페이지
          </Link>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="eyebrow mb-3 flex items-center gap-2">
                <span>
                  {TIER_LABEL[meta.target_tier]} · {meta.target_division}
                </span>
                <span className="text-[var(--color-ink-muted-48)]">·</span>
                <span className="font-mono text-[10px]">{meta.run_id}</span>
              </div>
              <h1 className="text-display-md text-foreground">
                {meta.product_name}
              </h1>
            </div>

            <div className="shrink-0">
              <StatusPill status={meta.status} />
            </div>
          </div>
        </div>
      </section>

      {/* ============== Status — 진행 중이면 큰 패널 ============== */}
      {running && (
        <section className="bg-[var(--color-canvas-parchment)] section-pad-sm px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1100px] mx-auto">
            <div className="bg-card border border-[var(--color-hairline)] rounded-[18px] p-7 sm:p-10 text-center">
              <Loader2
                className="w-8 h-8 mx-auto text-[var(--color-action)] animate-spin mb-4"
                strokeWidth={1.5}
              />
              <h2 className="text-[20px] font-semibold tracking-[-0.022em] text-foreground mb-2">
                {STATUS_LABEL[meta.status]}
              </h2>
              <p className="text-[14px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] max-w-md mx-auto">
                Claude 가 작업 중입니다. 5초마다 자동으로 새로고침됩니다.
              </p>
              <ProgressBar status={meta.status} />
            </div>
          </div>
        </section>
      )}

      {/* ============== Error ============== */}
      {meta.status === 'error' && (
        <section className="bg-[var(--color-canvas-parchment)] section-pad-sm px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1100px] mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-[18px] p-7 flex items-start gap-4">
              <AlertCircle
                className="w-5 h-5 text-red-600 mt-0.5 shrink-0"
                strokeWidth={2}
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] font-semibold tracking-[-0.022em] text-red-900 mb-1">
                  파이프라인 실행 오류
                </h3>
                <p className="text-[13px] tracking-[-0.012em] text-red-800 break-words mb-4">
                  {meta.error ?? '알 수 없는 오류가 발생했습니다.'}
                </p>
                <form action={onRetry}>
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center justify-center rounded-full bg-red-600 px-4 text-[13px] text-white tracking-tight hover:bg-red-700 active:scale-95 transition-all gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
                    재시도
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============== Brief 요약 ============== */}
      {brief && (
        <section className="bg-[var(--color-canvas)] section-pad-sm px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1100px] mx-auto">
            <h2 className="text-[14px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-muted-48)] mb-5">
              입력 요약
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KvCard label="소재" value={brief.material} />
              <KvCard label="시즌" value={brief.season} />
              <KvCard
                label="컬러"
                value={`${brief.colors.length}종`}
                hint={brief.colors.join(', ')}
              />
              <KvCard
                label="페이지 길이"
                value={
                  brief.page_length === 'short'
                    ? '짧게'
                    : brief.page_length === 'medium'
                    ? '중간'
                    : '길게'
                }
              />
            </div>
          </div>
        </section>
      )}

      {/* ============== SectionPlan ============== */}
      {plan && (
        <section className="bg-[var(--color-canvas-parchment)] section-pad-sm px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1100px] mx-auto">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2
                className="w-4 h-4 text-emerald-600"
                strokeWidth={2}
              />
              <h2 className="text-[14px] font-semibold uppercase tracking-[0.1em] text-foreground">
                01. 섹션 계획 — {plan.total_sections} 섹션
              </h2>
            </div>

            <div className="bg-card border border-[var(--color-hairline)] rounded-[18px] overflow-hidden">
              <ul className="divide-y divide-[var(--color-hairline)]">
                {plan.sections.map((s) => (
                  <li
                    key={s.section_id}
                    className="flex items-center gap-4 px-5 py-3 text-[13px] tracking-[-0.012em]"
                  >
                    <span className="font-mono text-[11px] text-[var(--color-ink-muted-48)] w-6">
                      {String(s.order).padStart(2, '0')}
                    </span>
                    <span
                      className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${
                        s.tile === 'tile-dark'
                          ? 'bg-foreground'
                          : s.tile === 'parchment'
                          ? 'bg-amber-300'
                          : 'bg-stone-300'
                      }`}
                    />
                    <span className="font-medium text-foreground w-32 shrink-0 truncate">
                      {s.section_id}
                    </span>
                    <span className="text-[var(--color-ink-muted-80)] flex-1 truncate">
                      {s.purpose}
                    </span>
                    <span className="hidden md:inline text-[11px] text-[var(--color-ink-muted-48)] font-mono shrink-0">
                      {s.layout}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ============== CopyDeck ============== */}
      {deck && (
        <section className="bg-[var(--color-canvas)] section-pad-sm px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1100px] mx-auto">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2
                className="w-4 h-4 text-emerald-600"
                strokeWidth={2}
              />
              <h2 className="text-[14px] font-semibold uppercase tracking-[0.1em] text-foreground">
                02. 카피 — 디안 톤
              </h2>
            </div>

            {/* Hero */}
            <div className="bg-[var(--color-canvas-parchment)] border border-[var(--color-hairline)] rounded-[18px] p-7 sm:p-10 mb-5">
              <p className="eyebrow mb-4">Hero</p>
              <h3 className="text-display-lg text-foreground mb-4">
                {deck.hero.headline}
              </h3>
              <p className="text-lead text-[var(--color-ink-muted-80)] mb-6">
                {deck.hero.subheadline}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-[14px] text-primary-foreground tracking-tight">
                  {deck.hero.primary_cta}
                </span>
                {deck.hero.secondary_cta && (
                  <span className="inline-flex h-10 items-center justify-center rounded-full bg-transparent px-5 text-[14px] text-primary border border-primary/80 tracking-tight">
                    {deck.hero.secondary_cta}
                  </span>
                )}
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-4">
              {deck.sections.map((s, idx) => (
                <div
                  key={s.id}
                  className="bg-card border border-[var(--color-hairline)] rounded-[14px] p-5"
                >
                  <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[var(--color-ink-muted-48)]">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-action)]">
                        {s.id}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--color-ink-muted-48)]">
                      {s.framework_applied}
                    </span>
                  </div>

                  {s.headline && (
                    <h4 className="text-[18px] font-semibold tracking-[-0.022em] text-foreground mb-1">
                      {s.headline}
                    </h4>
                  )}
                  {s.subhead && (
                    <p className="text-[13px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] mb-2">
                      {s.subhead}
                    </p>
                  )}
                  {s.body && (
                    <p className="text-[14px] tracking-[-0.012em] text-[var(--color-ink-muted-80)] mt-2 leading-relaxed">
                      {s.body}
                    </p>
                  )}

                  {s.bullets && s.bullets.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {s.bullets.map((b, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-[13px] tracking-[-0.012em] text-[var(--color-ink-muted-80)]"
                        >
                          <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {s.color_chips && s.color_chips.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {s.color_chips.map((c) => (
                        <div
                          key={c.name}
                          className="flex items-center gap-2 text-[12px] tracking-[-0.012em]"
                        >
                          <span
                            className="inline-block h-6 w-6 rounded-full border border-[var(--color-hairline)] shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-foreground font-medium">
                            {c.name}
                          </span>
                          <span className="text-[var(--color-ink-muted-48)]">
                            {c.story}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.table && s.table.length > 0 && (
                    <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {s.table.map((row, i) => (
                        <div key={i}>
                          <dt className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-muted-48)] mb-0.5">
                            {row.label}
                          </dt>
                          <dd className="text-[13px] text-foreground tracking-[-0.012em]">
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {s.use_cases && s.use_cases.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {s.use_cases.map((u, i) => (
                        <li
                          key={i}
                          className="text-[13px] tracking-[-0.012em] text-[var(--color-ink-muted-80)]"
                        >
                          <span className="font-medium text-foreground">
                            {u.designer}
                          </span>{' '}
                          · {u.space}
                        </li>
                      ))}
                    </ul>
                  )}

                  {s.quote && (
                    <blockquote className="mt-3 pl-4 border-l-2 border-[var(--color-action)]">
                      <p className="text-[15px] tracking-[-0.012em] text-foreground italic mb-1">
                        “{s.quote.text}”
                      </p>
                      <p className="text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)]">
                        — {s.quote.author}, {s.quote.role}
                      </p>
                    </blockquote>
                  )}

                  {s.image_brief && (
                    <p className="mt-3 text-[11px] font-mono text-[var(--color-ink-muted-48)] bg-[var(--color-canvas-parchment)] p-2 rounded">
                      🖼  {s.image_brief}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Tier audit */}
            {deck.tier_audit && (
              <div
                className={`mt-6 rounded-[14px] p-5 border flex items-start gap-3 ${
                  deck.tier_audit.forbidden_words_found.length === 0 &&
                  deck.tier_audit.cta_tier_match
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <CheckCircle2
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    deck.tier_audit.forbidden_words_found.length === 0 &&
                    deck.tier_audit.cta_tier_match
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}
                  strokeWidth={2}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold tracking-[-0.012em] text-foreground mb-1">
                    티어 검수
                  </p>
                  <p className="text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-80)]">
                    {deck.tier_audit._notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============== Footer actions ============== */}
      <section className="bg-[var(--color-canvas-parchment)] section-pad-sm px-4 sm:px-6 lg:px-8 border-t border-[var(--color-hairline)]">
        <div className="max-w-[1100px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)]">
            <FileJson className="w-3.5 h-3.5" strokeWidth={1.8} />
            <span>
              산출물: <span className="font-mono">docs/ai-create/runs/{meta.run_id}/</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/finance/ai-create/product-detail/${
                meta.target_tier === 'luxury' ? 'preview-luxury' : 'preview'
              }`}
            >
              <span className="inline-flex h-10 items-center justify-center rounded-full bg-transparent px-4 text-[14px] text-primary border border-primary/80 tracking-tight hover:bg-primary/5 active:scale-95 transition-all gap-2">
                <Eye className="w-3.5 h-3.5" strokeWidth={2} />
                {meta.target_tier === 'luxury' ? 'Luxury' : 'Premium'} 예시 보기
              </span>
            </Link>
            <Link href="/finance/ai-create/product-detail/new">
              <span className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-[14px] text-primary-foreground tracking-tight hover:bg-[#0058b3] active:scale-95 transition-all gap-2">
                <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
                새로 만들기
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

function StatusPill({ status }: { status: RunStatus }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] tracking-[-0.012em]">
        <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
        완료
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-red-50 border border-red-200 text-red-800 text-[12px] tracking-[-0.012em]">
        <AlertCircle className="w-3.5 h-3.5" strokeWidth={2} />
        오류
      </span>
    )
  }
  if (status.startsWith('running')) {
    return (
      <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[12px] tracking-[-0.012em]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
        {STATUS_LABEL[status]}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-stone-50 border border-stone-200 text-stone-700 text-[12px] tracking-[-0.012em]">
      <Clock className="w-3.5 h-3.5" strokeWidth={2} />
      {STATUS_LABEL[status]}
    </span>
  )
}

function ProgressBar({ status }: { status: RunStatus }) {
  // 5단계 진행 표시 (Phase 1 은 2단계만 사용 — 나머지는 회색)
  const steps = [
    { key: 'section', label: '섹션 계획', active: status === 'running:section' },
    { key: 'copy', label: '카피', active: status === 'running:copy' },
    { key: 'image', label: '이미지', active: status === 'running:image' },
    { key: 'render', label: '렌더', active: status === 'running:render' },
    { key: 'review', label: '검수', active: status === 'running:review' },
  ]

  const reachedIndex = (() => {
    if (status === 'running:section' || status === 'queued') return 0
    if (status === 'running:copy') return 1
    if (status === 'running:image') return 2
    if (status === 'running:render') return 3
    if (status === 'running:review') return 4
    if (status === 'done') return 5
    return 0
  })()

  return (
    <div className="mt-8 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2">
        {steps.map((s, i) => (
          <div
            key={s.key}
            className="flex flex-col items-center gap-1.5 flex-1"
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
                i < reachedIndex
                  ? 'bg-emerald-500'
                  : s.active
                  ? 'bg-[var(--color-action)] animate-pulse'
                  : 'bg-stone-300'
              }`}
            />
            <span
              className={`text-[10px] tracking-[-0.012em] ${
                s.active
                  ? 'text-foreground font-medium'
                  : i < reachedIndex
                  ? 'text-emerald-700'
                  : 'text-[var(--color-ink-muted-48)]'
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function KvCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="bg-card border border-[var(--color-hairline)] rounded-[12px] p-4">
      <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-muted-48)] mb-1.5">
        {label}
      </p>
      <p className="text-[14px] font-semibold tracking-[-0.022em] text-foreground truncate">
        {value}
      </p>
      {hint && (
        <p className="text-[11px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] mt-1 truncate">
          {hint}
        </p>
      )}
    </div>
  )
}
