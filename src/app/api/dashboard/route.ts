import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  startOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  format,
  differenceInDays,
} from 'date-fns'

export async function GET() {
  try {
    const now = new Date()
    const todayStart = startOfDay(now)
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const prevMonthStart = startOfMonth(subMonths(now, 1))
    const prevMonthEnd = endOfMonth(subMonths(now, 1))

    // 오늘 매출
    const todaySales = await prisma.transaction.aggregate({
      where: { type: 'SALE', date: { gte: todayStart } },
      _sum: { totalAmount: true },
      _count: true,
    })

    // 이번 달 매출
    const monthSales = await prisma.transaction.aggregate({
      where: { type: 'SALE', date: { gte: monthStart, lte: monthEnd } },
      _sum: { totalAmount: true },
    })

    // 이번 달 비용 (EXPENSE + PURCHASE)
    const monthExpenses = await prisma.transaction.aggregate({
      where: {
        type: { in: ['EXPENSE', 'PURCHASE'] },
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { totalAmount: true },
    })

    // 전월 매출
    const prevMonthSales = await prisma.transaction.aggregate({
      where: { type: 'SALE', date: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { totalAmount: true },
    })

    // 미수금 총액
    const totalReceivable = await prisma.accountsReceivable.aggregate({
      where: { status: { in: ['OUTSTANDING', 'PARTIAL', 'OVERDUE'] } },
      _sum: { remainingAmount: true },
    })

    // 미수금 경과 분석
    const receivables = await prisma.accountsReceivable.findMany({
      where: { status: { in: ['OUTSTANDING', 'PARTIAL', 'OVERDUE'] } },
      include: { client: true },
    })

    const arAging = [
      { period: '30일 이내', amount: 0, count: 0 },
      { period: '30~60일', amount: 0, count: 0 },
      { period: '60~90일', amount: 0, count: 0 },
      { period: '90일 초과', amount: 0, count: 0 },
    ]

    receivables.forEach((ar) => {
      const days = differenceInDays(now, ar.createdAt)
      const bucket = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3
      arAging[bucket].amount += ar.remainingAmount
      arAging[bucket].count += 1
    })

    // 최근 7일 매출 추이
    const dailySales: { label: string; sales: number; expenses: number; profit: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = startOfDay(subDays(now, i))
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)

      const sales = await prisma.transaction.aggregate({
        where: { type: 'SALE', date: { gte: dayStart, lte: dayEnd } },
        _sum: { totalAmount: true },
      })
      const expenses = await prisma.transaction.aggregate({
        where: { type: { in: ['EXPENSE', 'PURCHASE'] }, date: { gte: dayStart, lte: dayEnd } },
        _sum: { totalAmount: true },
      })

      const salesAmt = sales._sum.totalAmount || 0
      const expAmt = expenses._sum.totalAmount || 0

      dailySales.push({
        label: format(dayStart, 'MM/dd'),
        sales: salesAmt,
        expenses: expAmt,
        profit: salesAmt - expAmt,
      })
    }

    // 제품별 매출 TOP 10
    const productSales = await prisma.transactionItem.groupBy({
      by: ['productId'],
      where: {
        transaction: { type: 'SALE', date: { gte: monthStart, lte: monthEnd } },
        productId: { not: null },
      },
      _sum: { amount: true, quantity: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    })

    const productData = await Promise.all(
      productSales.map(async (ps) => {
        const product = await prisma.product.findUnique({ where: { id: ps.productId! } })
        const revenue = ps._sum.amount || 0
        const cost = (product?.purchasePrice || 0) * (ps._sum.quantity || 0)
        const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0
        return {
          name: product?.name || '알 수 없음',
          revenue,
          margin,
          grade: margin >= 30 && revenue >= (monthSales._sum.totalAmount || 1) * 0.1 ? 'A'
            : margin >= 30 ? 'B'
            : revenue >= (monthSales._sum.totalAmount || 1) * 0.1 ? 'C' : 'D',
        }
      })
    )

    // 최근 거래 10건
    const recentTransactions = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
      take: 10,
      include: { client: true, items: { include: { product: true } } },
    })

    const monthSalesAmt = monthSales._sum.totalAmount || 0
    const monthExpAmt = monthExpenses._sum.totalAmount || 0
    const monthProfit = monthSalesAmt - monthExpAmt

    return NextResponse.json({
      kpi: {
        todaySales: todaySales._sum.totalAmount || 0,
        monthSales: monthSalesAmt,
        monthExpenses: monthExpAmt,
        monthProfit,
        monthMarginRate: monthSalesAmt > 0 ? (monthProfit / monthSalesAmt) * 100 : 0,
        totalReceivable: totalReceivable._sum.remainingAmount || 0,
        salesCount: todaySales._count || 0,
        previousMonthSales: prevMonthSales._sum.totalAmount || 0,
      },
      dailySales,
      arAging,
      productData,
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        clientName: t.client?.name || (t.channel === 'B2B' ? '-' : 'B2C 현금'),
        totalAmount: t.totalAmount,
        paymentMethod: t.paymentMethod,
        paymentStatus: t.paymentStatus,
        channel: t.channel,
        description: t.description,
      })),
    })
  } catch (error) {
    console.error('Dashboard API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
