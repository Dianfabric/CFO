/**
 * 일일 결산 페이지 (V2.4 — 일일 운영 통합)
 *
 * 사용자 결정: "일일 운영" 메뉴를 "일일 결산" 안으로 통합.
 * 사용자 결정 (V2.4.1): 일일 마감 업로드를 페이지 최상단에 배치 → 업로드 편의 우선.
 * 페이지 구조 (위→아래):
 *   1. SettlementView — 일일 마감 업로드 + 기간 선택 + 차트·표 (client)
 *   2. DailyOpsBlock — 오늘 매출/지출/현금흐름/거래 등 일일 운영 위젯 (server)
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
      <SettlementView />
      <DailyOpsBlock />
    </div>
  )
}
