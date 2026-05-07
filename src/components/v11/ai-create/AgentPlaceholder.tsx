/**
 * AI Create — 에이전트 placeholder
 * 각 에이전트의 실제 위저드 / 생성 로직이 만들어지기 전 공통 페이지 셸.
 * Apple tile pattern + 모바일 반응형.
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  /** 에이전트명 (eyebrow + breadcrumb) */
  agentName: string
  /** 큰 헤드라인 (Apple-tight) */
  headline: string
  /** 짧은 설명 한 줄 */
  tagline: string
  /** 아이콘 */
  icon: LucideIcon
  /** 향후 에이전트가 다룰 입력·출력 (placeholder bullets) */
  inputs?: string[]
  outputs?: string[]
}

export default function AgentPlaceholder({
  agentName,
  headline,
  tagline,
  icon: Icon,
  inputs,
  outputs,
}: Props) {
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
            <Icon className="w-6 h-6 text-foreground" strokeWidth={1.6} />
          </div>

          <div className="eyebrow mb-5 inline-flex items-center gap-2">
            <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
            <span>AI Create · {agentName}</span>
          </div>
          <h1 className="text-display-xl text-foreground">{headline}</h1>
          <p className="text-lead mt-7 text-[var(--color-ink-muted-48)] max-w-2xl mx-auto">
            {tagline}
          </p>

          {/* 준비 중 마커 */}
          <div className="mt-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-canvas-parchment)] border border-[var(--color-hairline)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-action)]" />
            <span className="text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-80)]">
              에이전트 개발 중
            </span>
          </div>
        </div>
      </section>

      {/* ============== Inputs / Outputs preview ============== */}
      {(inputs?.length || outputs?.length) && (
        <section className="bg-[var(--color-canvas-parchment)] section-pad px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1100px] mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-display-lg text-foreground">
                계획된 흐름.
              </h2>
              <p className="text-lead mt-5 text-[var(--color-ink-muted-48)] max-w-xl mx-auto">
                입력에서 결과까지 — 자동으로.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {inputs?.length ? (
                <div className="bg-card border border-[var(--color-hairline)] rounded-[18px] p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-muted-48)] mb-4">
                    Input
                  </p>
                  <h3 className="text-[18px] font-semibold tracking-[-0.022em] text-foreground mb-4">
                    당신이 주는 것
                  </h3>
                  <ul className="space-y-3">
                    {inputs.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14px] tracking-[-0.012em] text-[var(--color-ink-muted-80)]">
                        <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {outputs?.length ? (
                <div className="bg-card border border-[var(--color-hairline)] rounded-[18px] p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-action)] mb-4">
                    Output
                  </p>
                  <h3 className="text-[18px] font-semibold tracking-[-0.022em] text-foreground mb-4">
                    AI 가 만드는 것
                  </h3>
                  <ul className="space-y-3">
                    {outputs.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14px] tracking-[-0.012em] text-[var(--color-ink-muted-80)]">
                        <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--color-action)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* ============== Footer CTA ============== */}
      <section className="bg-[var(--color-canvas)] section-pad-sm px-4 sm:px-6 lg:px-8 border-t border-[var(--color-hairline)]">
        <div className="max-w-[800px] mx-auto text-center">
          <p className="text-lead text-[var(--color-ink-muted-48)]">
            먼저 사용해 보고 싶거나, 개선 아이디어가 있으시면 알려주세요.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/finance/ai-create">
              <span className="inline-flex h-10 items-center justify-center rounded-full bg-transparent px-5 text-[15px] text-primary border border-primary/80 tracking-tight hover:bg-primary/5 active:scale-95 transition-all">
                다른 에이전트 보기
              </span>
            </Link>
            <Link href="/finance/team">
              <span className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-[15px] text-primary-foreground tracking-tight hover:bg-[#0058b3] active:scale-95 transition-all">
                의견 보내기
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
