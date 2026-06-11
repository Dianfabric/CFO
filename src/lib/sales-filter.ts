// 매출 통계에서 잔액 보정 SALE 을 제외하기 위한 공통 필터
// - "이월 매출 보정 / 이월 매출 -": DB 잔액을 엑셀에 맞추기 위한 인위적 보정
// - "선수금 placeholder": AR이 없는 거래처에 입금을 등록하기 위한 0원 매출
// 모두 결산/대시보드/분석에서 빠져야 함.
export const EXCLUDE_BALANCE_CORRECTION = {
  NOT: {
    OR: [
      { description: { startsWith: '이월 매출 보정' } },
      { description: { startsWith: '이월 매출 -' } },
      { description: { startsWith: '선수금 placeholder' } },
    ],
  },
}
