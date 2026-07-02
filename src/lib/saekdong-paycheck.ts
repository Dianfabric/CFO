/**
 * 색동 쇼핑몰 매출 ↔ 통장 입금 자동 대사 (서버 전용).
 *
 * - 매출: 아임웹 주문 (2026-07-01 시행일 이후)
 * - 입금: 경영 계기판 통장 내역 업로드가 만든 BankTransaction (type=IN)
 * - 매칭: 같은 금액 + 주문시각 -1일 ~ +45일 창. 입금 1건은 주문 1건만 확인(1:1).
 * - 입금 확인된 매출은 자동으로 사라지고, 미확인만 반환.
 *
 * 주의: 네이버페이·카드 정산은 여러 주문이 묶여 수수료 차감 후 입금되면
 * 금액이 달라 미확인으로 남을 수 있음 (한 건씩 정산되면 정상 매칭).
 */
import { prisma } from '@/lib/prisma'
import { getSaekdongOrdersFrom } from '@/lib/saekdong-imweb'
import type { SimpleOrder } from '@/lib/saekdong-imweb'

// 시행일 — 7월부터 (사장님 지정)
const SINCE = '2026-07-01'
// 주문 후 이 기간 안의 입금만 인정
const MATCH_WINDOW_DAYS = 45
// 선입금(무통장 등) 허용 — 주문시각보다 하루 전 입금까지
const PRE_PAY_MS = 24 * 60 * 60 * 1000

export interface UnconfirmedSale {
  orderNo: string
  date: string // YYYY-MM-DD (KST)
  time: number // Unix seconds
  amount: number
  payType: string
}

export interface SaekdongPayCheck {
  since: string
  totalSales: number // 시행일 이후 매출 건수
  confirmedCount: number // 입금 확인된 건수
  unconfirmed: UnconfirmedSale[] // 미확인 (최신순)
  fetchedAt: string
  error?: string
}

export async function getSaekdongPayCheck(): Promise<SaekdongPayCheck> {
  const base = {
    since: SINCE,
    totalSales: 0,
    confirmedCount: 0,
    unconfirmed: [] as UnconfirmedSale[],
    fetchedAt: new Date().toISOString(),
  }
  try {
    // 1) 시행일 이후 아임웹 매출
    const orders = await getSaekdongOrdersFrom(SINCE)
    if (orders.length === 0) return base

    // 2) 통장 입금 (시행일 하루 전부터 — 선입금 허용분)
    const bankFrom = new Date(new Date(SINCE + 'T00:00:00+09:00').getTime() - PRE_PAY_MS)
    const deposits = await prisma.bankTransaction.findMany({
      where: { type: 'IN', txDateTime: { gte: bankFrom } },
      orderBy: { txDateTime: 'asc' },
      select: { id: true, amount: true, txDateTime: true },
    })

    // 3) 1:1 그리디 매칭 — 주문 오래된 순으로, 같은 금액의 미사용 입금 찾기
    const usedDeposit = new Set<string>()
    const unconfirmed: UnconfirmedSale[] = []
    let confirmedCount = 0
    const sorted = [...orders].sort((a, b) => a.time - b.time)
    for (const o of sorted) {
      const orderMs = o.time * 1000
      const hit = deposits.find(
        (d) =>
          !usedDeposit.has(d.id) &&
          d.amount === o.amount &&
          d.txDateTime.getTime() >= orderMs - PRE_PAY_MS &&
          d.txDateTime.getTime() <= orderMs + MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      )
      if (hit) {
        usedDeposit.add(hit.id)
        confirmedCount += 1
      } else {
        unconfirmed.push(toUnconfirmed(o))
      }
    }
    unconfirmed.sort((a, b) => b.time - a.time)

    return {
      ...base,
      totalSales: orders.length,
      confirmedCount,
      unconfirmed,
    }
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : '입금 대사 조회 실패',
    }
  }
}

function toUnconfirmed(o: SimpleOrder): UnconfirmedSale {
  return { orderNo: o.orderNo, date: o.date, time: o.time, amount: o.amount, payType: o.payType }
}
