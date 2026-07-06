/**
 * 본체 매출원가 — 판매 기준 (대표 결정 2026-07-06).
 *
 *   매출원가 = Σ(판매 수량 × TMS 기준단가(USD) × 환율) + 해외운임 + 관세·통관
 *
 * - 재고 왜곡 없음: 매입 시점이 아니라 판매 시점에 원가 인식 (색동 기준단가 방식의 본체판)
 * - 원단 매입 인보이스는 재고 취득 — 손익 사슬에서 제외 (참고 수치로만)
 * - '원단 매입원가' 자동 항목(구 방식)도 이중계상 방지 위해 제외
 * - TMS 미매칭 품목은 원가 0 — 커버리지(%)로 노출해 단가표 보완 유도
 */
import { prisma } from '@/lib/prisma'
import { getFabricPrices, findFabricCost, getUSDtoKRW } from '@/lib/googleSheets'
import { EXCLUDE_BALANCE_CORRECTION } from '@/lib/sales-filter'

export interface SoldCogsByDate {
  /** YYYY-MM-DD → { cogs, matchedRev, unmatchedRev } */
  byDate: Map<string, { cogs: number; matchedRev: number; unmatchedRev: number }>
  soldCogs: number
  matchedRev: number
  unmatchedRev: number
  /** 매출액 기준 단가 매칭 커버리지 % */
  coveragePct: number
  usdRate: number
}

export async function computeSoldCogsByDate(start: Date, end: Date): Promise<SoldCogsByDate> {
  const [sales, prices, usdRate] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: 'SALE', date: { gte: start, lte: end }, ...EXCLUDE_BALANCE_CORRECTION },
      select: { date: true, items: { select: { productName: true, quantity: true, amount: true } } },
    }),
    getFabricPrices().catch(() => []),
    getUSDtoKRW(),
  ])

  const byDate = new Map<string, { cogs: number; matchedRev: number; unmatchedRev: number }>()
  const costCache = new Map<string, number>() // 품목명 → 단가(USD)
  let soldCogs = 0
  let matchedRev = 0
  let unmatchedRev = 0

  for (const tx of sales) {
    const d = tx.date.toLocaleDateString('sv-SE')
    const slot = byDate.get(d) ?? { cogs: 0, matchedRev: 0, unmatchedRev: 0 }
    for (const it of tx.items) {
      const name = it.productName ?? ''
      let usd = costCache.get(name)
      if (usd === undefined) {
        usd = prices.length > 0 ? findFabricCost(name, prices) : 0
        costCache.set(name, usd)
      }
      if (usd > 0) {
        const cost = Math.round(usd * usdRate * it.quantity)
        slot.cogs += cost
        slot.matchedRev += it.amount
        soldCogs += cost
        matchedRev += it.amount
      } else {
        slot.unmatchedRev += it.amount
        unmatchedRev += it.amount
      }
    }
    byDate.set(d, slot)
  }

  const totalRev = matchedRev + unmatchedRev
  return {
    byDate,
    soldCogs,
    matchedRev,
    unmatchedRev,
    coveragePct: totalRev > 0 ? (matchedRev / totalRev) * 100 : 0,
    usdRate,
  }
}

/** 매입 거래 분류 — 판매 기준 원가 모델에서의 처리 */
export type PurchaseClass = 'cogs_freight' | 'domestic_ship' | 'inventory' | 'legacy_auto'

const OVERSEAS_RE = /중국|해외|수입|관세|통관|국제/
const SHIP_RE = /운송|운임|배송|택배|퀵/

export function classifyPurchase(description: string | null | undefined, itemNames: string[]): PurchaseClass {
  const d = description ?? ''
  if (d.startsWith('원단 매입원가')) return 'legacy_auto' // 구 자동 항목 — 이중계상 방지 제외
  const text = `${d} ${itemNames.join(' ')}`
  const isShip = SHIP_RE.test(text)
  const isOverseas = OVERSEAS_RE.test(text)
  if (isShip || /관세|통관|수입세금/.test(text)) {
    // 해외운임·관세·통관 → 매출원가 / 국내 배송 → 변동비
    return isOverseas || /관세|통관|수입세금/.test(text) ? 'cogs_freight' : 'domestic_ship'
  }
  return 'inventory' // 원단 등 매입 인보이스 — 재고 취득 (손익 사슬 제외)
}
