/**
 * 색동 오프라인 매출 집계 (서버 전용).
 *
 * 경영 계기판(일일 마감)에 업로드된 일계표가 만든 Transaction/TransactionItem 중,
 * 품목명이 색동 쇼핑몰 상품명과 일치하는 것만 골라 오프라인 색동 매출로 집계한다.
 * - 온라인 쇼핑몰 매출과 동일한 형식(오늘/이번주/이번달 + 월별 추이 + 올해 제품별)
 * - 추가로 입금 완료 / 세금계산서 발행 완료 여부, 미입금·미발행 내역 별도 표시
 *
 * 스키마 무변경 읽기 레이어 (v1.0 데이터 보존).
 */
import { prisma } from '@/lib/prisma'
import { getSaekdongProductNames } from '@/lib/saekdong-imweb'
import type { MonthlyPoint, ProductSales } from '@/lib/saekdong-imweb'

export interface OfflineStatusItem {
  date: string // YYYY-MM-DD (KST)
  client: string
  productNames: string[] // 그 거래의 색동 품목명들
  amount: number // 색동 품목 합계 (원금)
  paid: boolean
  issued: boolean
}

export interface SaekdongOfflineSales {
  today: number
  thisWeek: number
  thisMonth: number
  monthly: MonthlyPoint[] // 최근 12개월 색동 오프라인 매출
  products: ProductSales[] // 올해 색동 오프라인 제품별
  productYear: string
  // 입금/발행 현황 (최근 12개월 색동 거래 기준)
  paidAmount: number
  unpaidAmount: number
  issuedAmount: number
  unissuedAmount: number
  unpaid: OfflineStatusItem[] // 미입금 내역
  unissued: OfflineStatusItem[] // 미발행 내역
  orderCount: number
  fetchedAt: string
  error?: string
}

// ── 품목명 매칭 ──
function normName(s: string): string {
  return String(s || '')
    .replace(/\[[^\]]*\]/g, '') // 일계표가 붙인 [규격] 제거
    .toLowerCase()
    .replace(/\s+/g, '')
}

interface CatalogEntry {
  raw: string
  n: string
}

/** 오프라인 품목명이 색동 상품이면 매칭된 대표 상품명, 아니면 null */
function matchSaekdong(itemName: string, catalog: CatalogEntry[]): string | null {
  const ni = normName(itemName)
  if (ni.length < 2) return null
  for (const c of catalog) {
    // catalog 는 정규화 길이 내림차순 → 가장 구체적인 이름 우선
    if (ni === c.n) return c.raw
    if (c.n.length >= 3 && ni.startsWith(c.n)) return c.raw
  }
  return null
}

