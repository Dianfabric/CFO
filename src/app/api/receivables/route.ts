import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { differenceInDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const includeFullyPaid = new URL(request.url).searchParams.get('includeFullyPaid') === 'true'
    // 항상 모든 AR 가져옴 — 거래처 잔액은 sum(orig) - sum(all payments) 로 계산
    const receivables = await prisma.accountsReceivable.findMany({
      where: undefined,
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

    // 거래처별 전체 입금 (매출 매칭 무관 — 미수금 페이지에서 입금 이력 표시용)
    const clientIds = Array.from(new Set(receivables.map(ar => ar.clientId)))
    const allPaymentsRaw = clientIds.length === 0 ? [] : await prisma.arPayment.findMany({
      where: { receivable: { clientId: { in: clientIds } } },
      include: { receivable: { select: { clientId: true } } },
      orderBy: { paymentDate: 'desc' },
    })
    const paymentsByClient = new Map<string, typeof allPaymentsRaw>()
    for (const p of allPaymentsRaw) {
      const cid = p.receivable.clientId
      if (!paymentsByClient.has(cid)) paymentsByClient.set(cid, [])
      paymentsByClient.get(cid)!.push(p)
    }

    // 거래처별 집계
    const byClient: Record<string, {
      clientId: string; clientName: string; phone: string | null;
      totalAmount: number; count: number; oldestDays: number;
      salesPersons: { name: string; count: number; amount: number }[];
      unassignedCount: number; unassignedAmount: number;
      items: typeof receivables;
      allPayments: { id: string; amount: number; paymentDate: Date; paymentMethod: string; notes: string | null }[];
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
          allPayments: (paymentsByClient.get(cid) ?? []).map(p => ({
            id: p.id, amount: p.amount, paymentDate: p.paymentDate,
            paymentMethod: p.paymentMethod, notes: p.notes,
          })),
        }
      }
      const c = byClient[cid]
      // 거래처 잔액은 sum(original) - sum(all payments) 로 별도 계산 (아래)
      c.count += 1
      const days = differenceInDays(now, ar.createdAt)
      if (days > c.oldestDays) c.oldestDays = days
      c.items.push(ar)

      // 담당자별 집계는 매출 단위 (전체 매출 ar.originalAmount 기준)
      const person = ar.transaction.salesPerson
      if (person) {
        const existing = c.salesPersons.find(p => p.name === person)
        if (existing) { existing.count++; existing.amount += ar.originalAmount }
        else c.salesPersons.push({ name: person, count: 1, amount: ar.originalAmount })
      } else {
        c.unassignedCount++
        c.unassignedAmount += ar.originalAmount
      }
    })

    // 거래처 잔액 = sum(모든 AR 원금) - sum(모든 입금)
    for (const c of Object.values(byClient)) {
      const totalOrig = c.items.reduce((s, ar) => s + ar.originalAmount, 0)
      const totalPaid = c.allPayments.reduce((s, p) => s + p.amount, 0)
      c.totalAmount = Math.max(0, totalOrig - totalPaid)
    }

    // 담당자별 정렬 (건수 내림차순)
    Object.values(byClient).forEach(c => c.salesPersons.sort((a, b) => b.count - a.count))

    // includeFullyPaid=false 면 잔액 0 거래처 제외
    const summary = Object.values(byClient)
      .filter(c => includeFullyPaid || c.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount)
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
