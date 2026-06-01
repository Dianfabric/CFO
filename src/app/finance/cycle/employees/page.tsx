/**
 * 12주 사이클 — 직원 관리 & 직원별 워크스페이스 (토글식)
 *
 * 좌측: 직원 카드 토글 리스트 (6명, 추가/편집/순서)
 * 우측 (확장): 선택된 직원의 OKR 트리 (Goal → KR → 주간 → 투두)
 *
 * 본 페이지는 매일 아침 사이클 대시보드 진입점 중 하나.
 */
import Link from 'next/link'
import { ChevronLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import EmployeesView from './EmployeesView'

export const dynamic = 'force-dynamic'

async function loadActiveCycle() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data
  } catch {
    return null
  }
}

export default async function EmployeesPage() {
  const cycle = await loadActiveCycle()

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <Link
          href="/finance/cycle"
          className="inline-flex items-center gap-1.5 text-[12px] tracking-tight text-[#757575] hover:text-[#000] transition-colors mb-3"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={1.8} />
          12주 대시보드
        </Link>
        <div className="flex items-center gap-2.5">
          <Users
            className="w-6 h-6"
            style={{ color: 'var(--nv-primary)' }}
            strokeWidth={1.8}
          />
          <h1 className="text-[24px] font-bold tracking-tight text-[#000]">
            직원별 12주 OKR
          </h1>
        </div>
        <p className="text-[13px] text-[#757575] mt-1.5">
          각 직원의 12주 목표 → 3개 KR → 주간 타겟 → 일일 투두 트리를 토글식으로 관리합니다.
          {cycle && (
            <>
              {' '}
              <span className="font-bold text-[#000]">
                사이클 #{cycle.cycle_number}
              </span>
              {' '}({cycle.start_date} ~ {cycle.end_date})
            </>
          )}
        </p>
      </div>

      {!cycle ? (
        <div
          className="border border-[#e5e5e5] bg-[#fef9c3] p-4 text-[13px]"
          style={{ borderRadius: '2px' }}
        >
          <p className="font-bold text-[#854d0e] mb-1">⚠ 활성 12주 사이클이 없습니다</p>
          <p className="text-[#854d0e]">
            <Link href="/finance/cycle" className="underline">
              12주 대시보드
            </Link>
            {' '}에서 먼저 사이클을 시작해주세요. 사이클 없이는 목표/KR 을 등록할 수 없습니다.
          </p>
        </div>
      ) : (
        <EmployeesView cycleId={cycle.id} cycleStart={cycle.start_date} cycleEnd={cycle.end_date} />
      )}
    </div>
  )
}