// ── KST 날짜 ──
function kstYmd(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

/**
 * 색동 오프라인 매출 집계 (기본 최근 12개월).
 */
export async function getSaekdongOfflineSales(
  monthRange = 12,
): Promise<SaekdongOfflineSales> {
  const now = new Date()
  const todayStr = kstYmd(now)
  const thisYear = todayStr.slice(0, 4)
  const monthStart = todayStr.slice(0, 7) + '-01' // 이번 달 1일 (KST)

  // 이번 주 월요일 (KST)
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const dow = kstNow.getDay() // 0=일
  const monday = new Date(kstNow)
  monday.setDate(kstNow.getDate() - (dow === 0 ? 6 : dow - 1))
  const mondayStr = kstYmd(monday)

  // 조회 범위: monthRange 개월 전 1일 ~ 오늘
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (monthRange - 1), 1)
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const empty = (error?: string): SaekdongOfflineSales => ({
    today: 0, thisWeek: 0, thisMonth: 0,
    monthly: [], products: [], productYear: thisYear,
    paidAmount: 0, unpaidAmount: 0, issuedAmount: 0, unissuedAmount: 0,
    unpaid: [], unissued: [],
    orderCount: 0, fetchedAt: new Date().toISOString(), error,
  })

  try {
    const catalogNames = await getSaekdongProductNames()
    const catalog: CatalogEntry[] = catalogNames
      .map((raw) => ({ raw, n: normName(raw) }))
      .filter((c) => c.n.length >= 2)
      .sort((a, b) => b.n.length - a.n.length)

    const txs = await prisma.transaction.findMany({
      where: {
        type: 'SALE',
        date: { gte: rangeStart, lte: rangeEnd },
      },
      include: {
        items: true,
        client: { select: { name: true } },
        taxInvoices: { select: { id: true } },
      },
      orderBy: { date: 'desc' },
    })

    const byMonth = new Map<string, { revenue: number; orders: number }>()
    const prodMap = new Map<string, { revenue: number; qty: number }>()
    let today = 0, thisWeek = 0, thisMonth = 0
    let paidAmount = 0, unpaidAmount = 0, issuedAmount = 0, unissuedAmount = 0
    const unpaid: OfflineStatusItem[] = []
    const unissued: OfflineStatusItem[] = []
    let orderCount = 0

    for (const tx of txs) {
      // 이 거래의 색동 품목만 추림
      let sakAmount = 0
      const sakNames: string[] = []
      const matchedItems: { name: string; amount: number; qty: number }[] = []
      for (const it of tx.items) {
        const matched = matchSaekdong(it.productName, catalog)
        if (!matched) continue
        sakAmount += it.amount
        sakNames.push(matched)
        matchedItems.push({ name: matched, amount: it.amount, qty: it.quantity })
      }
      if (sakAmount === 0 || sakNames.length === 0) continue
      orderCount += 1

      const day = kstYmd(tx.date)
      const month = day.slice(0, 7)

      // 제품별 표는 올해 기준만 누적 (온라인과 동일)
      if (day.slice(0, 4) === thisYear) {
        for (const mi of matchedItems) {
          const cur = prodMap.get(mi.name) ?? { revenue: 0, qty: 0 }
          cur.revenue += mi.amount
          cur.qty += mi.qty
          prodMap.set(mi.name, cur)
        }
      }
      const cur = byMonth.get(month) ?? { revenue: 0, orders: 0 }
      cur.revenue += sakAmount
      cur.orders += 1
      byMonth.set(month, cur)
      if (day === todayStr) today += sakAmount
      if (day >= mondayStr) thisWeek += sakAmount
      if (day >= monthStart) thisMonth += sakAmount

      // 입금/발행 상태
      const paid = tx.paymentStatus === 'PAID'
      const issued =
        tx.taxStatus === 'ISSUED' ||
        tx.taxStatus === 'COMPLETED' ||
        tx.taxInvoices.length > 0
      if (paid) paidAmount += sakAmount
      else unpaidAmount += sakAmount
      if (issued) issuedAmount += sakAmount
      else unissuedAmount += sakAmount

      const statusItem: OfflineStatusItem = {
        date: day,
        client: tx.client?.name ?? '거래처 미상',
        productNames: [...new Set(sakNames)],
        amount: sakAmount,
        paid,
        issued,
      }
      if (!paid) unpaid.push(statusItem)
      if (!issued) unissued.push(statusItem)
    }

    // 최근 monthRange 개월 연속 배열
    const monthly: MonthlyPoint[] = []
    for (let i = monthRange - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = kstYmd(d).slice(0, 7)
      const v = byMonth.get(key) ?? { revenue: 0, orders: 0 }
      monthly.push({ month: key, revenue: v.revenue, orders: v.orders })
    }

    // 올해 제품별만 (제품 표는 올해 기준 — 온라인과 동일)
    const products: ProductSales[] = Array.from(prodMap.entries())
      .map(([prodName, v]) => ({ prodName, revenue: v.revenue, qty: v.qty }))
      .sort((a, b) => b.revenue - a.revenue)

    return {
      today, thisWeek, thisMonth,
      monthly, products, productYear: thisYear,
      paidAmount, unpaidAmount, issuedAmount, unissuedAmount,
      unpaid, unissued,
      orderCount,
      fetchedAt: new Date().toISOString(),
    }
  } catch (e) {
    return empty(e instanceof Error ? e.message : '색동 오프라인 매출 조회 실패')
  }
}
