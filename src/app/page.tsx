/**
 * DIAVIS — Dian's Very Intelligent System
 *
 * 메인 진입점: AI 동반자 hero. NVIDIA 디자인 톤.
 * 기존 v1.0 경영 대시보드는 /dashboard 로 이동했음 (그대로 보존).
 *
 * 구조:
 * 1. Hero (검정 surface) — "좋은 오후예요, [형용사] 디안 멤버님 / DIAVIS가 준비되어 있습니다"
 * 2. 빠른 진입 카드 4개 (NVIDIA card + corner-square)
 * 3. AI 도구 강조 (Sparkles + 그린)
 * 4. 최근 활동 / 안내
 */
import Link from 'next/link'
import {
  ArrowRight,
  Sparkles,
  Brain,
  ScrollText,
  MessageSquare,
  LayoutDashboard,
  Plus,
  Sun,
  PieChart,
  Briefcase,
  Cpu,
  Receipt,
  CalendarCheck,
} from 'lucide-react'
import DiavisGreeting from '@/components/v11/diavis/DiavisGreeting'
import DashboardContent from '@/components/v11/diavis/DashboardContent'
import DailyOpsBlock from '@/components/v11/diavis/DailyOpsBlock'

export const dynamic = 'force-dynamic'

export default function DiavisHomePage() {
  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12">
      {/* ==================================================
          1. Hero — black surface + NVIDIA hero pattern
          ================================================== */}
      <section
        className="relative overflow-hidden"
        style={{ backgroundColor: 'var(--nv-surface-dark)', color: 'var(--nv-on-dark)' }}
      >
        {/* Decorative green corner squares (NVIDIA signature motif) */}
        <span
          className="absolute"
          style={{
            top: '32px',
            left: '32px',
            width: '12px',
            height: '12px',
            backgroundColor: 'var(--nv-primary)',
          }}
        />
        <span
          className="absolute"
          style={{
            bottom: '32px',
            right: '32px',
            width: '12px',
            height: '12px',
            backgroundColor: 'var(--nv-primary)',
          }}
        />

        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(var(--nv-primary) 1px, transparent 1px), linear-gradient(90deg, var(--nv-primary) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        <div
          className="relative max-w-[1280px] mx-auto px-6 sm:px-12"
          style={{ paddingTop: '80px', paddingBottom: '80px' }}
        >
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-8">
            <span
              className="inline-block"
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: 'var(--nv-primary)',
              }}
            />
            <span
              className="text-[12px] font-bold uppercase tracking-[0.2em]"
              style={{ color: 'var(--nv-primary)' }}
            >
              DIAVIS · Dian's Very Intelligent System
            </span>
          </div>

          {/* Greeting (Client Component — 시간·요일·랜덤 형용사) */}
          <DiavisGreeting />

          {/* CTAs */}
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link href="/transactions" className="nv-btn-outline-dark gap-2">
              <Receipt className="w-4 h-4" strokeWidth={2} />
              거래 관리
            </Link>
            <Link href="/settlement" className="nv-btn-outline-dark gap-2">
              <CalendarCheck className="w-4 h-4" strokeWidth={2} />
              일일 결산
            </Link>
            <Link href="/finance/briefing" className="nv-btn-primary gap-2">
              <Brain className="w-4 h-4" strokeWidth={2} />
              모닝 브리핑 시작
            </Link>
            <Link href="/dashboard" className="nv-btn-outline-dark gap-2">
              <LayoutDashboard className="w-4 h-4" strokeWidth={2} />
              경영 대시보드
            </Link>
          </div>
        </div>
      </section>

      {/* ==================================================
          1.5. 일일 운영 블록 — hero 직후 (KPI / 사이클 / 미수금 상태)
          ================================================== */}
      <section style={{ backgroundColor: 'var(--nv-canvas)' }}>
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12 py-10">
          <DailyOpsBlock />
        </div>
      </section>

      {/* ==================================================
          2. v1.0 경영 대시보드 — KPI / 차트 / 미수금 / 최근 거래
          ================================================== */}
      <section style={{ backgroundColor: 'var(--nv-surface-soft)' }}>
        <div
          className="max-w-[1280px] mx-auto px-6 sm:px-12"
          style={{ paddingTop: '48px', paddingBottom: '48px' }}
        >
          <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
            <div>
              <p
                className="nv-eyebrow mb-2"
                style={{ color: 'var(--nv-mute)' }}
              >
                CFO Cockpit
              </p>
              <h2
                className="nv-display-lg"
                style={{ color: 'var(--nv-ink)' }}
              >
                경영 대시보드.
              </h2>
            </div>
            <Link
              href="/dashboard"
              className="text-[13px] font-bold uppercase tracking-[0.06em] inline-flex items-center gap-1 hover:gap-2 transition-all"
              style={{ color: 'var(--nv-primary)' }}
            >
              상세 보기 →
            </Link>
          </div>
          <DashboardContent />
        </div>
      </section>

      {/* ==================================================
          3. 빠른 진입 — 4 cards with corner-square
          ================================================== */}
      <section style={{ backgroundColor: 'var(--nv-surface-soft)' }}>
        <div
          className="max-w-[1280px] mx-auto px-6 sm:px-12"
          style={{ paddingTop: '64px', paddingBottom: '64px' }}
        >
          <div className="mb-10">
            <p
              className="nv-eyebrow mb-3"
              style={{ color: 'var(--nv-mute)' }}
            >
              빠른 진입
            </p>
            <h2 className="nv-display-lg" style={{ color: 'var(--nv-ink)' }}>
              지금 바로 시작할 일.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <QuickCard
              href="/finance/daily"
              icon={Sun}
              title="일일 운영"
              desc="오늘의 일정 · 미팅 · 입출고 한눈에"
              eyebrow="DAILY"
            />
            <QuickCard
              href="/transactions?new=true"
              icon={Plus}
              title="새 거래"
              desc="거래를 입력하면 24셀·티어 자동 매핑"
              eyebrow="FINANCE"
            />
            <QuickCard
              href="/finance/ai-create"
              icon={Sparkles}
              title="AI Create"
              desc="상세페이지·블로그·카드뉴스 자동 생성"
              eyebrow="AI"
            />
            <QuickCard
              href="/finance/cockpit"
              icon={PieChart}
              title="CEO 코크핏"
              desc="4차원 AI 경영 파트너"
              eyebrow="STRATEGY"
            />
          </div>
        </div>
      </section>

      {/* ==================================================
          4. AI 도구 highlight — canvas
          ================================================== */}
      <section style={{ backgroundColor: 'var(--nv-canvas)' }}>
        <div
          className="max-w-[1280px] mx-auto px-6 sm:px-12"
          style={{ paddingTop: '64px', paddingBottom: '64px' }}
        >
          <div className="mb-10 flex items-end justify-between flex-wrap gap-4">
            <div>
              <p
                className="nv-eyebrow mb-3"
                style={{ color: 'var(--nv-mute)' }}
              >
                AI Companions
              </p>
              <h2
                className="nv-display-lg"
                style={{ color: 'var(--nv-ink)' }}
              >
                혼자가 아니에요.
              </h2>
            </div>
            <Link
              href="/finance/ai-create"
              className="nv-ghost-link"
            >
              모두 보기 →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <AICard
              href="/advisor"
              icon={Brain}
              title="AI CFO 자문"
              desc="재무·전략 질문에 즉시 응답하는 24시간 AI 자문역"
            />
            <AICard
              href="/finance/consult"
              icon={MessageSquare}
              title="라이브 컨설팅"
              desc="경영 사안에 실시간 시뮬레이션과 의사결정 지원"
            />
            <AICard
              href="/documents"
              icon={ScrollText}
              title="공문 작성"
              desc="단가 인상·인하·안내 문서를 디안 톤으로 자동 작성"
            />
          </div>
        </div>
      </section>

      {/* ==================================================
          4. Footer chapter — black, NVIDIA spec
          ================================================== */}
      <section
        className="relative"
        style={{
          backgroundColor: 'var(--nv-surface-dark)',
          color: 'var(--nv-on-dark)',
        }}
      >
        <span
          className="absolute"
          style={{
            top: '24px',
            left: '24px',
            width: '12px',
            height: '12px',
            backgroundColor: 'var(--nv-primary)',
          }}
        />

        <div
          className="max-w-[1280px] mx-auto px-6 sm:px-12 text-center"
          style={{ paddingTop: '80px', paddingBottom: '80px' }}
        >
          <p
            className="nv-eyebrow mb-4"
            style={{ color: 'var(--nv-primary)' }}
          >
            Built with Dian
          </p>
          <h3
            className="nv-display-xl mb-8"
            style={{ color: 'var(--nv-on-dark)' }}
          >
            결을 만드는 사람을 위한 시스템.
          </h3>
          <p
            className="nv-body max-w-2xl mx-auto mb-10"
            style={{ color: 'var(--nv-on-dark-mute)' }}
          >
            디안 CFO 는 인테리어 원단 비즈니스를 위한 통합 경영 시스템입니다.
            v1.0 의 검증된 운영 도구 위에 v1.1 의 AI 동반자 레이어를 더했습니다.
          </p>
          <Link href="/dashboard" className="nv-btn-primary gap-2">
            대시보드 열기
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>

          {/* Status row — 페이지 맨 아래 */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px max-w-3xl mx-auto">
            <StatusPill label="DIAVIS" value="Online" green />
            <StatusPill label="AI 모델" value="Sonnet 4.5" />
            <StatusPill label="이미지" value="Imagen 4" />
            <StatusPill label="버전" value="V2.1" />
          </div>
        </div>
      </section>
    </div>
  )
}

