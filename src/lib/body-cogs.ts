/**
 * 본체 매출원가 — 판매 기준 (대표 결정 2026-07-06).
 *
 *   매출원가 = Σ(판매 수량 × TMS 기준단가(USD) × 환율) + 수기 원가(KRW) + 해외운임 + 관세·통관
 *
 * - 재고 왜곡 없음: 매입 시점이 아니라 판매 시점에 원가 인식 (색동 기준단가 방식의 본체판)
 * - TMS 단가표(2025 TMS 시트 H열)로 안 잡히는 품목은 cogs_overrides(수기 원가, KRW)로 보완
 *   · scope='name' 반복 규칙(방염·배송) / scope='line' 특정 거래 1건(커스텀) — 2026-07-13
 *   · effective_from(기본 2026-07-01)부터만 적용 → 1~6월 확정 손익 불변
 * - 원단 매입 인보이스는 재고 취득 — 손익 사슬에서 제외 (참고 수치로만)
 * - 그래도 원가 0인 품목은 unmatchedItems 로 노출 → 자료 페이지 '원가 매칭 점검' 패널에서 채움
 */
import { prisma } from '@/lib/prisma'
import { getFabricPrices, findFabricCost, getUSDtoKRW } from '@/lib/googleSheets'
import { createServiceClient } from '@/lib/supabase/server'
import { EXCLUDE_BALANCE_CORRECTION } from '@/lib/sales-filter'

export interface CogsOverride {
  scope: 'name' | 'line'
  product_name: string
  match_mode: 'exact' | 'contains'
  transaction_id: string | null
  cost_mode: 'per_unit' | 'per_line'
  unit_cost: number
  effective_from: string
  active: boolean
}

export interface UnmatchedLine {
  txId: string
  date: string
  qty: number
  amount: number
}

export interface UnmatchedItem {
  name: string
  qty: number
  amount: number
  txIds: string[]
  lastDate: string
  /** 건별 내역 — 커스텀 품목(커튼제작비 등) 그때그때 원가 입력용 */
  lines: UnmatchedLine[]
}

export interface SoldCogsByDate {
  /** YYYY-MM-DD → { cogs, matchedRev, unmatchedRev } */
  byDate: Map<string, { cogs: number; matchedRev: number; unmatchedRev: number }>
  soldCogs: number
  matchedRev: number
  unmatchedRev: number
  /** 매출액 기준 단가 매칭 커버리지 % */
  coveragePct: number
  usdRate: number
  /** 원가 0으로 남은 품목 (TMS·수기 모두 미매칭) — 점검 패널용 */
  unmatchedItems: UnmatchedItem[]
}

const normOv = (s: string) => s.replace(/[-\s]/g, '').toUpperCase()

/** cogs_overrides 로드 (테이블 없거나 오류면 빈 배열 — 손익 계산 절대 안 깨짐) */
async function loadOverrides(): Promise<CogsOverride[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('cogs_overrides')
      .select('scope, product_name, match_mode, transaction_id, cost_mode, unit_cost, effective_from, active')
      .eq('active', true)
    if (error || !data) return []
    return data as CogsOverride[]
  } catch {
    return []
  }
}

/** 수기 원가 적용 — 매칭되면 KRW 원가 반환, 없으면 null */
function overrideCost(
  name: string,
  txId: string,
  dateStr: string,
  qty: number,
  overrides: CogsOverride[],
): number | null {
  const nUp = name.toUpperCase()
  const nNorm = normOv(name)
  // line(특정 거래) 우선 → name(반복 규칙)
  const ordered = [...overrides].sort((a, b) => (a.scope === 'line' ? -1 : 1) - (b.scope === 'line' ? -1 : 1))
  for (const o of ordered) {
    if (dateStr < o.effective_from) continue
    let hit = false
    if (o.scope === 'line') {
      hit = o.transaction_id === txId && normOv(o.product_name) === nNorm
    } else if (o.match_mode === 'contains') {
      hit = nUp.includes(o.product_name.toUpperCase())
    } else {
      hit = normOv(o.product_name) === nNorm
    }
    if (hit) return o.cost_mode === 'per_line' ? o.unit_cost : Math.round(o.unit_cost * qty)
  }
  return null
}

