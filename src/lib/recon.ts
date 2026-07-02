/**
 * 디안 대사 센터 (서버 전용) — 일계표(ERP) 거래를 축으로 교차 확인.
 *
 * 자동(정확) 매칭이 놓친 것들을 퍼지 매칭으로 제안:
 *  ① 매출 거래 ↔ 미매칭 매출 세금계산서 (발행 확인)
 *  ② 통장 미매칭 입금 ↔ 미수 거래처 (입금 확인)
 *
 * 거래처명이 자료마다 달라도(약 80% 유사) 후보로 제안 → 사용자가
 * 승인하면 실제 연결(발행 확인 / 입금 처리), 거절하면 다시 제안 안 함.
 */
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// ── 이름 정규화 + 유사도 (bigram Dice) ──

export function normBizName(s: string): string {
  return String(s || '')
    .replace(/\(주\)|\（주\）|㈜|주식회사|\(유\)|유한회사/g, '')
    .replace(/[\s\-_.·,()（）]/g, '')
    .toLowerCase()
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
  if (s.length === 1) out.add(s)
  return out
}

export function nameSimilarity(a: string, b: string): number {
  const na = normBizName(a)
  const nb = normBizName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.9
  const A = bigrams(na)
  const B = bigrams(nb)
  let inter = 0
  for (const g of A) if (B.has(g)) inter++
  return (2 * inter) / (A.size + B.size)
}

// ── 제안 타입 ──

export interface TaxSuggestion {
  key: string // tax:txId:invoiceId
  score: number
  nameSim: number
  tx: { id: string; date: string; client: string; amount: number }
  invoice: {
    id: string
    issueDate: string
    clientNameRaw: string
    supplyAmount: number
    approvalNumber: string
  }
}

export interface DepositSuggestion {
  key: string // deposit:bankId:clientId
  score: number
  nameSim: number
  bank: { id: string; date: string; amount: number; counterparty: string }
  client: { id: string; name: string; remaining: number }
}

async function fetchRejections(): Promise<Set<string>> {
  try {
    const sb = await createClient()
    const { data, error } = await sb.from('dian_recon_rejections').select('id')
    if (error || !data) return new Set()
    return new Set(data.map((r) => r.id as string))
  } catch {
    return new Set()
  }
}

function kstYmd(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

// ── 제안 계산 ──

export async function getReconSuggestions(): Promise<{
  tax: TaxSuggestion[]
  deposits: DepositSuggestion[]
  rejectionTableMissing?: boolean
}> {
  const rejected = await fetchRejections()
  const now = new Date()
  const d90 = new Date(now.getTime() - 90 * 86400000)
  const d120 = new Date(now.getTime() - 120 * 86400000)
  const d60 = new Date(now.getTime() - 60 * 86400000)

  // ── ① 매출 ↔ 세금계산서 ──
  const [sales, invoices] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        type: 'SALE',
        date: { gte: d90 },
        totalAmount: { gt: 0 },
        taxStatus: null, // 발행 확인 안 된 것만
        taxInvoices: { none: {} },
        // 잔액 보정 제외 (description NULL 은 정상 거래 — SQL NULL 함정 주의)
        OR: [
          { description: null },
          {
            NOT: {
              OR: [
                { description: { startsWith: '이월 매출 보정' } },
                { description: { startsWith: '이월 매출 -' } },
                { description: { startsWith: '선수금 placeholder' } },
              ],
            },
          },
        ],
      },
      include: { client: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 300,
    }),
    prisma.taxInvoice.findMany({
      where: { status: 'UNMATCHED', issueDate: { gte: d120 } },
      orderBy: { issueDate: 'desc' },
      take: 300,
    }),
  ])

  const usedInvoice = new Set<string>()
  const tax: TaxSuggestion[] = []
  for (const t of sales) {
    const clientName = t.client?.name ?? ''
    if (!clientName) continue
    let best: { inv: (typeof invoices)[number]; score: number; nameSim: number } | null = null
    for (const inv of invoices) {
      if (usedInvoice.has(inv.id)) continue
      const key = `tax:${t.id}:${inv.id}`
      if (rejected.has(key)) continue
      const nSim = nameSimilarity(clientName, inv.clientNameRaw)
      if (nSim < 0.45) continue
      // 금액: 공급가끼리 비교 (거래 totalAmount = 부가세 제외 원금)
      const a = t.totalAmount
      const b = inv.supplyAmount
      const amtRatio = Math.min(a, b) / Math.max(a, b || 1)
      if (amtRatio < 0.85) continue
      // 날짜: 30일 이내 스케일
      const dayDiff = Math.abs(t.date.getTime() - inv.issueDate.getTime()) / 86400000
      if (dayDiff > 30) continue
      const dateScore = 1 - dayDiff / 30
      const score = 0.55 * nSim + 0.3 * amtRatio + 0.15 * dateScore
      if (score < 0.75) continue
      if (!best || score > best.score) best = { inv, score, nameSim: nSim }
    }
    if (best) {
      usedInvoice.add(best.inv.id)
      tax.push({
        key: `tax:${t.id}:${best.inv.id}`,
        score: best.score,
        nameSim: best.nameSim,
        tx: { id: t.id, date: kstYmd(t.date), client: clientName, amount: t.totalAmount },
        invoice: {
          id: best.inv.id,
          issueDate: kstYmd(best.inv.issueDate),
          clientNameRaw: best.inv.clientNameRaw,
          supplyAmount: best.inv.supplyAmount,
          approvalNumber: best.inv.approvalNumber,
        },
      })
    }
  }
  tax.sort((a, b) => b.score - a.score)

  // ── ② 통장 입금 ↔ 미수 거래처 ──
  const [bankIns, openArs] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { type: 'IN', status: 'UNMATCHED', txDateTime: { gte: d60 } },
      orderBy: { txDateTime: 'desc' },
      take: 200,
    }),
    prisma.accountsReceivable.findMany({
      where: { remainingAmount: { gt: 0 } },
      include: { client: { select: { id: true, name: true } } },
    }),
  ])
  // 거래처별 남은 미수 합계
  const clientRemain = new Map<string, { id: string; name: string; remaining: number }>()
  for (const ar of openArs) {
    const cur = clientRemain.get(ar.clientId) ?? {
      id: ar.clientId,
      name: ar.client?.name ?? '',
      remaining: 0,
    }
    cur.remaining += ar.remainingAmount
    clientRemain.set(ar.clientId, cur)
  }

  const deposits: DepositSuggestion[] = []
  for (const b of bankIns) {
    let best: { c: { id: string; name: string; remaining: number }; score: number; nameSim: number } | null = null
    for (const c of clientRemain.values()) {
      if (!c.name) continue
      const key = `deposit:${b.id}:${c.id}`
      if (rejected.has(key)) continue
      const nSim = Math.max(
        nameSimilarity(c.name, b.rawCounterparty),
        nameSimilarity(c.name, b.rawDescription),
      )
      if (nSim < 0.6) continue
      // 금액 적합도: 남은 미수와 같으면 1, 이하면 0.7, 초과면 0.3
      const amtFit = b.amount === c.remaining ? 1 : b.amount <= c.remaining ? 0.7 : 0.3
      const score = 0.7 * nSim + 0.3 * amtFit
      if (score < 0.72) continue
      if (!best || score > best.score) best = { c, score, nameSim: nSim }
    }
    if (best) {
      deposits.push({
        key: `deposit:${b.id}:${best.c.id}`,
        score: best.score,
        nameSim: best.nameSim,
        bank: {
          id: b.id,
          date: kstYmd(b.txDateTime),
          amount: b.amount,
          counterparty: b.rawCounterparty || b.rawDescription,
        },
        client: best.c,
      })
    }
  }
  deposits.sort((a, b) => b.score - a.score)

  return { tax: tax.slice(0, 20), deposits: deposits.slice(0, 20) }
}

