import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, subDays, startOfMonth, format } from 'date-fns'
import { getFabricPrices, findFabric } from '@/lib/googleSheets'

function getBusinessDaysInMonth(date: Date): number {
  const year = date.getFullYear()
  const month = date.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

function getBusinessDaysInRange(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endNorm = new Date(end)
  endNorm.setHours(23, 59, 59, 999)
  while (cur <= endNorm) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')

    let rangeStart: Date, rangeEnd: Date

    if (startDateStr && endDateStr) {
      rangeStart = startOfDay(new Date(startDateStr + 'T12:00:00'))
      rangeEnd = endOfDay(new Date(endDateStr + 'T12:00:00'))
    } else {
      const targetDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
      rangeStart = startOfDay(targetDate)
      rangeEnd = endOfDay(targetDate)
    }

    const refDate = rangeStart
    const isSingleDay = format(rangeStart, 'yyyy-MM-dd') === format(rangeEnd, 'yyyy-MM-dd')

    const businessDaysInMonth = getBusinessDaysInMonth(refDate)
    const businessDaysInRange = Math.max(1, getBusinessDaysInRange(rangeStart, rangeEnd))
    const businessDayRatio = businessDaysInMonth > 0 ? businessDaysInRange / businessDaysInMonth : 1

    const periodMs = rangeEnd.getTime() - rangeStart.getTime()
    const prevPeriodEnd = new Date(rangeStart.getTime() - 1)
    const prevPeriodStart = startOfDay(new Date(prevPeriodEnd.getTime() - periodMs))
    const monthStart = startOfMonth(refDate)
    const lastWeekSameDay = subDays(rangeStart, 7)

    // === 모든 독립 쿼리를 한번에 병렬 실행 ===
    const [
      periodTransactions,
      fabricPrices,
      shippingCategory,
      recurringCosts,
      newReceivables,
      prevSalesAgg,
      prevTx,
      monthSalesRaw,
      lwAgg,
    ] = await Promise.all([
      prisma.transaction.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd } },
        include: { items: { include: { product: true } }, client: { select: { name: true } } },
      }),
      getFabricPrices().catch(() => [] as Awaited<ReturnType<typeof getFabricPrices>>),
      prisma.costCategory.findFirst({ where: { name: { contains: '해외' } } }),
      prisma.recurringCost.findMany({ include: { costCategory: true } }),
      prisma.accountsReceivable.findMany({
        where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
        include: { client: { select: { name: true } } },
      }),
      prisma.transaction.aggregate({
        where: { type: 'SALE', date: { gte: prevPeriodStart, lte: prevPeriodEnd } },
        _sum: { totalAmount: true }, _count: true,
      }),
      prisma.transaction.findMany({
        where: { type: 'SALE', date: { gte: prevPeriodStart, lte: prevPeriodEnd } },
        include: { items: { include: { product: true } } },
      }),
      prisma.transaction.findMany({
        where: { type: 'SALE', date: { gte: monthStart, lte: rangeEnd } },
        include: { items: { include: { product: true } } },
      }),
      isSingleDay
        ? prisma.transaction.aggregate({
            where: { type: 'SALE', date: { gte: startOfDay(lastWeekSameDay), lte: endOfDay(lastWeekSameDay) } },
            _sum: { totalAmount: true }, _count: true,
          })
        : Promise.resolve(null),
    ])

    const sales = periodTransactions.filter(t => t.type === 'SALE')
    const expenses = periodTransactions.filter(t => t.type === 'EXPENSE')
    const purchases = periodTransactions.filter(t => t.type === 'PURCHASE')

    const totalSales = sales.reduce((s, t) => s + t.totalAmount, 0)
    const totalExpenses = expenses.reduce((s, t) => s + t.totalAmount, 0)
    const totalPurchases = purchases.reduce((s, t) => s + t.totalAmount, 0)

    // === 공헌이익 계산 ===
    const costByProduct: Record<string, number> = {}
    purchases.forEach(tx => {
      if (!(tx.description ?? '').startsWith('원단 매입원가')) return
      tx.items.forEach(item => {
        const key = item.productName || ''
        if (key) costByProduct[key] = (costByProduct[key] ?? 0) + item.amount
      })
    })

    let totalVariableCost = 0
    const productContributions: Record<string, {
      productId: string; productName: string; category: string
      revenue: number; variableCost: number; quantity: number; unit: string; brand: string
    }> = {}

    sales.forEach(tx => {
      tx.items.forEach(item => {
        const key = item.productId || item.productName || 'etc'
        if (!productContributions[key]) {
          const fabricInfo = findFabric(item.productName, fabricPrices)
          productContributions[key] = {
            productId: key,
            productName: item.product?.name || item.productName || '기타',
            category: item.product?.category || '',
            revenue: 0, variableCost: 0, quantity: 0,
            unit: item.product?.unit || 'YARD',
            brand: fabricInfo?.brand ?? '',
          }
        }
        productContributions[key].revenue += item.amount
        productContributions[key].quantity += item.quantity
      })
    })

    Object.values(productContributions).forEach(p => {
      const cost = costByProduct[p.productName] ?? 0
      p.variableCost = cost
      totalVariableCost += cost
    })

    const totalContributionMargin = totalSales - totalVariableCost

    const fabricCostDetails = purchases
      .filter(tx => (tx.description ?? '').startsWith('원단 매입원가'))
      .map(tx => ({ description: tx.description || '원단 매입원가', amount: tx.totalAmount, clientName: tx.client?.name || null }))
    const expenseDetails = expenses.map(tx => ({
      description: tx.description || tx.items[0]?.productName || '비용',
      amount: tx.totalAmount, clientName: tx.client?.name || null,
    }))

    // === 해외운송비 — 크로스먼스 정확 배분 ===
    let periodShippingCost = 0
    let monthlyShippingCost = 0

    if (shippingCategory) {
      const months: string[] = []
      const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
      const endMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)
      while (cur <= endMonth) {
        months.push(format(cur, 'yyyy-MM'))
        cur.setMonth(cur.getMonth() + 1)
      }

      // 월별 MonthlyCost 병렬 조회
      const records = await Promise.all(
        months.map(ym =>
          prisma.monthlyCost.findUnique({
            where: { costCategoryId_yearMonth: { costCategoryId: shippingCategory.id, yearMonth: ym } },
          }).then(r => ({ ym, record: r }))
        )
      )

      for (const { ym, record } of records) {
        if (!record || record.amount === 0) continue
        const [y, m] = ym.split('-').map(Number)
        const monthStart2 = new Date(y, m - 1, 1)
        const monthEnd = new Date(y, m, 0, 23, 59, 59)
        const overlapStart = rangeStart > monthStart2 ? rangeStart : monthStart2
        const overlapEnd = rangeEnd < monthEnd ? rangeEnd : monthEnd
        const ratio = getBusinessDaysInMonth(monthStart2) > 0
          ? getBusinessDaysInRange(overlapStart, overlapEnd) / getBusinessDaysInMonth(monthStart2) : 0
        periodShippingCost += Math.round(record.amount * ratio)
        if (ym === format(rangeStart, 'yyyy-MM')) monthlyShippingCost = record.amount
      }
    }

    const productCM = Object.values(productContributions)
      .map(p => {
        const shippingAllocation = totalSales > 0 ? Math.round((p.revenue / totalSales) * periodShippingCost) : 0
        const totalVariableCostWithShipping = p.variableCost + shippingAllocation
        return {
          ...p,
          shippingAllocation,
          contributionMargin: p.revenue - totalVariableCostWithShipping,
          contributionMarginRate: p.revenue > 0 ? ((p.revenue - totalVariableCostWithShipping) / p.revenue) * 100 : 0,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)

    // === 고정비 ===
    const monthlyFixedCost = recurringCosts.reduce((s, c) => {
      if (c.frequency === 'MONTHLY') return s + c.amount
      if (c.frequency === 'QUARTERLY') return s + Math.round(c.amount / 3)
      if (c.frequency === 'YEARLY') return s + Math.round(c.amount / 12)
      return s
    }, 0)
    const periodFixedCost = Math.round(monthlyFixedCost * businessDayRatio)

    const adjustedContributionMargin = totalContributionMargin - periodShippingCost
    const adjustedContributionMarginRate = totalSales > 0 ? (adjustedContributionMargin / totalSales) * 100 : 0
    const adjustedOperatingProfit = adjustedContributionMargin - periodFixedCost
    const adjustedBEPRate = periodFixedCost > 0 ? (adjustedContributionMargin / periodFixedCost) * 100 : 0

    // === 월간 누적 BEP ===
    let monthCumulativeCM = 0
    monthSalesRaw.forEach(tx => {
      tx.items.forEach(item => {
        const cost = (item.product?.purchasePrice || 0) * item.quantity
        monthCumulativeCM += (item.amount - cost)
      })
    })
    const monthlyBEPRate = monthlyFixedCost > 0 ? (monthCumulativeCM / monthlyFixedCost) * 100 : 0

    // === 현금흐름 ===
    const cashIn = sales.filter(t => t.paymentStatus === 'PAID').reduce((s, t) => s + t.totalAmount, 0)
    const cashOut = [...expenses, ...purchases].filter(t => t.paymentStatus === 'PAID').reduce((s, t) => s + t.totalAmount, 0)
    const netCashFlow = cashIn - cashOut

    // === 미수금 ===
    const newARTotal = newReceivables.reduce((s, ar) => s + ar.originalAmount, 0)

    // === 전 기간 비교 ===
    let prevCM = 0
    prevTx.forEach(tx => {
      tx.items.forEach(item => {
        prevCM += item.amount - ((item.product?.purchasePrice || 0) * item.quantity)
      })
    })

    const lwSalesTotal = lwAgg?._sum.totalAmount ?? 0
    const lwSalesCount = lwAgg?._count ?? 0

    // === 고정비 상세 ===
    const fixedCostBreakdown = recurringCosts.map(c => {
      const monthlyAmt = c.frequency === 'MONTHLY' ? c.amount : c.frequency === 'QUARTERLY' ? Math.round(c.amount / 3) : Math.round(c.amount / 12)
      return {
        category: c.costCategory.name,
        type: c.costCategory.type,
        description: c.description,
        monthlyAmount: monthlyAmt,
        dailyAmount: Math.round(monthlyAmt * businessDayRatio),
      }
    })

    const dateLabel = isSingleDay
      ? format(rangeStart, 'yyyy년 MM월 dd일')
      : `${format(rangeStart, 'MM월 dd일')} ~ ${format(rangeEnd, 'MM월 dd일')}`

    return NextResponse.json({
      date: format(rangeStart, 'yyyy-MM-dd'),
      dateLabel,
      periodDays: businessDaysInRange,
      isSingleDay,

      totalSales, totalExpenses, totalPurchases,
      salesCount: sales.length, expenseCount: expenses.length,

      totalVariableCost,
      totalContributionMargin: adjustedContributionMargin,
      contributionMarginRate: adjustedContributionMarginRate,

      monthlyShippingCost,
      dailyShippingCost: periodShippingCost,

      variableCostBreakdown: {
        fabricCost: { label: '원단 매입원가', amount: totalVariableCost, details: fabricCostDetails },
        expenses: { label: '비용 (당일 지출)', amount: totalExpenses, details: expenseDetails },
      },

      productCM,

      monthlyFixedCost,
      dailyFixedCost: periodFixedCost,
      dailyOperatingProfit: adjustedOperatingProfit,
      dailyBEPRate: adjustedBEPRate,
      monthCumulativeCM,
      monthlyBEPRate,
      fixedCostBreakdown,

      cashIn, cashOut, netCashFlow,

      newReceivables: newReceivables.map(ar => ({
        clientName: ar.client.name, amount: ar.originalAmount,
      })),
      newARTotal,

      comparison: {
        yesterday: {
          sales: prevSalesAgg._sum.totalAmount ?? 0,
          count: prevSalesAgg._count ?? 0,
          contributionMargin: prevCM,
        },
        lastWeek: { sales: lwSalesTotal, count: lwSalesCount },
      },

      transactions: periodTransactions.map(t => ({
        id: t.id, type: t.type, totalAmount: t.totalAmount,
        paymentMethod: t.paymentMethod, paymentStatus: t.paymentStatus,
        clientName: t.client?.name || '-', channel: t.channel,
        description: t.description,
        items: t.items.map(i => ({ name: i.product?.name || i.productName, quantity: i.quantity, amount: i.amount })),
      })),
    })
  } catch (error) {
    console.error('Settlement API Error:', error)
    return NextResponse.json({ error: 'Failed', detail: String(error) }, { status: 500 })
  }
}