export async function computeSoldCogsByDate(start: Date, end: Date): Promise<SoldCogsByDate> {
  const [sales, prices, usdRate, overrides] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: 'SALE', date: { gte: start, lte: end }, ...EXCLUDE_BALANCE_CORRECTION },
      select: { id: true, date: true, items: { select: { productName: true, quantity: true, amount: true } } },
    }),
    getFabricPrices().catch(() => []),
    getUSDtoKRW(),
    loadOverrides(),
  ])

  const byDate = new Map<string, { cogs: number; matchedRev: number; unmatchedRev: number }>()
  const costCache = new Map<string, number>() // 품목명 → 단가(USD)
  const unmatchedMap = new Map<string, UnmatchedItem>()
  let soldCogs = 0
  let matchedRev = 0
  let unmatchedRev = 0

  for (const tx of sales) {
    const d = tx.date.toLocaleDateString('sv-SE')
    const slot = byDate.get(d) ?? { cogs: 0, matchedRev: 0, unmatchedRev: 0 }
    for (const it of tx.items) {
      const name = it.productName ?? ''
      // ① TMS 단가표 (USD × 환율 × 수량)
      let usd = costCache.get(name)
      if (usd === undefined) {
        usd = prices.length > 0 ? findFabricCost(name, prices) : 0
        costCache.set(name, usd)
      }
      if (usd > 0) {
        const cost = Math.round(usd * usdRate * it.quantity)
        slot.cogs += cost; slot.matchedRev += it.amount
        soldCogs += cost; matchedRev += it.amount
        continue
      }
      // ② 수기 원가 (KRW) — TMS 미매칭 품목
      const ov = overrideCost(name, tx.id, d, it.quantity, overrides)
      if (ov !== null) {
        slot.cogs += ov; slot.matchedRev += it.amount
        soldCogs += ov; matchedRev += it.amount
        continue
      }
      // ③ 여전히 원가 0 — 점검 대상
      slot.unmatchedRev += it.amount
      unmatchedRev += it.amount
      if (name) {
        const u = unmatchedMap.get(name) ?? { name, qty: 0, amount: 0, txIds: [], lastDate: d, lines: [] }
        u.qty += it.quantity
        u.amount += it.amount
        if (!u.txIds.includes(tx.id)) u.txIds.push(tx.id)
        if (d > u.lastDate) u.lastDate = d
        u.lines.push({ txId: tx.id, date: d, qty: it.quantity, amount: it.amount })
        unmatchedMap.set(name, u)
      }
    }
    byDate.set(d, slot)
  }

  const totalRev = matchedRev + unmatchedRev
  const unmatchedItems = [...unmatchedMap.values()].sort((a, b) => b.amount - a.amount)
  return {
    byDate,
    soldCogs,
    matchedRev,
    unmatchedRev,
    coveragePct: totalRev > 0 ? (matchedRev / totalRev) * 100 : 0,
    usdRate,
    unmatchedItems,
  }
}

/** 매입 거래 분류 — 판매 기준 원가 모델에서의 처리 */
export type PurchaseClass = 'cogs_freight' | 'domestic_ship' | 'inventory' | 'legacy_auto' | 'ledger_dup'

const OVERSEAS_RE = /중국|해외|수입|관세|통관|국제|항공|해상|선박|선적/
const SHIP_RE = /운송|운임|배송|택배|퀵/
const CUSTOMS_RE = /관세|통관|수입세금/

export function classifyPurchase(description: string | null | undefined, itemNames: string[]): PurchaseClass {
  const d = description ?? ''
  if (d.startsWith('원단 매입원가')) return 'legacy_auto' // 구 자동 항목 — 이중계상 방지 제외
  // 수입신고필증 과세표준(CIF) = 원단 상품가액 — 판매 기준 원가(TMS 단가×수량)와 겹치므로 재고 취득으로 제외
  if (d.includes('수입원자재')) return 'inventory'
  const text = `${d} ${itemNames.join(' ')}`
  const isShip = SHIP_RE.test(text)
  const isCustoms = CUSTOMS_RE.test(text)
  if (isShip || isCustoms) {
    if (OVERSEAS_RE.test(text) || isCustoms) {
      // 해외운임·관세: 별도 인보이스(로드썬·글로지텍·관세/통관)가 기준 —
      // 일계표 매입 행('매입 - X')의 동일 성격은 이중계상 방지 위해 제외 (대표 결정 2026-07-06)
      return d.startsWith('매입 - ') ? 'ledger_dup' : 'cogs_freight'
    }
    return 'domestic_ship' // 국내 배송 → 변동비 (일계표가 유일 소스라 유지)
  }
  return 'inventory' // 원단 등 매입 인보이스 — 재고 취득 (손익 사슬 제외)
}
