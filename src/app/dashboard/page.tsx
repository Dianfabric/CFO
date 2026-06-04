/**
 * 경영 대시보드 = 일일 운영 블록
 *
 * 사용자 결정: 12주 목표 관리는 전용 페이지(/finance/cycle)에서만 표시.
 * 이 페이지는 일일 매출·이익·비용·미수금 등 운영 흐름만 표시.
 */
import DailyOpsBlock from '@/components/v11/diavis/DailyOpsBlock'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <DailyOpsBlock />
    </div>
  )
}
