/**
 * 색동 신사업 대시보드 (V2.5)
 *
 * 디안 신규 라인 '색동공장' 전용 경영 화면. 초기 단계라 골격 우선.
 * - 색동 전용 지표(매출/비용/이익) 자리 — 데이터 쌓이면 채워짐
 * - 디안 본체 전체 매출과 엮어 비교하는 섹션 (transactions 집계)
 *
 * 색동 거래 구분 방식은 데이터가 쌓이면 결정 (channel/notes/전용 태그 등).
 * 지금은 전체 매출 요약 + 색동 목표 진행 골격만.
 */
import Link from 'next/link'
import { Sparkles, TrendingUp, Target, Wallet, ArrowRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatKRW } from '@/lib/formatters'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Summary {
  monthRevenue: number
  monthCount: number
  totalRevenue: number
  totalCount: number
}

async function loadSummary(): Promise<Summary> {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [monthAgg, totalAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'SALE', date: { gte: monthStart } },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'SALE' },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
    ])

    return {
      monthRevenue: monthAgg._sum.totalAmount ?? 0,
      monthCount: monthAgg._count._all ?? 0,
      totalRevenue: totalAgg._sum.totalAmount ?? 0,
      totalCount: totalAgg._count._all ?? 0,
    }
  } catch {
    return { monthRevenue: 0, monthCount: 0, totalRevenue: 0, totalCount: 0 }
  }
}

export default async function SaekdongPage() {
  const s = await loadSummary()

  // 색동 월 매출 목표 (한태원 대표 12주 KR — 월 1억)
  const SAEKDONG_MONTHLY_GOAL = 100_000_000
  // 색동 전용 매출은 아직 별도 집계 안 함 → 0 (데이터 태깅 방식 결정 후 연동)
  const saekdongMonthRevenue = 0
  const goalRate =
    SAEKDONG_MONTHLY_GOAL > 0
      ? Math.min(100, (saekdongMonthRevenue / SAEKDONG_MONTHLY_GOAL) * 100)
      : 0

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--nv-primary)' }} />
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--nv-primary)' }}
          >
            신사업 라인
          </span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--nv-ink)' }}>
          색동 신사업
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--nv-mute)' }}>
          색동공장 신규 라인의 매출·목표 현황. 초기 단계라 지표는 데이터가 쌓이며 채워집니다.
        </p>
      </div>

      {/* 색동 월 매출 목표 진행 */}
      <div
        className="bg-white p-4"
        style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Target className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />
          <h2
            className="text-[13px] font-bold uppercase tracking-[0.04em]"
            style={{ color: 'var(--nv-ink)' }}
          >
            색동 월 매출 목표
          </h2>
          <span className="text-[10px]" style={{ color: 'var(--nv-stone)' }}>
            · 한태원 대표 12주 KR (월 1억)
          </span>
        </div>
        <div className="flex items-baseline justify-between mb-2">
          <span
            className="text-[24px] font-bold tabular-nums"
            style={{ color: 'var(--nv-primary)' }}
          >
            {formatKRW(saekdongMonthRevenue)}
          </span>
          <span className="text-[12px]" style={{ color: 'var(--nv-stone)' }}>
            / 목표 {formatKRW(SAEKDONG_MONTHLY_GOAL)}
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden"
          style={{ backgroundColor: 'var(--nv-surface-soft)', borderRadius: '2px' }}
        >
          <div
            className="h-full transition-all"
            style={{ width: `${goalRate}%`, backgroundColor: 'var(--nv-primary)' }}
          />
        </div>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--nv-mute)' }}>
          색동 전용 매출 집계는 거래 태깅 방식 확정 후 연동됩니다. 현재는 목표 골격만 표시.
        </p>
      </div>

      {/* 디안 본체 전체 매출 (엮어 보기) */}
      <div>
        <h2
          className="mb-3 text-base font-semibold flex items-center gap-1.5"
          style={{ color: 'var(--nv-ink)' }}
        >
          <TrendingUp className="w-4 h-4" style={{ color: 'var(--nv-mute)' }} />
          디안 본체 전체 매출{' '}
          <span className="text-xs font-normal" style={{ color: 'var(--nv-stone)' }}>
            (거래 데이터 자동 집계)
          </span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="이번 달 매출"
            value={formatKRW(s.monthRevenue)}
            hint={`${s.monthCount.toLocaleString()}건`}
            accent
          />
          <StatCard
            label="이번 달 거래"
            value={`${s.monthCount.toLocaleString()}건`}
            hint="이번 달 판매 건수"
          />
          <StatCard
            label="누적 매출 (전체)"
            value={formatKRW(s.totalRevenue)}
            hint={`${s.totalCount.toLocaleString()}건`}
            accent
          />
          <StatCard
            label="누적 거래 (전체)"
            value={`${s.totalCount.toLocaleString()}건`}
            hint="전체 판매 건수"
          />
        </div>
      </div>

      {/* 바로가기 */}
      <div>
        <h2
          className="mb-3 text-sm font-semibold flex items-center gap-1.5"
          style={{ color: 'var(--nv-ink)' }}
        >
          <Wallet className="w-3.5 h-3.5" style={{ color: 'var(--nv-mute)' }} />
          관련 화면
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { href: '/settlement', title: '디안 경영 계기판', desc: '일일 마감 + 매출·이익 흐름' },
            { href: '/finance/cycle', title: '12주 대시보드', desc: '색동 월 1억 KR 진행' },
            { href: '/finance/marketing/event-picker', title: '이벤트 피커', desc: '색동 댓글 이벤트 추첨' },
          ].map((c) => (
            <Link key={c.href} href={c.href} className="block">
              <div
                className="bg-white p-4 h-full transition-colors"
                style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="inline-block w-2 h-2"
                    style={{ backgroundColor: 'var(--nv-primary)' }}
                  />
                  <ArrowRight className="w-4 h-4" style={{ color: 'var(--nv-stone)' }} />
                </div>
                <div className="text-[14px] font-bold" style={{ color: 'var(--nv-ink)' }}>
                  {c.title}
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: 'var(--nv-mute)' }}>
                  {c.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint: string
  accent?: boolean
}) {
  return (
    <div
      className="bg-white p-4"
      style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--nv-mute)' }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-[22px] font-bold tabular-nums leading-none"
        style={{ color: accent ? 'var(--nv-primary)' : 'var(--nv-ink)' }}
      >
        {value}
      </p>
      <p className="mt-2 text-[11px]" style={{ color: 'var(--nv-stone)' }}>
        {hint}
      </p>
    </div>
  )
}
