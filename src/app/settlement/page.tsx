/**
 * 일일 결산 페이지 (V2.4 — 일일 운영 통합)
 *
 * 사용자 결정: "일일 운영" 메뉴를 "일일 결산" 안으로 통합.
 * 페이지 구조:
 *   1. DailyOpsBlock — 오늘 매출/지출/현금흐름/거래 등 일일 운영 위젯 (server component)
 *   2. SettlementView — 기존 일일 결산 차트·표 (client component, 기간 선택 + 변동/고정비 + BEP 등)
 *
 * 12주 사이클 관련 위젯은 모두 제거됨 → 전용 페이지 /finance/cycle 에서만.
 */
import DailyOpsBlock from '@/components/v11/diavis/DailyOpsBlock'
import SettlementView from './SettlementView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function SettlementPage() {
  return (
    <div className="space-y-8">
      <DailyOpsBlock />
      <SettlementView />
    </div>
  )
}
