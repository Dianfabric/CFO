/**
 * 사이클 1장 요약 (Cycle Summary Card)
 *
 * 12주 사이클 종료 시 또는 진행 중에도 한 페이지에 다 보여줌.
 *   - 큰 목표
 *   - 직원별 평균 진행률
 *   - 모든 KR 점수표 (빅/지원, 80%+ / 60%+ / 빨강)
 *   - 누적 매출/마진
 *   - AI 한 줄 요약 + 권장 사항
 *   - 다음 사이클 셋업 버튼 (carryover)
 *
 * Query:
 *   ?cycle_id=X  - 특정 사이클 조회 (없으면 활성)
 */
import Link from 'next/link'
import { ChevronLeft, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CycleSummaryCard from '@/components/v11/cycle/CycleSummaryCard'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ cycle_id?: string }>
}

async function loadCycle(cycleId?: string) {
  const supabase = await createClient()
  let q = supabase.from('cycles').select('*')
  if (cycleId) {
    q = q.eq('id', Number(cycleId))
  } else {
    q = q.eq('status', 'active').order('cycle_number', { ascending: false }).limit(1)
  }
  const { data, error } = await q.maybeSingle()
  if (error) return { cycle: null, error: error.message }
  return { cycle: data, error: null }
}

export default async function CycleSummaryPage({ searchParams }: PageProps) {
  const { cycle_id } = await searchParams
  const { cycle, error } = await loadCycle(cycle_id)

  if (!cycle) {
    return (
      <div className="space-y-4">
        <Link
          href="/finance/cycle"
          className="inline-flex items-center gap-1.5 text-[12px] text-[#666] hover:text-[#000]"
        >
          <ChevronLeft className="w-3 h-3" />
          12주 대시보드
        </Link>
        <div
          className="border border-[#e5e5e5] bg-[#fef9c3] p-4 text-[13px] text-[#854d0e]"
          style={{ borderRadius: '2px' }}
        >
          사이클을 찾을 수 없습니다. {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={cycle.status === 'active' ? '/finance/cycle' : '/finance/cycle/history'}
          className="inline-flex items-center gap-1.5 text-[12px] text-[#666] hover:text-[#000] mb-2"
        >
          <ChevronLeft className="w-3 h-3" />
          {cycle.status === 'active' ? '12주 대시보드' : '사이클 이력'}
        </Link>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" style={{ color: 'var(--nv-primary)' }} />
          <h1 className="text-[20px] font-bold tracking-tight text-[#000]">
            사이클 #{cycle.cycle_number} 1장 요약
          </h1>
          <span className="text-[11px] text-[#999]">
            · {cycle.start_date} ~ {cycle.end_date}
          </span>
          <span
            className="px-1.5 py-0.5 text-[10px] font-bold"
            style={{
              backgroundColor: cycle.status === 'active' ? '#dcfce7' : '#f3f4f6',
              color: cycle.status === 'active' ? '#166534' : '#6b7280',
              borderRadius: '2px',
            }}
          >
            {cycle.status === 'active' ? '진행 중' : '완료'}
          </span>
        </div>
      </div>

      <CycleSummaryCard cycleId={cycle.id} />
    </div>
  )
}
