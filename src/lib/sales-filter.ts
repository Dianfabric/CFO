// 매출 통계에서 잔액 보정 SALE 을 제외하기 위한 공통 필터
// "이월 매출 보정 - {거래처명}" 또는 "이월 매출 - {거래처명}" 으로 시작하는 거래는
// DB 잔액을 엑셀 미수금에 맞추기 위한 인위적 보정 — 결산/대시보드/분석에서 빠져야 함.
export const EXCLUDE_BALANCE_CORRECTION = {
  NOT: {
    OR: [
      { description: { startsWith: '이월 매출 보정' } },
      { description: { startsWith: '이월 매출 -' } },
    ],
  },
}
