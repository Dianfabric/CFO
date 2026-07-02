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

// ── PG 묶음 정산 매칭 설정 ──
// 통장 상대명/내용에서 PG 정산 입금 인식
const PG_PATTERN = /네이버파이낸셜|네이버페이|나이스페이|이니시스|토스페이먼츠|카카오페이|페이먼츠/
// PG 를 통해 결제되는 수단 (묶음 정산 대상)
const PG_PAY_TYPES = new Set(['npay', 'card', 'kakaopay', 'naverpay', 'phone'])
// 정산 수수료 최대 허용 (입금액 ≥ 주문합계 × (1-5%))
const PG_FEE_MAX = 0.05
// PG 정산은 주문 후 이 기간 안에 들어온다고 가정
const PG_SETTLE_WINDOW_DAYS = 20

export interface UnconfirmedSale {
  orderNo: string
  date: string // YYYY-MM-DD (KST)
  time: number // Unix seconds
  amount: number
  payType: string
  imwebPaid: boolean // 아임웹 결제(입금) 확인 여부
}

export interface PgDeposit {
  date: string // YYYY-MM-DD (KST)
  name: string // PG 상대명 (예: 네이버파이낸셜)
  amount: number
}

export interface SaekdongPayCheck {
  since: string
  totalSales: number // 시행일 이후 매출 건수
  imwebPaidCount: number // 아임웹 결제 확인 건수
  confirmedCount: number // 통장 입금 확인된 건수 (정확 일치)
  pgConfirmedCount: number // PG 묶음 정산으로 확인된 건수 (수수료 차감 허용)
  pgDeposits: PgDeposit[] // 최근 PG 정산 입금 (최신순, 최대 5건)
  unconfirmed: UnconfirmedSale[] // 통장 미확인 (최신순)
  fetchedAt: string
  error?: string
}

export async function getSaekdongPayCheck(): Promise<SaekdongPayCheck> {
  const base = {
    since: SINCE,
    totalSales: 0,
    imwebPaidCount: 0,
    confirmedCount: 0,
    pgConfirmedCount: 0,
    pgDeposits: [] as PgDeposit[],
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
      select: {
        id: true,
        amount: true,
        txDateTime: true,
        rawCounterparty: true,
        rawDescription: true,
      },
    })

    // 3) 1단계: 1:1 그리디 매칭 — 주문 오래된 순으로, 같은 금액의 미사용 입금 찾기
    const usedDeposit = new Set<string>()
    let remaining: SimpleOrder[] = []
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
        remaining.push(o)
      }
    }

    // 4) 2단계: PG 묶음 정산 매칭 — PG 입금(네이버파이낸셜 등) 1건이
    //    여러 주문의 합계(수수료 차감)를 커버하는 경우
    const pgDepositRows = deposits.filter(
      (d) => PG_PATTERN.test(d.rawCounterparty) || PG_PATTERN.test(d.rawDescription),
    )
    let pgConfirmedCount = 0
    for (const dep of pgDepositRows) {
      if (usedDeposit.has(dep.id)) continue
      const depMs = dep.txDateTime.getTime()
      // 후보: 정산창 안의 PG 결제(아임웹 결제완료) 주문, 오래된 순 최대 16건 (부분집합 탐색 상한)
      const candidates = remaining
        .filter(
          (o) =>
            PG_PAY_TYPES.has(o.payType) &&
            o.payTime > 0 &&
            o.time * 1000 <= depMs &&
            o.time * 1000 >= depMs - PG_SETTLE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
        )
        .sort((a, b) => a.time - b.time)
        .slice(0, 16)
      if (candidates.length === 0) continue

      // 부분집합 탐색: 입금액 D 가 [합계×(1-수수료최대), 합계] 안이면 매칭.
      // D 와 가장 가까운(수수료 최소) 조합 선택.
      let best: number[] | null = null
      let bestGap = Infinity
      const n = candidates.length
      for (let mask = 1; mask < 1 << n; mask++) {
        let sum = 0
        for (let i = 0; i < n; i++) if (mask & (1 << i)) sum += candidates[i].amount
        if (dep.amount <= sum && dep.amount >= Math.floor(sum * (1 - PG_FEE_MAX))) {
          const gap = sum - dep.amount
          if (gap < bestGap) {
            bestGap = gap
            best = []
            for (let i = 0; i < n; i++) if (mask & (1 << i)) best.push(i)
          }
        }
      }
      if (best) {
        usedDeposit.add(dep.id)
        const matchedNos = new Set(best.map((i) => candidates[i].orderNo))
        pgConfirmedCount += matchedNos.size
        remaining = remaining.filter((o) => !matchedNos.has(o.orderNo))
      }
    }

    // 최근 PG 정산 입금 (참고 표시용, 최신순 5건)
    const pgDeposits: PgDeposit[] = pgDepositRows
      .slice(-5)
      .reverse()
      .map((d) => ({
        date: d.txDateTime.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
        name: (d.rawCounterparty || d.rawDescription).trim(),
        amount: d.amount,
      }))

    const unconfirmed = remaining.map(toUnconfirmed).sort((a, b) => b.time - a.time)

    return {
      ...base,
      totalSales: orders.length,
      imwebPaidCount: orders.filter((o) => o.payTime > 0).length,
      confirmedCount,
      pgConfirmedCount,
      pgDeposits,
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
  return {
    orderNo: o.orderNo,
    date: o.date,
    time: o.time,
    amount: o.amount,
    payType: o.payType,
    imwebPaid: o.payTime > 0,
  }
}
