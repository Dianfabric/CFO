/**
 * 색동 신사업 대시보드 (V2.5)
 *
 * 디안 신규 라인 '색동공장' 전용 경영 화면.
 * - 12주 목표: 12주 대시보드와 동일 구조(큰 목표 + KR 선행/후행 + 주별 타겟 + 5일 투두)를
 *   '색동 신사업' 프로젝트 하나에 적용 (직원별 아님). OkrTree 재사용.
 *
 * 디안 본체 전체 매출은 '디안 경영 계기판'(/settlement)에 있으므로 여기선 제외.
 */
import Link from 'next/link'
import { Sparkles, Target, Wallet, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Employee } from '@/lib/cycle-okr'
import SaekdongOkr from './SaekdongOkr'
import SaekdongSales from './SaekdongSales'
import SaekdongOfflineSales from './SaekdongOfflineSales'
import SaekdongVision from './SaekdongVision'
import SaekdongKpi from './SaekdongKpi'
import SaekdongCosts from './SaekdongCosts'
import { getSaekdongVision, listSaekdongCosts } from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CycleInfo {
  id: number
  start_date: string
  end_date: string
}

async function loadCycleAndProject(): Promise<{
  cycle: CycleInfo | null
  project: Employee | null
}> {
  try {
    const sb = await createClient()
    const [{ data: cycle }, { data: project }] = await Promise.all([
      sb
        .from('cycles')
        .select('id, start_date, end_date')
        .eq('status', 'active')
        .order('cycle_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from('employees')
        .select('*')
        .eq('department', '__saekdong_project__')
        .maybeSingle(),
    ])
    return {
      cycle: (cycle as CycleInfo) ?? null,
      project: (project as Employee) ?? null,
    }
  } catch {
    return { cycle: null, project: null }
  }
}

export default async function SaekdongPage() {
  const [{ cycle, project }, vision, costs] = await Promise.all([
    loadCycleAndProject(),
    getSaekdongVision(),
    listSaekdongCosts(),
  ])

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
          색동공장 신규 라인의 12주 목표·매출 현황. 프로젝트 하나로 관리합니다.
        </p>
      </div>

      {/* 비전 · 미션 — 사장님이 직접 작성·수정 */}
      <SaekdongVision initialVision={vision.vision} initialMission={vision.mission} />

      {/* 12주 목표 — 색동 프로젝트 OKR (큰 목표 + KR + 주별 타겟 + 5일 투두) */}
      <div>
        <h2
          className="mb-3 text-base font-semibold flex items-center gap-1.5"
          style={{ color: 'var(--nv-ink)' }}
        >
          <Target className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />
          색동 12주 목표{' '}
          <span className="text-xs font-normal" style={{ color: 'var(--nv-stone)' }}>
            (큰 목표 → KR → 주별 → 일일 투두)
          </span>
        </h2>
        {cycle && project ? (
          <SaekdongOkr
            project={project}
            cycleId={cycle.id}
            cycleStart={cycle.start_date}
            cycleEnd={cycle.end_date}
          />
        ) : (
          <div
            className="bg-white p-4"
            style={{
              border: '1px solid var(--nv-hairline)',
              borderRadius: '2px',
              color: 'var(--nv-mute)',
            }}
          >
            {!cycle ? (
              <p className="text-[13px]">
                활성 12주 사이클이 없습니다.{' '}
                <Link
                  href="/finance/cycle"
                  className="underline"
                  style={{ color: 'var(--nv-success-deep)' }}
                >
                  12주 대시보드
                </Link>
                에서 사이클을 먼저 시작하세요.
              </p>
            ) : (
              <p className="text-[13px]">색동 프로젝트를 불러오지 못했습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* 색동 경영 지표 계기판 — 12주 목표와 쇼핑몰 매출 사이 (주/월/분기/년) */}
      <SaekdongKpi purchases={costs.purchases} expenses={costs.expenses} />

      {/* 색동 쇼핑몰 매출 (아임웹 실시간) */}
      <SaekdongSales />

      {/* 색동 오프라인 매출 (경영 계기판 일계표 매칭) */}
      <SaekdongOfflineSales />

      {/* 색동 매입·비용 — 매출원가(원단·완제품) + 고정비·변동비 */}
      <SaekdongCosts
        initialPurchases={costs.purchases}
        initialExpenses={costs.expenses}
        tableMissing={costs.tableMissing}
      />

      {/* 바로가기 */}
      <div>
        <h2
          className="mb-3 text-sm font-semibold flex items-center gap-1.5"
          style={{ color: 'var(--nv-ink)' }}
        >
          <Wallet className="w-3.5 h-3.5" style={{ color: 'var(--nv-mute)' }} />
          관련 화면
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/settlement', title: '디안 경영 계기판', desc: '일일 마감 + 매출·이익 흐름' },
            { href: '/finance/cycle', title: '12주 대시보드', desc: '전사 12주 목표 진행' },
            { href: '/finance/marketing/event-picker', title: '이벤트 피커', desc: '색동 댓글 이벤트 추첨' },
            {
              href: 'https://center-pf.kakao.com/',
              title: '카카오 채널 상담',
              desc: '파트너센터 채팅 (새 탭)',
              external: true,
            },
          ].map((c) => {
            const card = (
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
            )
            return c.external ? (
              <a key={c.href} href={c.href} target="_blank" rel="noreferrer" className="block">
                {card}
              </a>
            ) : (
              <Link key={c.href} href={c.href} className="block">
                {card}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
