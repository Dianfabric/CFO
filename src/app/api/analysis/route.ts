import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '3')

    const now = new Date()
    const results = []

    for (let i = months - 1; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(now, i))
      const mEnd = endOfMonth(subMonths(now, i))

      const [sales, expenses] = await Promise.all([
        prisma.transaction.aggregate({ where: { type: 'SALE', date: { gte: mStart, lte: mEnd } }, _sum: { totalAmount: true }, _count: true }),
        prisma.transaction.aggregate({ where: { type: { in: ['EXPENSE', 'PURCHASE'] }, date: { gte: mStart, lte: mEnd } }, _sum: { totalAmount: true } }),
      ])

      results.push({
        month: `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, '0')}`,
        label: `${mStart.getMonth() + 1}월`,
        sales: sales._sum.totalAmount || 0,
        expenses: expenses._sum.totalAmount || 0,
        profit: (sales._sum.totalAmount || 0) - (expenses._sum.totalAmount || 0),
        count: sales._count || 0,
      })
    }

    // 제품별 분석
    const startRange = startOfMonth(subMonths(now, months - 1))
    const productSales = await prisma.transactionItem.groupBy({
      by: ['productId'],
      where: { transaction: { type: 'SALE', date: { gte: startRange } }, productId: { not: null } },
      _sum: { amount: true, quantity: true },
      orderBy: { _sum: { amount: 'desc' } },
    })

    const products = await prisma.product.findMany()
    const totalRev = productSales.reduce((s, p) => s + (p._sum.amount || 0), 0)

    const productAnalysis = productSales.map(ps => {
      const prod = products.find(p => p.id === ps.productId)
      const rev = ps._sum.amount || 0
      const cost = (prod?.purchasePrice || 0) * (ps._sum.quantity || 0)
      const margin = rev > 0 ? ((rev - cost) / rev) * 100 : 0
      const share = totalRev > 0 ? (rev / totalRev) * 100 : 0
      const avgMargin = 40
      const avgShare = 100 / productSales.length

      return {
        id: ps.productId,
        name: prod?.name || '알 수 없음',
        category: prod?.category || '',
        revenue: rev,
        cost,
        profit: rev - cost,
        margin,
        volume: ps._sum.quantity || 0,
        share,
        grade: margin >= avgMargin && share >= avgShare ? 'A' : margin >= avgMargin ? 'B' : share >= avgShare ? 'C' : 'D',
      }
    })

    // 채널별 분석
    const channelSales = await prisma.transaction.groupBy({
      by: ['channel'],
      where: { type: 'SALE', date: { gte: startRange } },
      _sum: { totalAmount: true },
      _count: true,
    })

    // 고정비
    const costs = await prisma.recurringCost.findMany({ include: { costCategory: true } })
    const monthlyFixed = costs.reduce((s, c) => s + (c.frequency === 'MONTHLY' ? c.amount : c.frequency === 'QUARTERLY' ? Math.round(c.amount / 3) : Math.round(c.amount / 12)), 0)

    return NextResponse.json({
      monthlyTrend: results,
      productAnalysis,
      channelSales: channelSales.map(cs => ({
        channel: cs.channel, amount: cs._sum.totalAmount || 0, count: cs._count,
      })),
      monthlyFixedCost: monthlyFixed,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
