/**
 * 디안 SS26 워시드 리넨 — 상세페이지 (PREVIEW)
 *
 * 5-에이전트 파이프라인 출력:
 *  - 13 섹션 골격 (Apple alternating tile rhythm)
 *  - premium 티어 적용
 *  - 8 심리 프레임워크 분산
 *  - 모바일 반응형 (CLAUDE.md 11.3.5)
 *
 * Run: docs/ai-create/runs/run_2026-05-07_washed-linen-premium/
 */
import Link from 'next/link'
import { ChevronLeft, ShieldCheck, Flame, Award, Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

const COPY = {
  cover: {
    eyebrow: '디안 SS26 · 워시드 리넨',
    headline: '빛에 가장 가까운 결.',
    sub: '디자이너가 고른 워시드 리넨, SS26.',
    body: '벨기에에서 짜고, 자연이 워싱했습니다.',
    primary_cta: '샘플 신청',
    secondary_cta: '디자인 미팅',
  },
  bigIdea: '공간이 입을 옷.',
  material: {
    eyebrow: '소재',
    headline: '결의 무게.',
    sub: '100% 워시드 리넨',
    body: '부드럽고 서늘한 결, 손끝에 머무는 무게감. 첫 세탁 후의 결을 자연이 미리 만들었습니다.',
    bullets: [
      '벨기에 직조 — 1858년의 손',
      '자연 워싱 4단계 — 부드러움의 출발',
      '통기성 + 드레이프 — 빛을 입는 자세',
    ],
  },
  color: {
    eyebrow: '컬러',
    headline: '4가지의 자연.',
    chips: [
      { name: '아이보리', hex: '#F5F0E8', story: '여명' },
      { name: '그레이지', hex: '#C4B8A8', story: '안개' },
      { name: '모스', hex: '#687A5F', story: '숲' },
      { name: '인디고', hex: '#2C3445', story: '심해' },
    ],
  },
  specs: {
    eyebrow: '스펙',
    headline: '객관적 사양.',
    rows: [
      { label: '폭', value: '150 cm' },
      { label: '중량', value: '280 g/m²' },
      { label: '소재', value: '워시드 리넨 100%' },
      { label: '직조 밀도', value: '200 × 180' },
      { label: '세탁', value: '찬물 손세탁 / 드라이클리닝 권장' },
      { label: '원산지', value: '벨기에 — Libeco' },
      { label: '최소 주문', value: '5 m' },
    ],
  },
  useCase: {
    eyebrow: '시공 사례',
    headline: '디자이너의 손에서.',
    sub: '실제 디자이너가 사용한 공간.',
    cases: [
      { designer: '하나인테리어 · 김지윤', space: '한남동 거실 · 동향 창' },
      { designer: '럭셔리리빙 · 박민호', space: '성수동 마스터 베드룸 · 북향 창' },
    ],
  },
  designerVoice: {
    quote: '이 결이 빛을 덜어낸다.',
    author: '김지윤',
    role: '하나인테리어 · 수석 디자이너',
  },
  compare: {
    eyebrow: '비교',
    headline: '일반 리넨 vs 디안.',
    before: { label: '일반 리넨', attrs: ['빳빳함', '광택'] },
    after: { label: '디안 워시드 리넨', attrs: ['부드러움', '무광 자연 톤'] },
  },
  lifestyle: {
    caption: '아침의 무게.',
  },
  craftsmanship: {
    eyebrow: '장인성',
    headline: '장인의 결',
    body: '벨기에 직조사 Libeco. 1858년부터 같은 손으로 짠 침묵의 결. 6대를 이어온 직조의 리듬은 기계로 복제할 수 없습니다.',
  },
  authority: {
    eyebrow: '인증·보증',
    headline: '디안의 약속.',
    body: '교환·환불 14일 · 디안 평생 보증 · 무상 샘플 발송.',
    icons: [
      { Icon: ShieldCheck, label: 'OEKO-TEX 100' },
      { Icon: Flame, label: '내구성 인증' },
      { Icon: Award, label: '디안 평생 보증' },
      { Icon: Package, label: '14일 교환' },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    headline: '자주 묻는 질문.',
    items: [
      {
        q: '세탁 가능한가요?',
        a: '찬물 손세탁이 가장 안전하며, 드라이클리닝도 권장됩니다. 첫 세탁 시 약간의 수축(2-3%)이 있을 수 있어 시공 전 충분한 여유 폭을 두세요.',
      },
      {
        q: '샘플 받을 수 있나요?',
        a: '네, 4가지 컬러 모두 무상으로 보내드립니다. 신청 후 2-3 영업일 이내 발송됩니다.',
      },
      {
        q: '최소 주문량과 납기는?',
        a: '최소 주문 5m, 일반 납기 7-10 영업일. 50m 이상 대량 주문 시 별도 견적 + 우선 납기 가능.',
      },
      {
        q: '시공 사례나 디자이너 추천을 받을 수 있나요?',
        a: '한남동·성수동·청담동 인근 디자이너 스튜디오 매칭 가능합니다. 디자인 미팅 신청 시 24시간 내 연락드립니다.',
      },
      {
        q: '다른 컬러 추가 출시 계획은?',
        a: 'FW26 시즌에 4가지 색상이 추가됩니다 (먹·청록·다홍·금사). 사전 알림 신청은 메일로 받습니다.',
      },
    ],
  },
  cta: {
    headline: '지금, 결을 만나세요.',
    sub: '한정 50롤 · 이번 주 입고',
    primary: '샘플 무상 신청',
    secondary: '미팅 예약',
  },
}

// 풀폭 비주얼 자리표시자 (Imagen 3 prompt 받기 전 임시)
function PlaceholderImage({
  label,
  aspect = '16:9',
  dark = false,
}: {
  label: string
  aspect?: '1:1' | '16:9' | '4:3' | '21:9' | '4:5' | '3:4'
  dark?: boolean
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
        dark ? 'bg-stone-800 border-stone-700' : 'bg-[var(--color-canvas-parchment)] border-[var(--color-hairline)]'
      } border border-dashed shadow-product-soft`}
    >
      <span
        className={`text-[11px] tracking-[-0.012em] italic ${
          dark ? 'text-stone-500' : 'text-[var(--color-ink-muted-48)]'
        }`}
      >
        Imagen 3 자리: {label} ({aspect})
      </span>
    </div>
  )
}

export default function WashedLinenPreviewPage() {
  return (
    /* main padding escape — 풀-블리드 tile 패턴 */
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12">
      {/* 미리보기 안내 바 */}
      <div className="bg-[var(--color-canvas-parchment)] border-b border-[var(--color-hairline)] px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-3">
          <Link
            href="/finance/ai-create/product-detail"
            className="inline-flex items-center gap-1 text-[12px] tracking-[-0.012em] text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={1.8} />
            상세페이지 에이전트
          </Link>
          <span className="text-[11px] tracking-[-0.01em] text-[var(--color-ink-muted-48)]">
            🤖 5-에이전트 생성 결과 — premium 티어 · 13 섹션
          </span>
        </div>
      </div>

      {/* 01. COVER (canvas) */}
      <section className="bg-[var(--color-canvas)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="eyebrow mb-6 inline-flex items-center gap-2">
            <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
            <span>{COPY.cover.eyebrow}</span>
          </div>
          <h1 className="text-hero text-foreground">{COPY.cover.headline}</h1>
          <p className="text-lead mt-8 text-[var(--color-ink-muted-48)] max-w-2xl mx-auto">
            {COPY.cover.sub}
          </p>
          <div className="mt-12 max-w-[1100px] mx-auto">
            <PlaceholderImage label="01 Cover · 워시드 리넨 빅 비주얼" aspect="16:9" />
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <button className="rounded-full bg-primary text-primary-foreground h-12 px-7 text-[15px] tracking-tight active:scale-95 transition-all hover:bg-[#0058b3]">
              {COPY.cover.primary_cta}
            </button>
            <button className="rounded-full bg-transparent text-primary border border-primary/80 h-12 px-7 text-[15px] tracking-tight active:scale-95 transition-all hover:bg-primary/5">
              {COPY.cover.secondary_cta}
            </button>
          </div>
        </div>
      </section>

      {/* 02. BIG IDEA (DARK) */}
      <section className="bg-[var(--color-surface-tile-1)] section-pad-sm px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto text-center">
          <h2 className="text-hero text-white">{COPY.bigIdea}</h2>
        </div>
      </section>

      {/* 03. MATERIAL (parchment, 2-col) */}
      <section className="bg-[var(--color-canvas-parchment)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <PlaceholderImage label="03 Material · 마크로샷 + 손" aspect="4:3" />
            </div>
            <div>
              <div className="eyebrow mb-4 inline-flex items-center gap-2">
                <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
                <span>{COPY.material.eyebrow}</span>
              </div>
              <h2 className="text-display-md text-foreground">{COPY.material.headline}</h2>
              <p className="mt-3 text-[18px] tracking-[-0.012em] text-[var(--color-ink-muted-48)]">
                {COPY.material.sub}
              </p>
              <p className="mt-6 text-[17px] tracking-[-0.012em] leading-[1.6] text-[var(--color-ink-muted-80)]">
                {COPY.material.body}
              </p>
              <ul className="mt-8 space-y-2.5">
                {COPY.material.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-[15px] tracking-[-0.012em] text-[var(--color-ink-muted-80)]"
                  >
                    <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 04. COLOR (canvas, 4-grid) */}
      <section className="bg-[var(--color-canvas)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <div className="eyebrow mb-4 inline-flex items-center gap-2">
              <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
              <span>{COPY.color.eyebrow}</span>
            </div>
            <h2 className="text-display-lg text-foreground">{COPY.color.headline}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {COPY.color.chips.map((c) => (
              <div key={c.name} className="text-center">
                <div
                  className="aspect-square w-full border border-[var(--color-hairline)] mb-4"
                  style={{ backgroundColor: c.hex }}
                />
                <p className="text-[15px] font-semibold tracking-[-0.022em] text-foreground">
                  {c.story}
                </p>
                <p className="mt-1 text-[12px] tracking-[-0.01em] text-[var(--color-ink-muted-48)]">
                  {c.name}
                </p>
                <p className="mt-0.5 text-[10px] font-mono tracking-wider text-[var(--color-ink-muted-48)]/70">
                  {c.hex}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05. SPECS (parchment) */}
      <section className="bg-[var(--color-canvas-parchment)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[800px] mx-auto">
          <div className="text-center mb-16">
            <div className="eyebrow mb-4 inline-flex items-center gap-2">
              <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
              <span>{COPY.specs.eyebrow}</span>
            </div>
            <h2 className="text-display-lg text-foreground">{COPY.specs.headline}</h2>
          </div>
          <dl className="space-y-0">
            {COPY.specs.rows.map((row, i) => (
              <div
                key={i}
                className="flex items-baseline justify-between py-4 border-t border-[var(--color-hairline)] last:border-b"
              >
                <dt className="text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted-48)]">
                  {row.label}
                </dt>
                <dd className="text-[17px] tracking-[-0.012em] tabular-nums text-foreground">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 06. USE CASE (canvas, 2-col) */}
      <section className="bg-[var(--color-canvas)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <div className="eyebrow mb-4 inline-flex items-center gap-2">
              <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
              <span>{COPY.useCase.eyebrow}</span>
            </div>
            <h2 className="text-display-lg text-foreground">{COPY.useCase.headline}</h2>
            <p className="text-lead mt-4 text-[var(--color-ink-muted-48)]">{COPY.useCase.sub}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {COPY.useCase.cases.map((c, i) => (
              <div key={i}>
                <PlaceholderImage label={`06 시공 ${i + 1} · ${c.space}`} aspect="4:3" />
                <p className="mt-4 text-[15px] font-semibold tracking-[-0.022em] text-foreground">
                  {c.designer}
                </p>
                <p className="mt-1 text-[13px] tracking-[-0.01em] text-[var(--color-ink-muted-48)]">
                  {c.space}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 07. DESIGNER VOICE (DARK) */}
      <section className="bg-[var(--color-surface-tile-1)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[900px] mx-auto text-center">
          <blockquote>
            <p className="text-display-lg text-white italic">
              &ldquo;{COPY.designerVoice.quote}&rdquo;
            </p>
            <footer className="mt-12">
              <p className="text-[15px] font-semibold tracking-[-0.022em] text-white">
                {COPY.designerVoice.author}
              </p>
              <p className="mt-1 text-[13px] tracking-[-0.01em] text-white/60">
                {COPY.designerVoice.role}
              </p>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* 08. COMPARE (parchment) */}
      <section className="bg-[var(--color-canvas-parchment)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <div className="eyebrow mb-4 inline-flex items-center gap-2">
              <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
              <span>{COPY.compare.eyebrow}</span>
            </div>
            <h2 className="text-display-lg text-foreground">{COPY.compare.headline}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="text-center">
              <PlaceholderImage label="Before · 일반 리넨" aspect="1:1" />
              <p className="mt-5 text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted-48)]">
                {COPY.compare.before.label}
              </p>
              <ul className="mt-3 space-y-1">
                {COPY.compare.before.attrs.map((a, i) => (
                  <li
                    key={i}
                    className="text-[15px] tracking-[-0.012em] text-[var(--color-ink-muted-80)]"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center">
              <PlaceholderImage label="After · 디안 워시드 리넨" aspect="1:1" />
              <p className="mt-5 text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--color-action)]">
                {COPY.compare.after.label}
              </p>
              <ul className="mt-3 space-y-1">
                {COPY.compare.after.attrs.map((a, i) => (
                  <li
                    key={i}
                    className="text-[15px] font-semibold tracking-[-0.012em] text-foreground"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 09. LIFESTYLE (canvas, 풀-블리드) */}
      <section className="bg-[var(--color-canvas)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="relative">
            <PlaceholderImage label="09 Lifestyle · 아침 빛 인테리어" aspect="21:9" />
            <p className="mt-8 text-center text-display-md text-[var(--color-ink-muted-48)] italic font-light">
              {COPY.lifestyle.caption}
            </p>
          </div>
        </div>
      </section>

      {/* 10. CRAFTSMANSHIP (DARK) */}
      <section className="bg-[var(--color-surface-tile-1)] section-pad px-4 sm:px-6 lg:px-8 text-white">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="lg:order-2">
              <PlaceholderImage label="10 Craftsmanship · 직기와 손" aspect="16:9" dark />
            </div>
            <div className="lg:order-1">
              <div className="eyebrow mb-4 inline-flex items-center gap-2" style={{ color: 'var(--color-action-on-dark)' }}>
                <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
                <span>{COPY.craftsmanship.eyebrow}</span>
              </div>
              <h2 className="text-display-lg text-white">{COPY.craftsmanship.headline}</h2>
              <p className="mt-8 text-[18px] tracking-[-0.012em] leading-[1.6] text-white/80">
                {COPY.craftsmanship.body}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 11. AUTHORITY (parchment) */}
      <section className="bg-[var(--color-canvas-parchment)] section-pad-sm px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-12">
            <div className="eyebrow mb-4 inline-flex items-center gap-2">
              <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
              <span>{COPY.authority.eyebrow}</span>
            </div>
            <h2 className="text-display-md text-foreground">{COPY.authority.headline}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {COPY.authority.icons.map(({ Icon, label }, i) => (
              <div
                key={i}
                className="flex flex-col items-center text-center bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-[18px] p-6"
              >
                <Icon className="w-7 h-7 text-foreground" strokeWidth={1.5} />
                <p className="mt-3 text-[13px] font-semibold tracking-[-0.012em] text-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-[15px] tracking-[-0.012em] text-[var(--color-ink-muted-48)]">
            {COPY.authority.body}
          </p>
        </div>
      </section>

      {/* 12. FAQ (canvas) */}
      <section className="bg-[var(--color-canvas)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[800px] mx-auto">
          <div className="text-center mb-16">
            <div className="eyebrow mb-4 inline-flex items-center gap-2">
              <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
              <span>{COPY.faq.eyebrow}</span>
            </div>
            <h2 className="text-display-lg text-foreground">{COPY.faq.headline}</h2>
          </div>
          <ul className="space-y-0">
            {COPY.faq.items.map((item, i) => (
              <li
                key={i}
                className="py-6 border-t border-[var(--color-hairline)] last:border-b"
              >
                <p className="text-[17px] font-semibold tracking-[-0.022em] text-foreground">
                  {item.q}
                </p>
                <p className="mt-3 text-[15px] tracking-[-0.012em] leading-[1.6] text-[var(--color-ink-muted-80)]">
                  {item.a}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 13. CTA / CLOSING (DARK, Peak-End) */}
      <section className="bg-[var(--color-surface-tile-1)] section-pad px-4 sm:px-6 lg:px-8 text-white">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="mb-12">
            <PlaceholderImage label="13 CTA · 마지막 빅 비주얼" aspect="21:9" dark />
          </div>
          <h2 className="text-hero text-white">{COPY.cta.headline}</h2>
          <p
            className="mt-8 text-[15px] uppercase tracking-[0.16em]"
            style={{ color: 'var(--color-action-on-dark)' }}
          >
            {COPY.cta.sub}
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <button className="rounded-full bg-white text-foreground h-12 px-7 text-[15px] tracking-tight active:scale-95 transition-all hover:bg-white/90">
              {COPY.cta.primary}
            </button>
            <button className="rounded-full bg-transparent text-white border border-white/40 h-12 px-7 text-[15px] tracking-tight active:scale-95 transition-all hover:bg-white/10">
              {COPY.cta.secondary}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
