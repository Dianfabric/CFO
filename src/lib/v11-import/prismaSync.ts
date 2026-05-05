/**
 * Prisma (v1.0 SQLite) 미러 쓰기 (v1.1 import)
 *
 * 일계표 1일치를 받아 v1.0 Prisma 테이블(transactions, transaction_items,
 * accounts_receivable, expenses-via-transaction)에 기록한다.
 *
 * 주의: 현재 Prisma 스키마에 Client 모델이 없으므로 prisma.client.* 호출은 불가.
 * Transaction.clientId (String?) 컬럼에는 거래처명에서 결정론적으로 만든
 * cli_<sha20> 형태 ID를 저장 → 같은 거래처는 항상 같은 ID로 묶인다.
 *
 * AR도 마찬가지로 같은 deterministic ID를 사용.
 */
import { prisma } from '@/lib/prisma'
import type { DaySheet } from './parser'
import { groupSales, groupPurchases, getExpenseRows } from './parser'
import { clientIdFromName } from './clientId'

export interface DayPrismaResult {
  date: string
  ok: boolean
  message?: string
  salesCount: number
  expenseCount: number
  purchaseCount: number
  arCount: number
  error?: string
}

/**
 * 한 날짜의 일계표 데이터를 Prisma에 기록.
 * 같은 날짜가 이미 있으면 (description 'starts with "일계표"' 매칭) 전체 스킵.
 */
export async function syncDayToPrisma(day: DaySheet): Promise<DayPrismaResult> {
  const result: DayPrismaResult = {
    date: day.dateStr,
    ok: false,
    salesCount: 0,
    expenseCount: 0,
    purchaseCount: 0,
    arCount: 0,
  }

  try {
    const dayStart = new Date(day.date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day.date)
    dayEnd.setHours(23, 59, 59, 999)

    const existing = await prisma.transaction.findFirst({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        type: 'SALE',
        description: { startsWith: '일계표' },
      },
    })
    if (existing) {
      result.ok = true
      result.message = '이미 업로드된 날짜 (Prisma, 스킵)'
      return result
    }

    // ── 외출 (SALE) ──
    const saleGroups = groupSales(day.rows)
    for (const [, items] of saleGroups) {
      const clientName = items[0].client
      if (!clientName) continue
      const totalAmount = items.reduce((s, i) => s + i.amount, 0)
      if (totalAmount === 0) continue

      const clientId = clientIdFromName(clientName)
      const taxAmount = items.reduce((s, i) => s + i.vat, 0)

      const tx = await prisma.transaction.create({
        data: {
          date: day.date,
          type: 'SALE',
          clientId,
          description: `일계표 매출 - ${clientName}`,
          totalAmount,
          taxAmount,
          paymentMethod: 'CREDIT',
          paymentStatus: 'UNPAID',
          channel: 'B2B',
          items: {
            create: items.map((i) => ({
              productName: i.productName + (i.spec ? ` [${i.spec}]` : ''),
              quantity: i.qty,
              unitPrice: i.unitPrice,
              amount: i.amount,
              notes: i.memo || null,
            })),
          },
        },
      })
      result.salesCount++

      // 미수금 생성 (전액 외상 가정 - 실제 결제는 추후 AR 페이지에서 처리)
      if (totalAmount > 0) {
        await prisma.accountsReceivable.create({
          data: {
            clientId,
            transactionId: tx.id,
            originalAmount: totalAmount,
            remainingAmount: totalAmount,
            status: 'OUTSTANDING',
          },
        })
        result.arCount++
      }
    }

    // ── 외입 (PURCHASE) ──
    const purchaseGroups = groupPurchases(day.rows)
    for (const [, items] of purchaseGroups) {
      const clientName = items[0].client
      const totalAmount = items.reduce((s, i) => s + Math.abs(i.amount), 0)
      if (totalAmount === 0) continue

      const clientId = clientName ? clientIdFromName(clientName) : null
      const taxAmount = items.reduce((s, i) => s + i.vat, 0)

      await prisma.transaction.create({
        data: {
          date: day.date,
          type: 'PURCHASE',
          clientId,
          description: `매입 - ${clientName || '알 수 없음'}`,
          totalAmount,
          taxAmount,
          paymentMethod: 'CREDIT',
          paymentStatus: 'UNPAID',
          channel: 'B2B',
          items: {
            create: items.map((i) => ({
              productName: i.productName + (i.spec ? ` [${i.spec}]` : ''),
              quantity: i.qty,
              unitPrice: i.unitPrice,
              amount: Math.abs(i.amount),
            })),
          },
        },
      })
      result.purchaseCount++
    }

    // ── 현비 (EXPENSE) ──
    for (const r of getExpenseRows(day.rows)) {
      const amount = Math.abs(r.amount)
      if (amount === 0) continue
      await prisma.transaction.create({
        data: {
          date: day.date,
          type: 'EXPENSE',
          description: r.productName || r.memo || '경비',
          totalAmount: amount,
          taxAmount: r.vat,
          paymentMethod: 'CASH',
          paymentStatus: 'PAID',
          channel: 'B2B',
        },
      })
      result.expenseCount++
    }

    result.ok = true
    return result
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e)
    return result
  }
}