// ── 승인 적용 ──

/** 세금계산서 연결 승인 — 계산서 MATCHED + 거래 발행 확인 */
export async function confirmTaxLink(txId: string, invoiceId: string): Promise<void> {
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id: txId } })
  await prisma.taxInvoice.update({
    where: { id: invoiceId },
    data: { matchedTransactionId: txId, status: 'MATCHED', clientId: tx.clientId ?? undefined },
  })
  await prisma.transaction.update({ where: { id: txId }, data: { taxStatus: 'ISSUED' } })
}

/** 입금 연결 승인 — ArPayment 생성 + AR 재계산 + 통장 MATCHED */
export async function confirmDepositLink(bankId: string, clientId: string): Promise<void> {
  const bank = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: bankId } })
  // 오래된 미수부터 적용할 AR 선택 (없으면 아무 AR, 그것도 없으면 생성)
  let ar = await prisma.accountsReceivable.findFirst({
    where: { clientId, remainingAmount: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
  })
  if (!ar) {
    ar = await prisma.accountsReceivable.findFirst({ where: { clientId } })
  }
  if (!ar) {
    ar = await prisma.accountsReceivable.create({
      data: {
        clientId,
        transactionId: (
          await prisma.transaction.findFirstOrThrow({ where: { clientId }, orderBy: { date: 'desc' } })
        ).id,
        originalAmount: 0,
        remainingAmount: 0,
        status: 'PAID',
      },
    })
  }
  const pay = await prisma.arPayment.create({
    data: {
      receivableId: ar.id,
      amount: bank.amount,
      paymentDate: bank.txDateTime,
      paymentMethod: 'TRANSFER',
      notes: `[대사승인] 통장 ${bank.rawCounterparty}`,
    },
  })
  await prisma.bankTransaction.update({
    where: { id: bankId },
    data: { status: 'MATCHED', clientId, matchedPaymentId: pay.id },
  })
  // 거래처 AR 잔액 재계산
  const ars = await prisma.accountsReceivable.findMany({
    where: { clientId },
    include: { payments: { select: { amount: true } } },
  })
  for (const a of ars) {
    const paid = a.payments.reduce((s, p) => s + p.amount, 0)
    const rem = Math.max(0, a.originalAmount - paid)
    const status = rem === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OUTSTANDING'
    if (rem !== a.remainingAmount || status !== a.status) {
      await prisma.accountsReceivable.update({
        where: { id: a.id },
        data: { remainingAmount: rem, status },
      })
    }
  }
}

/** 거절 기억 — 같은 조합 재제안 방지 */
export async function rejectPair(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = await createClient()
    const { error } = await sb.from('dian_recon_rejections').upsert({ id: key })
    if (error) {
      return {
        ok: false,
        error: /find the table|does not exist/i.test(error.message)
          ? '거절 기억 테이블이 없습니다 — supabase/migrations/2026-07-02_dian_recon_rejections.sql 을 실행해 주세요.'
          : error.message,
      }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
