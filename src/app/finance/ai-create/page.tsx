/**
 * AI Create 허브
 *
 * 디안의 콘텐츠 자동생성 에이전트 모음.
 * 향후 추가될 에이전트는 이 그리드에 카드 추가만 하면 됨.
 */
import Link from 'next/link'
import {
  ScrollText,
  Video,
  Film,
  Presentation,
  Newspaper,
  PenTool,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface AgentCard {
  href: string
  title: string
  tagline: string
  icon: LucideIcon
  status: 'live' | 'beta' | 'soon'
}

const agents: AgentCard[] = [
  {
    href: '/finance/ai-create/product-detail',
    title: '상세페이지',
    tagline: '제품 정보 → 랜딩 / 상세페이지 1장',
    icon: ScrollText,
    status: 'soon',
  },
  {
    href: '/finance/ai-create/shorts',
    title: '쇼츠',
    tagline: '15·30·60초 짧은 영상 스크립트 + 컷별 가이드',
    icon: Video,
    status: 'soon',
  },
  {
    href: '/finance/ai-create/longform',
    title: '롱폼',
    tagline: '5~10분 유튜브 / 브랜드 영상 시나리오',
    icon: Film,
    status: 'soon',
  },
  {
    href: '/finance/ai-create/presentation',
    title: '프리젠테이션',
    tagline: '5~10장 슬라이드 + 영상 스크립트 (.pptx)',
    icon: Presentation,
    status: 'soon',
  },
  {
    href: '/finance/ai-create/card-news',
    title: '카드뉴스',
    tagline: '인스타·블로그용 카드뉴스 5~10컷',
    icon: Newspaper,
    status: 'soon',
  },
  {
    href: '/finance/ai-create/blog',
    title: '블로그',
    tagline: 'SEO 최적화된 1500~3000자 블로그 글',
    icon: PenTool,
    status: 'soon',
  },
]

export default function AICreateHubPage() {
  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12">
      {/* ============== Hero ============== */}
      <section className="bg-[var(--color-canvas)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto text-center">
          <div className="eyebrow mb-6 inline-flex items-center gap-2">
            <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
            <span>AI Create</span>
          </div>
          <h1 className="text-hero text-foreground">
            무엇을<br />만들어 드릴까요.
          </h1>
          <p className="text-lead mt-8 text-[var(--color-ink-muted-48)] max-w-2xl mx-auto">
            상세페이지부터 영상까지 — 디안 톤으로 즉시 생성.
          </p>
        </div>
      </section>

      {/* ============== Agent grid ============== */}
      <section className="bg-[var(--color-canvas-parchment)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {agents.map((a) => {
              const Icon = a.icon
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group block press-scale"
                >
                  <div className="bg-card border border-[var(--color-hairline)] rounded-[18px] p-7 transition-all duration-200 group-hover:border-foreground/40 h-full flex flex-col">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--color-canvas-parchment)] mb-5">
                      <Icon
                        className="w-5 h-5 text-foreground"
                        strokeWidth={1.6}
                      />
                    </div>
                    <h3 className="text-[20px] font-semibold tracking-[-0.022em] text-foreground">
                      {a.title}
                    </h3>
                    <p className="mt-3 text-[14px] tracking-[-0.012em] text-[var(--color-ink-muted-80)] leading-[1.5] flex-1">
                      {a.tagline}
                    </p>
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-[14px] tracking-[-0.012em] text-[var(--color-action)] inline-flex items-center gap-1 group-hover:underline">
                        열기 <span className="text-[12px]">›</span>
                      </span>
                      {a.status === 'soon' && (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted-48)]">
                          개발 중
                        </span>
                      )}
                      {a.status === 'beta' && (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-action)]">
                          Beta
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============== Footer ============== */}
      <section className="bg-[var(--color-canvas)] section-pad-sm px-4 sm:px-6 lg:px-8 border-t border-[var(--color-hairline)]">
        <div className="max-w-[800px] mx-auto text-center">
          <p className="text-lead text-[var(--color-ink-muted-48)]">
            추가하고 싶은 에이전트가 있으면 언제든 알려주세요.
          </p>
        </div>
      </section>
    </div>
  )
}
