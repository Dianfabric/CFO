/**
 * 디안 SS26 워시드 리넨 — Reserve (LUXURY 티어 PREVIEW)
 *
 * 같은 5-에이전트 파이프라인, target_tier="luxury" 로 변경한 결과물.
 * premium 과 비교해서:
 *  - 13 → 11 섹션 (08 Compare, 12 FAQ 생략)
 *  - 가격 미노출
 *  - CTA 1개 ("Reserve a Sample")
 *  - 컬러 4 → 3 (절제)
 *  - 헤드라인 weight 300 일부 적용
 *  - 여백 70%+ (premium 60%)
 *  - dark tile 5번 (premium 4번)
 *
 * Run: docs/ai-create/runs/run_2026-05-07_washed-linen-luxury/
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

const COPY = {
  cover: {
    eyebrow: '디안 SS26 · Reserve',
    headline: '결.',
    sub: 'Libeco. 1858년부터의 손.',
    cta: 'Reserve a Sample',
  },
  bigIdea: '공간이 입을 옷.',
  material: {
    eyebrow: '소재',
    headline: '결의 무게.',
    sub: '워시드 리넨',
    body: '한 명의 손이 짠 한 필. 결이 빛을 입는 자세.',
    bullets: ['Libeco · 1858', '자연 워싱'],
  },
  color: {
    eyebrow: '컬러',
    headline: '셋',
    sub: '여명 · 안개 · 심해',
    chips: [
      { name: 'Ivory', hex: '#F5F0E8', story: '여명' },
      { name: 'Greige', hex: '#C4B8A8', story: '안개' },
      { name: 'Indigo', hex: '#2C3445', story: '심해' },
    ],
  },
  specs: {
    eyebrow: '사양',
    rows: [
      { label: '폭', value: '150 cm' },
      { label: '중량', value: '280 g/m²' },
      { label: '소재', value: '워시드 리넨 100%' },
      { label: '원산지', value: '벨기에 — Libeco' },
      { label: '최소', value: '5 m · 한정 30롤' },
    ],
  },
  useCase: {
    eyebrow: '시공',
    headline: '한 공간에서.',
    space: '한남동 단독주택 · 동향',
    designer: '하나인테리어 · 김지윤',
  },
  designerVoice: {
    quote: '결이 빛을 입는다.',
    author: '김지윤',
    role: '하나인테리어 · 수석 디자이너',
  },
  lifestyle: {
    caption: '정오의 결.',
  },
  craftsmanship: {
    eyebrow: '장인',
    headline: '장인의 결',
    body: '벨기에 직조사 Libeco. 1858년부터 6대를 이어온 손. 한 명의 장인이 한 필을 짠다. 기계가 흉내 낼 수 없는 결의 미세한 농담은, 시간이 지날수록 깊어진다.',
  },
  authority: {
    headline: '약속',
    body: '디안 평생 보증 · 개별 큐레이션 · OEKO-TEX 100',
  },
  cta: {
    headline: '결을 만나세요.',
    sub: '한정 30롤',
    primary: 'Price upon request',
  },
}

function PlaceholderImage({
  label,
  aspect = '16:9',
  dark = false,
  luxury = false,
}: {
  label: string
  aspect?: '1:1' | '16:9' | '4:3' | '21:9' | '4:5' | '3:4'
  dark?: boolean
  luxury?: boolean
}) {
  const aspectClass = {
    '1:1': 'aspect-square',
    '16:9': 'aspect-video',
    '4:3': 'aspect-[4/3]',
    '21:9': 'aspect-[21/9]',
    '4:5': 'aspect-[4/5]',
    '3:4': 'aspect-[3/4]',
  }[aspect]

  return (
    <div
      className={`${aspectClass} w-full flex items-center justify-center ${
        dark
          ? 'bg-stone-900 border-stone-800'
          : luxury
            ? 'bg-stone-50 border-stone-200'
            : 'bg-[var(--color-canvas-parchment)] border-[var(--color-hairline)]'
      } border`}
      style={luxury ? { boxShadow: '0 8px 40px rgba(0,0,0,0.04)' } : undefined}
    >
      <span
        className={`text-[10px] tracking-[0.04em] uppercase italic ${
          dark ? 'text-stone-600' : 'text-[var(--color-ink-muted-48)]'
        }`}
      >
        Imagen 3 · {label}
      </span>
    </div>
  )
}

export default function WashedLinenLuxuryPreviewPage() {
  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12">
      {/* 미리보기 안내 */}
      <div className="bg-[var(--color-canvas-parchment)] border-b border-[var(--color-hairline)] px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-3">
          <Link
            href="/finance/ai-create/product-detail/preview"
            className="inline-flex items-center gap-1 text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={1.8} />
            premium 버전 비교
          </Link>
          <span className="text-[11px] tracking-[-0.01em] text-[var(--color-action)]">
            ✦ LUXURY · 11 섹션 · 가격 미노출
          </span>
        </div>
      </div>

      {/* 01. COVER (DARK — luxury 시작은 어둠) */}
      <section
        className="bg-[var(--color-surface-tile-1)] px-4 sm:px-6 lg:px-8 text-white"
        style={{ paddingTop: 'clamp(120px, 18vw, 280px)', paddingBottom: 'clamp(120px, 18vw, 280px)' }}
      >
        <div className="max-w-[1100px] mx-auto text-center">
          <p
            className="text-[11px] uppercase tracking-[0.24em] mb-12"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            {COPY.cover.eyebrow}
          </p>
          {/* 한 단어 헤드라인 — 거대 + weight 300 (luxury 절제) */}
          <h1
            className="text-white"
            style={{
              fontSize: 'clamp(80px, 14vw, 200px)',
              fontWeight: 200,
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {COPY.cover.headline}
          </h1>
          <p
            className="mt-12 text-[14px] tracking-[0.08em] uppercase"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            {COPY.cover.sub}
          </p>
          <div className="mt-16">
            <button
              className="text-[13px] tracking-[0.16em] uppercase border-b border-white/40 pb-1 hover:border-white transition-colors"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              {COPY.cover.cta}
            </button>
          </div>
        </div>
      </section>

      {/* 02. BIG IDEA (DARK 연속, luxury 만의 패턴) */}
      <section
        className="bg-[var(--color-surface-tile-1)] px-4 sm:px-6 lg:px-8 border-t border-white/5"
        style={{ paddingTop: 'clamp(96px, 14vw, 192px)', paddingBottom: 'clamp(96px, 14vw, 192px)' }}
      >
        <div className="max-w-[900px] mx-auto text-center">
          <p
            className="text-white"
            style={{
              fontSize: 'clamp(36px, 5.5vw, 72px)',
              fontWeight: 200,
              letterSpacing: '-0.022em',
              lineHeight: 1.1,
            }}
          >
            {COPY.bigIdea}
          </p>
        </div>
      </section>

      {/* 03. MATERIAL (parchment, 2-col) — 첫 light 등장 */}
      <section
        className="bg-[var(--color-canvas-parchment)] px-4 sm:px-6 lg:px-8"
        style={{ paddingTop: 'clamp(96px, 14vw, 192px)', paddingBottom: 'clamp(96px, 14vw, 192px)' }}
      >
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <PlaceholderImage label="Material · 마크로 + 손" aspect="4:3" luxury />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-muted-48)] mb-6">
                {COPY.material.eyebrow}
              </p>
              <h2
                className="text-foreground"
                style={{
                  fontSize: 'clamp(40px, 5vw, 64px)',
                  fontWeight: 300,
                  letterSpacing: '-0.024em',
                  lineHeight: 1.1,
                }}
              >
                {COPY.material.headline}
              </h2>
              <p
                className="mt-3 text-[var(--color-ink-muted-48)]"
                style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '-0.012em' }}
              >
                {COPY.material.sub}
              </p>
              <p className="mt-12 text-[18px] leading-[1.7] tracking-[-0.012em] text-foreground italic font-light">
                {COPY.material.body}
              </p>
              <ul className="mt-12 space-y-3">
                {COPY.material.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="text-[12px] tracking-[0.08em] uppercase text-[var(--color-ink-muted-48)]"
                  >
                    — {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 04. COLOR (canvas, 3-grid) */}
      <section
        className="bg-[var(--color-canvas)] px-4 sm:px-6 lg:px-8"
        style={{ paddingTop: 'clamp(96px, 14vw, 192px)', paddingBottom: 'clamp(96px, 14vw, 192px)' }}
      >
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-20">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-muted-48)] mb-6">
              {COPY.color.eyebrow}
            </p>
            <h2
              className="text-foreground"
              style={{
                fontSize: 'clamp(40px, 5vw, 64px)',
                fontWeight: 300,
                letterSpacing: '-0.024em',
              }}
            >
              {COPY.color.headline}
            </h2>
            <p
              className="mt-4 text-[var(--color-ink-muted-48)]"
              style={{ fontSize: '16px', fontWeight: 300, letterSpacing: '0.04em' }}
            >
              {COPY.color.sub}
            </p>
          </div>
          {/* 3개 컬러칩, museum vitrine 여백 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-[800px] mx-auto">
            {COPY.color.chips.map((c) => (
              <div key={c.name} className="text-center">
                <div
                  className="aspect-square w-full mb-8"
                  style={{ backgroundColor: c.hex, boxShadow: '0 8px 40px rgba(0,0,0,0.04)' }}
                />
                <p
                  className="text-foreground italic"
                  style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '-0.012em' }}
                >
                  {c.story}
                </p>
                <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted-48)]">
                  {c.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05. SPECS (parchment, 5행 절제) */}
      <section
        className="bg-[var(--color-canvas-parchment)] px-4 sm:px-6 lg:px-8"
        style={{ paddingTop: 'clamp(96px, 14vw, 192px)', paddingBottom: 'clamp(96px, 14vw, 192px)' }}
      >
        <div className="max-w-[700px] mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-muted-48)]">
              {COPY.specs.eyebrow}
            </p>
          </div>
          <dl>
            {COPY.specs.rows.map((row, i) => (
              <div
                key={i}
                className="flex items-baseline justify-between py-6 border-t border-[var(--color-hairline)] last:border-b"
              >
                <dt className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-muted-48)]">
                  {row.label}
                </dt>
                <dd className="text-[18px] tabular-nums text-foreground font-light">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 06. USE CASE (canvas, 풀-블리드 한 사례만) */}
      <section
        className="bg-[var(--color-canvas)] px-4 sm:px-6 lg:px-8"
        style={{ paddingTop: 'clamp(96px, 14vw, 192px)', paddingBottom: 'clamp(96px, 14vw, 192px)' }}
      >
        <div className="max-w-[1300px] mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-muted-48)] mb-6">
              {COPY.useCase.eyebrow}
            </p>
            <h2
              className="text-foreground italic"
              style={{
                fontSize: 'clamp(40px, 5vw, 64px)',
                fontWeight: 300,
                letterSpacing: '-0.024em',
              }}
            >
              {COPY.useCase.headline}
            </h2>
          </div>
          <PlaceholderImage label="단 하나의 시공 사례" aspect="21:9" luxury />
          <div className="mt-12 text-center">
            <p className="text-[16px] text-foreground font-light italic">{COPY.useCase.space}</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-muted-48)]">
              — {COPY.useCase.designer}
            </p>
          </div>
        </div>
      </section>

      {/* 07. DESIGNER VOICE (DARK) — 8자 인용 */}
      <section
        className="bg-[var(--color-surface-tile-1)] px-4 sm:px-6 lg:px-8 text-white"
        style={{ paddingTop: 'clamp(120px, 16vw, 240px)', paddingBottom: 'clamp(120px, 16vw, 240px)' }}
      >
        <div className="max-w-[800px] mx-auto text-center">
          <blockquote>
            <p
              className="italic text-white"
              style={{
                fontSize: 'clamp(48px, 7vw, 96px)',
                fontWeight: 200,
                letterSpacing: '-0.028em',
                lineHeight: 1.1,
              }}
            >
              &ldquo;{COPY.designerVoice.quote}&rdquo;
            </p>
            <footer className="mt-20">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">
                — {COPY.designerVoice.author} · {COPY.designerVoice.role}
              </p>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* 08. LIFESTYLE (canvas, 풀-블리드, 분위기) */}
      <section
        className="bg-[var(--color-canvas)] px-4 sm:px-6 lg:px-8"
        style={{ paddingTop: 'clamp(96px, 14vw, 192px)', paddingBottom: 'clamp(96px, 14vw, 192px)' }}
      >
        <div className="max-w-[1400px] mx-auto">
          <PlaceholderImage label="Lifestyle · 정오의 결" aspect="21:9" luxury />
          <p
            className="mt-16 text-center italic text-foreground"
            style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 200, letterSpacing: '-0.022em' }}
          >
            {COPY.lifestyle.caption}
          </p>
        </div>
      </section>

      {/* 09. CRAFTSMANSHIP (DARK) — luxury 의 핵심 */}
      <section
        className="bg-[var(--color-surface-tile-1)] px-4 sm:px-6 lg:px-8 text-white"
        style={{ paddingTop: 'clamp(120px, 16vw, 240px)', paddingBottom: 'clamp(120px, 16vw, 240px)' }}
      >
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="lg:order-2">
              <PlaceholderImage label="Craftsmanship · 장인의 손" aspect="4:3" dark />
            </div>
            <div className="lg:order-1">
              <p className="text-[11px] uppercase tracking-[0.16em] mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {COPY.craftsmanship.eyebrow}
              </p>
              <h2
                className="text-white italic"
                style={{
                  fontSize: 'clamp(40px, 5vw, 64px)',
                  fontWeight: 300,
                  letterSpacing: '-0.024em',
                  lineHeight: 1.1,
                }}
              >
                {COPY.craftsmanship.headline}
              </h2>
              <p
                className="mt-12 text-[18px] leading-[1.8] tracking-[-0.012em] font-light"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                {COPY.craftsmanship.body}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 10. AUTHORITY (parchment) — 한 줄 절제 */}
      <section
        className="bg-[var(--color-canvas-parchment)] px-4 sm:px-6 lg:px-8 border-t border-[var(--color-hairline)]"
        style={{ paddingTop: 'clamp(64px, 10vw, 128px)', paddingBottom: 'clamp(64px, 10vw, 128px)' }}
      >
        <div className="max-w-[800px] mx-auto text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-ink-muted-48)]">
            {COPY.authority.body}
          </p>
        </div>
      </section>

      {/* 11. CTA / CLOSING (DARK) — 마지막 절정, 1 CTA */}
      <section
        className="bg-[var(--color-surface-tile-1)] px-4 sm:px-6 lg:px-8 text-white"
        style={{ paddingTop: 'clamp(96px, 14vw, 192px)', paddingBottom: 'clamp(120px, 16vw, 240px)' }}
      >
        <div className="max-w-[1300px] mx-auto">
          <PlaceholderImage label="마지막 절정" aspect="21:9" dark />
          <div className="text-center mt-20">
            <h2
              className="text-white italic"
              style={{
                fontSize: 'clamp(56px, 8vw, 120px)',
                fontWeight: 200,
                letterSpacing: '-0.028em',
                lineHeight: 1,
              }}
            >
              {COPY.cta.headline}
            </h2>
            <p
              className="mt-12 text-[12px] uppercase tracking-[0.32em]"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              {COPY.cta.sub}
            </p>
            <div className="mt-20">
              <button
                className="text-[13px] tracking-[0.16em] uppercase border-b border-white/40 pb-1 hover:border-white transition-colors"
                style={{ color: 'rgba(255,255,255,0.95)' }}
              >
                {COPY.cta.primary}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
