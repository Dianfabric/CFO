/**
 * 재무 메인 대시보드 (Phase 1 ① / PRD #3 ①)
 *
 * Server Component — Supabase에서 데이터 fetch.
 * - 미인증 상태: RLS가 transactions 차단 → 빈 차트 + 빈 KPI (페이지 자체는 정상 렌더)
 * - CEO 인증 후: 본인 회사 전체 데이터 표시
 */
import { Button } from '@/components/ui/button'
import SegmentMatrix from '@/components/v11/finance/SegmentMatrix'
import TierBreakdown from '@/components/v11/finance/TierBreakdown'
import MonthlyPLChart from '@/components/v11/finance/MonthlyPLChart'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/formatters'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadDashboardData() {
  try {
    const supabase = await createClient()

    const [monthlyRes, segmentRes, tierRes, arRes, todayRes] = await Promise.all([
      supabase.from('monthly_pl').select('*').order('month', { ascending: false }).limit(12),
      supabase.from('revenue_by_segment').select('*'),
      supabase.from('revenue_by_tier').select('*'),
      supabase
        .from('outstanding_payments')
        .select('client_id, transaction_count, total_outstanding')
        .limit(100),
      // 오늘 KPI: 가장 최근 일일결산
      supabase
        .from('daily_closes')
        .select('*')
        .order('close_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    return {
      monthly: monthlyRes.data ?? [],
      segments: segmentRes.data ?? [],
      tiers: tierRes.data ?? [],
      receivables: arRes.data ?? [],
      todayClose: todayRes.data ?? null,
      errors: [
        monthlyRes.error,
        segmentRes.error,
        tierRes.error,
        arRes.error,
        todayRes.error,
      ].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      monthly: [],
      segments: [],
      tiers: [],
      receivables: [],
      todayClose: null,
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function FinanceDashboardPage() {
  const { monthly, segments, tiers, receivables, todayClose, errors } = await loadDashboardData()

  // KPI 계산
  const todayRevenue = Number(todayClose?.total_revenue) || 0
  const todayMargin = Number(todayClose?.contribution_margin) || 0
  const todayTxCount = Number(todayClose?.transaction_count) || 0

  // 이번 달 (가장 최근 month_pl 행)
  const thisMonth = monthly[0]
  const monthRevenue = Number(thisMonth?.revenue) || 0
  const monthMargin = Number(thisMonth?.contribution_margin) || 0
  const monthMarginRate = Number(thisMonth?.contribution_margin_rate) || 0

  // 미수금
  const totalOutstanding = receivables.reduce(
    (sum, r) => sum + (Number(r.total_outstanding) || 0),
    0,
  )

  const isEmpty =
    monthly.length === 0 &&
    segments.every((s) => Number(s.revenue) === 0) &&
    !todayClose

  return (
    /* Apple tile pattern — main padding escape (viewport 적응) */
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12">
      {/* ================================================================
          TILE 1 — Hero (light/canvas)
          극도로 큰 헤드라인 + 짧은 lead + 2개 pill CTA + 200px+ vertical air
         ================================================================ */}
      <section className="bg-[var(--color-canvas)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto text-center">
          <div className="eyebrow mb-6 inline-flex items-center gap-2">
            <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
            <span>재무 메인</span>
          </div>
          <h1 className="text-hero text-foreground">
            오늘이 어떤<br />하루였나요.
          </h1>
          <p className="text-lead mt-8 text-[var(--color-ink-muted-48)] max-w-2xl mx-auto">
            매일 한 번 펼치면 끝. 오늘, 이번 달, 추이, 24셀, 그리고 4티어.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/finance/cycle">
              <Button>이번 사이클 보기</Button>
            </Link>
            <Link href="/finance/decomposition">
              <Button variant="outline">매출 인수분해</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 비어있을 때 / 에러 안내 (slim hairline strip) */}
      {(isEmpty || errors.length > 0) && (
        <section className="bg-[var(--color-canvas)] px-4 sm:px-6 lg:px-8 pb-4 -mt-12">
          <div className="max-w-[1100px] mx-auto space-y-2">
            {isEmpty && (
              <div className="flex items-center gap-2.5 text-[13px] tracking-[-0.01em] text-[var(--color-ink-muted-80)] py-3 border-t border-[var(--color-hairline)]">
                <span className="inline-block h-1 w-1 rounded-full bg-[var(--color-action)] shrink-0" />
                <strong className="text-foreground font-semibold">데이터가 비어 있습니다.</strong>
                <span className="text-[var(--color-ink-muted-48)]">거래 입력 시 자동으로 채워집니다.</span>
              </div>
            )}
            {errors.length > 0 && (
              <div className="flex items-center gap-2.5 text-[13px] tracking-[-0.01em] text-[var(--color-ink-muted-80)] py-3 border-t border-[var(--color-hairline)]">
                <span className="inline-block h-1 w-1 rounded-full bg-[var(--color-alert-red)] shrink-0" />
                <strong className="text-foreground font-semibold">일부 데이터 로드 오류</strong>
                <span className="text-[var(--color-ink-muted-48)]">{errors[0]?.message}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================
          TILE 2 — DARK 이번 달 highlight (Apple alternating rhythm 핵심)
          near-black surface + GIANT 흰 숫자
         ================================================================ */}
      <section className="bg-[var(--color-surface-tile-1)] text-white section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-20">
            <div className="eyebrow mb-5 inline-flex items-center gap-2" style={{ color: 'var(--color-action-on-dark)' }}>
              <span className="inline-block h-1 w-1 rounded-full bg-current opacity-70" />
              <span>이번 달</span>
            </div>
            <h2 className="text-display-lg text-white">
              지금까지의 흐름.
            </h2>
          </div>

          {/* GIANT 숫자 — 카드 chrome 없이 숫자만이 주연 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-16 gap-x-8 max-w-[1100px] mx-auto">
            <BigStat
              label="오늘 매출"
              value={formatKRW(todayRevenue)}
              hint={todayClose ? `${todayTxCount}건` : '없음'}
              accent={todayRevenue > 0 ? 'action' : 'muted'}
            />
            <BigStat
              label="이번 달 매출"
              value={formatKRW(monthRevenue)}
              hint={thisMonth ? `${thisMonth.transaction_count}건 · ${thisMonth.active_clients}고객` : '없음'}
              accent={monthRevenue > 0 ? 'action' : 'muted'}
            />
            <BigStat
              label="공헌이익"
              value={formatKRW(monthMargin)}
              hint={monthRevenue > 0 ? `이익률 ${monthMarginRate.toFixed(1)}%` : '없음'}
              accent={monthMargin > 0 ? 'action' : 'muted'}
            />
            <BigStat
              label="미수금"
              value={formatKRW(totalOutstanding)}
              hint={receivables.length > 0 ? `${receivables.length}건` : '없음'}
              accent={totalOutstanding > 0 ? 'alert' : 'muted'}
            />
          </div>

          <div className="mt-20 text-center">
            <Link
              href="/finance/decomposition"
              className="inline-flex items-center gap-1.5 text-[15px] tracking-[-0.012em] text-[var(--color-action-on-dark)] hover:underline"
            >
              자세한 분해 보기
              <span className="text-[12px]">›</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          TILE 3 — 12개월 곡선 (light/canvas, 차트가 "제품")
         ================================================================ */}
      <section className="bg-[var(--color-canvas)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-display-lg text-foreground">
              12개월의 곡선.
            </h2>
            <p className="text-lead mt-5 text-[var(--color-ink-muted-48)] max-w-xl mx-auto">
              매출과 변동비가 만든 공헌이익률.
            </p>
          </div>
          {/* 차트 = 제품. pedestal + product-shadow 로 받쳐줌 */}
          <div className="pedestal shadow-product-soft">
            <MonthlyPLChart data={monthly} />
          </div>
        </div>
      </section>

      {/* ================================================================
          TILE 4 — 24셀 매트릭스 (parchment, gallery 톤)
         ================================================================ */}
      <section className="bg-[var(--color-canvas-parchment)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-display-lg text-foreground">
              24셀의 지도.
            </h2>
            <p className="text-lead mt-5 text-[var(--color-ink-muted-48)] max-w-xl mx-auto">
              6직업군 × 4제품군. 어디에 매출이 모이는지 한눈에.
            </p>
          </div>
          <div className="pedestal shadow-product-soft">
            {segments.length > 0 ? (
              <SegmentMatrix data={segments} />
            ) : (
              <p className="py-16 text-center text-[14px] text-[var(--color-ink-muted-48)] italic">
                세그먼트 마스터 데이터 없음
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================
          TILE 5 — 4티어 분포 (light/canvas)
         ================================================================ */}
      <section className="bg-[var(--color-canvas)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-display-lg text-foreground">
              4티어의 균형.
            </h2>
            <p className="text-lead mt-5 text-[var(--color-ink-muted-48)] max-w-xl mx-auto">
              저가에서 럭셔리까지. 디안의 무게중심은 어디.
            </p>
          </div>
          <div className="pedestal shadow-product-soft">
            {tiers.length > 0 ? (
              <TierBreakdown data={tiers} />
            ) : (
              <p className="py-16 text-center text-[14px] text-[var(--color-ink-muted-48)] italic">
                티어 마스터 데이터 없음
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================
          TILE 6 — 추가 분석 (parchment, gallery grid)
         ================================================================ */}
      <section className="bg-[var(--color-canvas-parchment)] section-pad px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-display-lg text-foreground">
              더 깊게.
            </h2>
            <p className="text-lead mt-5 text-[var(--color-ink-muted-48)] max-w-xl mx-auto">
              회계, 자본, BSC, LTV — 필요한 시점에 펼치세요.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:grid-cols-4">
            {[
              { href: '/finance/accounting', title: '회계법인 연동', desc: '월결산 export' },
              { href: '/finance/equity', title: '자기자본 분석', desc: 'YTD 손익' },
              { href: '/finance/bsc', title: 'BSC 4관점', desc: '통합 점검' },
              { href: '/finance/ltv', title: 'LTV·CAC', desc: '거래처 수익성' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="group block press-scale">
                <div className="bg-card border border-[var(--color-hairline)] rounded-[18px] p-7 transition-all duration-200 group-hover:border-foreground/40 h-full flex flex-col">
                  <div className="flex-1">
                    <h3 className="text-[17px] font-semibold tracking-[-0.022em] text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] tracking-[-0.012em] text-[var(--color-ink-muted-48)]">
                      {item.desc}
                    </p>
                  </div>
                  <div className="mt-6 text-[13px] tracking-[-0.012em] text-[var(--color-action)] inline-flex items-center gap-1">
                    살펴보기 <span className="text-[11px]">›</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          TILE 7 — Footer (Apple parchment footer 톤)
         ================================================================ */}
      <footer className="bg-[var(--color-canvas-parchment)] px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-8 sm:pb-10 border-t border-[var(--color-hairline)]">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid gap-10 md:grid-cols-4 pb-10 border-b border-[var(--color-hairline)]">
            <div>
              <p className="text-[12px] font-semibold tracking-[-0.012em] text-foreground mb-3">
                다음 페이지
              </p>
              <ul className="space-y-2.5 text-[12px] tracking-[-0.01em] text-[var(--color-ink-muted-48)]">
                <li>② 거래 입력</li>
                <li>③ 일일 운영</li>
                <li>④ 매출 인수분해</li>
                <li>⑤ 12주 대시보드</li>
              </ul>
            </div>
            <div>
              <p className="text-[12px] font-semibold tracking-[-0.012em] text-foreground mb-3">
                v1.0
              </p>
              <ul className="space-y-2.5 text-[12px] tracking-[-0.01em]">
                <li>
                  <Link href="/" className="text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors">
                    대시보드
                  </Link>
                </li>
                <li>
                  <Link href="/transactions" className="text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors">
                    거래 관리
                  </Link>
                </li>
                <li>
                  <Link href="/documents" className="text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors">
                    공문 작성
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[12px] font-semibold tracking-[-0.012em] text-foreground mb-3">
                v1.1
              </p>
              <ul className="space-y-2.5 text-[12px] tracking-[-0.01em]">
                <li>
                  <Link href="/finance/cycle" className="text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors">
                    12주 사이클
                  </Link>
                </li>
                <li>
                  <Link href="/finance/team" className="text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors">
                    팀 공유
                  </Link>
                </li>
                <li>
                  <Link href="/finance/sales/materials" className="text-[var(--color-ink-muted-48)] hover:text-foreground transition-colors">
                    영업자료
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[12px] font-semibold tracking-[-0.012em] text-foreground mb-3">
                디안
              </p>
              <p className="text-[12px] tracking-[-0.008em] text-[var(--color-ink-muted-48)] leading-[1.6]">
                인테리어 원단 큐레이터<br />
                v1.0 + v1.1 통합
              </p>
            </div>
          </div>
          <div className="pt-6 flex items-center justify-between text-[11px] tracking-[-0.008em] text-[var(--color-ink-muted-48)]">
            <span>© Dian Fabric. All rights reserved.</span>
            <span>v1.0 + v1.1</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ================================================================
   GIANT KPI — Apple homepage 의 "product" 자리
   숫자가 곧 제품. clamp 로 viewport 비례.
   ================================================================ */
function BigStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint: string
  accent: 'action' | 'alert' | 'muted'
}) {
  const dotColor =
    accent === 'action'
      ? 'bg-[var(--color-action-on-dark)]'
      : accent === 'alert'
        ? 'bg-[var(--color-alert-red)]'
        : 'bg-white/30'
  return (
    <div className="text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
      <p className="giant-sm mt-4 text-white">{value}</p>
      <p className="mt-4 text-[12px] tracking-[-0.012em] text-white/60 inline-flex items-center gap-1.5">
        <span className={`inline-block h-1 w-1 rounded-full ${dotColor}`} />
        {hint}
      </p>
    </div>
  )
}
