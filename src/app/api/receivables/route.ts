import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { differenceInDays } from 'date-fns'

export async function GET() {
  try {
    const receivables = await prisma.accountsReceivable.findMany({
      where: { status: { in: ['OUTSTANDING', 'PARTIAL', 'OVERDUE'] } },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        transaction: {
          select: {
            date: true, channel: true, salesPerson: true,
            items: { select: { productName: true, quantity: true, unitPrice: true, amount: true } },
          },
        },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // 거래처별 집계
    const byClient: Record<string, {
      clientId: string; clientName: string; phone: string | null;
      totalAmount: number; count: number; oldestDays: number;
      salesPersons: { name: string; count: number; amount: number }[];
      unassignedCount: number; unassignedAmount: number;
      items: typeof receivables
    }> = {}

    const now = new Date()
    receivables.forEach(ar => {
      const cid = ar.clientId
      if (!byClient[cid]) {
        byClient[cid] = {
          clientId: cid, clientName: ar.client.name, phone: ar.client.phone,
          totalAmount: 0, count: 0, oldestDays: 0,
          salesPersons: [], unassignedCount: 0, unassignedAmount: 0,
          items: [],
        }
      }
      const c = byClient[cid]
      c.totalAmount += ar.remainingAmount
      c.count += 1
      const days = differenceInDays(now, ar.createdAt)
      if (days > c.oldestDays) c.oldestDays = days
      c.items.push(ar)

      // 담당자별 집계
      const person = ar.transaction.salesPerson
      if (person) {
        const existing = c.salesPersons.find(p => p.name === person)
        if (existing) { existing.count++; existing.amount += ar.remainingAmount }
        else c.salesPersons.push({ name: person, count: 1, amount: ar.remainingAmount })
      } else {
        c.unassignedCount++
        c.unassignedAmount += ar.remainingAmount
      }
    })

    // 담당자별 정렬 (건수 내림차순)
    Object.values(byClient).forEach(c => c.salesPersons.sort((a, b) => b.count - a.count))

    const summary = Object.values(byClient).sort((a, b) => b.totalAmount - a.totalAmount)
    const totalAR = summary.reduce((s, c) => s + c.totalAmount, 0)
    const overdueTotal = receivables
      .filter(ar => ar.status === 'OVERDUE' || differenceInDays(now, ar.createdAt) > 30)
      .reduce((s, ar) => s + ar.remainingAmount, 0)

    // 전체 담당자 목록 (필터용)
    const allPersons = Array.from(new Set(
      receivables.map(ar => ar.transaction.salesPerson).filter(Boolean) as string[],
    )).sort()

    return NextResponse.json({ summary, totalAR, overdueTotal, totalCount: receivables.length, allPersons })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[receivables GET]', msg)
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 })
  }
}

// POST - 미수금 회수 기록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { receivableId, amount, paymentMethod, notes } = body

    const ar = await prisma.accountsReceivable.findUnique({ where: { id: receivableId } })
    if (!ar) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.arPayment.create({
      data: {
        receivableId,
        amount,
        paymentDate: new Date(),
        paymentMethod: paymentMethod || 'TRANSFER',
        notes: notes || null,
      },
    })

    const newRemaining = ar.remainingAmount - amount
    await prisma.accountsReceivable.update({
      where: { id: receivableId },
      data: {
        remainingAmount: Math.max(0, newRemaining),
        status: newRemaining <= 0 ? 'PAID' : 'PARTIAL',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
