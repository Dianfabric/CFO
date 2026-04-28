// ============================================
// 핵심 비즈니스 계산 로직
// 참고: 헤르만 지몬 '이익이란 무엇인가' + '진짜 매출을 부르는 회계감각'
// ============================================

// ----- 수익성 분석 (헤르만 지몬 기반) -----

/**
 * 이익 드라이버 분석
 * 헤르만 지몬: 이익 = 매출 - 비용 = (가격 × 판매량) - (고정비 + 변동비 × 판매량)
 */
export interface ProfitDrivers {
  price: number          // 평균 판매가
  volume: number         // 판매량
  revenue: number        // 매출액
  variableCost: number   // 변동비 (원자재, 물류 등)
  fixedCost: number      // 고정비 (임대료, 인건비 등)
  totalCost: number      // 총비용
  profit: number         // 이익
  marginRate: number     // 이익률 (%)
  contributionMargin: number // 공헌이익 (가격 - 단위변동비)
  breakEvenVolume: number    // 손익분기 판매량
  breakEvenRevenue: number   // 손익분기 매출액
}

export function analyzeProfitDrivers(
  avgPrice: number,
  volume: number,
  variableCostPerUnit: number,
  fixedCost: number
): ProfitDrivers {
  const revenue = avgPrice * volume
  const variableCost = variableCostPerUnit * volume
  const totalCost = fixedCost + variableCost
  const profit = revenue - totalCost
  const marginRate = revenue > 0 ? (profit / revenue) * 100 : 0
  const contributionMargin = avgPrice - variableCostPerUnit
  const breakEvenVolume = contributionMargin > 0 ? Math.ceil(fixedCost / contributionMargin) : Infinity
  const breakEvenRevenue = breakEvenVolume * avgPrice

  return {
    price: avgPrice,
    volume,
    revenue,
    variableCost,
    fixedCost,
    totalCost,
    profit,
    marginRate,
    contributionMargin,
    breakEvenVolume,
    breakEvenRevenue,
  }
}

/**
 * 가격 변동 시뮬레이션 (헤르만 지몬 핵심)
 * "1% 가격 인상이 수익에 미치는 영향은 1% 매출 증가보다 크다"
 */
export interface SimulationResult {
  scenario: string
  revenue: number
  cost: number
  profit: number
  profitChange: number      // 이익 변동액
  profitChangeRate: number  // 이익 변동률 (%)
  marginRate: number
}

export function simulatePriceChange(
  currentPrice: number,
  currentVolume: number,
  variableCostPerUnit: number,
  fixedCost: number,
  priceChangePercent: number,
  volumeChangePercent: number = 0  // 가격 변경에 따른 수요 변동
): SimulationResult {
  const base = analyzeProfitDrivers(currentPrice, currentVolume, variableCostPerUnit, fixedCost)

  const newPrice = currentPrice * (1 + priceChangePercent / 100)
  const newVolume = currentVolume * (1 + volumeChangePercent / 100)
  const sim = analyzeProfitDrivers(newPrice, newVolume, variableCostPerUnit, fixedCost)

  return {
    scenario: `가격 ${priceChangePercent > 0 ? '+' : ''}${priceChangePercent}%, 판매량 ${volumeChangePercent > 0 ? '+' : ''}${volumeChangePercent}%`,
    revenue: sim.revenue,
    cost: sim.totalCost,
    profit: sim.profit,
    profitChange: sim.profit - base.profit,
    profitChangeRate: base.profit !== 0 ? ((sim.profit - base.profit) / Math.abs(base.profit)) * 100 : 0,
    marginRate: sim.marginRate,
  }
}

// ----- 회계 감각 기반 분석 ('진짜 매출을 부르는 회계감각') -----

/**
 * 제품별 수익성 등급 분류
 * A: 고마진 고매출 (효자 상품)
 * B: 고마진 저매출 (육성 상품)
 * C: 저마진 고매출 (관리 상품)
 * D: 저마진 저매출 (정리 검토)
 */