// ============================================================
// 보조 컴포넌트
// ============================================================

function StatusPill({
  label,
  value,
  green,
}: {
  label: string
  value: string
  green?: boolean
}) {
  return (
    <div
      className="px-4 py-3"
      style={{ backgroundColor: 'var(--nv-surface-elevated)' }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1"
        style={{ color: 'var(--nv-on-dark-mute)' }}
      >
        {label}
      </p>
      <p
        className="text-[14px] font-bold tracking-tight flex items-center gap-1.5"
        style={{ color: green ? 'var(--nv-primary)' : 'var(--nv-on-dark)' }}
      >
        {green && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: 'var(--nv-primary)' }}
          />
        )}
        {value}
      </p>
    </div>
  )
}

function QuickCard({
  href,
  icon: Icon,
  title,
  desc,
  eyebrow,
}: {
  href: string
  icon: typeof Sparkles
  title: string
  desc: string
  eyebrow: string
}) {
  return (
    <Link
      href={href}
      className="group relative block transition-colors"
      style={{
        backgroundColor: 'var(--nv-canvas)',
        border: '1px solid var(--nv-hairline)',
        borderRadius: '2px',
        padding: '24px',
      }}
    >
      {/* corner-square */}
      <span
        className="absolute"
        style={{
          top: '0',
          left: '0',
          width: '12px',
          height: '12px',
          backgroundColor: 'var(--nv-primary)',
        }}
      />

      <p
        className="text-[11px] font-bold uppercase tracking-[0.12em] mb-4 mt-2"
        style={{ color: 'var(--nv-mute)' }}
      >
        {eyebrow}
      </p>
      <Icon
        className="w-6 h-6 mb-4"
        strokeWidth={1.6}
        style={{ color: 'var(--nv-ink)' }}
      />
      <h3
        className="nv-card-title mb-2"
        style={{ color: 'var(--nv-ink)' }}
      >
        {title}
      </h3>
      <p
        className="nv-body-sm mb-5"
        style={{ color: 'var(--nv-body)' }}
      >
        {desc}
      </p>
      <span
        className="inline-flex items-center gap-1 text-[14px] font-bold uppercase tracking-[0.06em] group-hover:gap-2 transition-all"
        style={{ color: 'var(--nv-primary)' }}
      >
        시작 →
      </span>
    </Link>
  )
}

function AICard({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string
  icon: typeof Brain
  title: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="group relative block transition-colors"
      style={{
        backgroundColor: 'var(--nv-canvas)',
        border: '1px solid var(--nv-hairline)',
        borderRadius: '2px',
        padding: '32px',
      }}
    >
      <span
        className="absolute"
        style={{
          bottom: '0',
          right: '0',
          width: '12px',
          height: '12px',
          backgroundColor: 'var(--nv-primary)',
        }}
      />

      <Icon
        className="w-8 h-8 mb-5"
        strokeWidth={1.6}
        style={{ color: 'var(--nv-primary)' }}
      />
      <h3
        className="nv-heading-md mb-3"
        style={{ color: 'var(--nv-ink)' }}
      >
        {title}
      </h3>
      <p className="nv-body" style={{ color: 'var(--nv-body)' }}>
        {desc}
      </p>
      <span
        className="mt-6 inline-flex items-center gap-1 text-[14px] font-bold uppercase tracking-[0.06em] group-hover:gap-2 transition-all"
        style={{ color: 'var(--nv-primary)' }}
      >
        열기 →
      </span>
    </Link>
  )
}