export type ProductGrade = 'A' | 'B' | 'C' | 'D'

export interface ProductAnalysis {
  productId: string
  productName: string
  category: string
  totalRevenue: number
  totalCost: number
  totalProfit: number
  marginRate: number
  salesVolume: number
  avgPrice: number
  grade: ProductGrade
  revenueShare: number  // 매출 비중 (%)
  profitShare: number   // 이익 비중 (%)
}

export function gradeProduct(
  marginRate: number,
  revenueShare: number,
  avgMarginRate: number,
  avgRevenueShare: number
): ProductGrade {
  const highMargin = marginRate >= avgMarginRate
  const highRevenue = revenueShare >= avgRevenueShare

  if (highMargin && highRevenue) return 'A'   // 효자
  if (highMargin && !highRevenue) return 'B'  // 육성
  if (!highMargin && highRevenue) return 'C'  // 관리
  return 'D'                                   // 정리검토
}

/**
 * 현금흐름 건전성 분석
 * 미수금 비중이 높으면 '흑자도산' 위험
 */
export interface CashFlowHealth {
  totalRevenue: number
  totalCollected: number     // 실제 회수액
  totalReceivable: number    // 미수금 총액
  collectionRate: number     // 회수율 (%)
  avgCollectionDays: number  // 평균 회수 기간 (일)
  overdueAmount: number      // 연체 미수금
  overdueRate: number        // 연체율 (%)
  healthGrade: 'GOOD' | 'WARNING' | 'DANGER'
}

export function assessCashFlowHealth(
  totalRevenue: number,
  totalCollected: number,
  totalReceivable: number,
  overdueAmount: number,
  avgCollectionDays: number
): CashFlowHealth {
  const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 100
  const overdueRate = totalReceivable > 0 ? (overdueAmount / totalReceivable) * 100 : 0

  let healthGrade: 'GOOD' | 'WARNING' | 'DANGER' = 'GOOD'
  if (overdueRate > 30 || collectionRate < 70 || avgCollectionDays > 60) {
    healthGrade = 'DANGER'
  } else if (overdueRate > 15 || collectionRate < 85 || avgCollectionDays > 45) {
    healthGrade = 'WARNING'
  }

  return {
    totalRevenue,
    totalCollected,
    totalReceivable,
    collectionRate,
    avgCollectionDays,
    overdueAmount,
    overdueRate,
    healthGrade,
  }
}

/**
 * 결산 집계 (일/주/월/분기/년)
 */
export interface SettlementSummary {
  period: string           // 기간 라벨
  periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  totalSales: number       // 총 매출
  totalExpenses: number    // 총 비용
  totalPurchases: number   // 총 매입
  grossProfit: number      // 매출총이익 (매출 - 매입)
  netProfit: number        // 순이익 (매출 - 매입 - 비용)
  salesCount: number       // 거래 건수
  avgTransactionAmount: number  // 평균 거래액
  topProducts: { name: string; amount: number; count: number }[]
  topClients: { name: string; amount: number; count: number }[]
  channelBreakdown: { channel: string; amount: number; count: number }[]
  arCollected: number      // 미수금 회수액
  newAR: number            // 신규 미수금
  previousPeriodSales: number  // 전기 매출 (비교용)
  growthRate: number       // 성장률 (%)
}

/**
 * 전략 인사이트 생성을 위한 데이터 컨텍스트
 * Claude API에 전달할 재무 데이터 요약
 */
export interface FinancialContext {
  companyProfile: {
    industry: string
    products: string[]
    channels: string[]
  }
  currentPeriod: SettlementSummary
  previousPeriod?: SettlementSummary
  productAnalysis: ProductAnalysis[]
  cashFlowHealth: CashFlowHealth
  profitDrivers: ProfitDrivers
  topReceivables: { clientName: string; amount: number; daysOverdue: number }[]
}
