import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 일계표 입금 중 통장 매칭 없는 의심 데이터 + 자료 부족 데이터 리스트
// 사용자가 통장/일계표 원본과 대조해서 삭제/유지 결정하는 검증용
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normClient(name: string): string {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
}

export async function GET() {
  try {
    const [payments, banks] = await Promise.all([
      prisma.arPayment.findMany({
        where: { notes: { startsWith: '[일계표]' } },
        include: {
          receivable: {
            include: {
              client: { include: { aliases: { select: { alias: true } } } },
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
      }),
      prisma.bankTransaction.findMany({
        where: { type: 'IN', status: { not: 'INTERNAL' } },
      }),
    ])

    // 거래처 별칭 맵
    const aliasMap = new Map<string, string>()
    for (const p of payments) {
      for (const al of p.receivable.client.aliases ?? []) {
        aliasMap.set(normClient(al.alias), p.receivable.clientId)
      }
      aliasMap.set(normClient(p.receivable.client.name), p.receivable.clientId)
    }

    const used = new Set<number>()
    type Suspect = {
      id: string
      paymentDate: string
      clientId: string
      clientName: string
      amount: number
      notes: string | null
      createdAt: string
    }
    const suspects: Suspect[] = []

    for (const p of payments) {
      const cName = p.receivable.client.name
      const cNorm = normClient(cName)
      const clientId = p.receivable.clientId

      let matched = false
      for (let i = 0; i < banks.length; i++) {
        if (used.has(i)) continue
        const b = banks[i]
        if (b.amount !== p.amount) continue
        const diffDays = Math.abs((b.txDateTime.getTime() - p.paymentDate.getTime()) / 86400000)
        if (diffDays > 5) continue
        const bNorm = normClient(b.rawCounterparty || b.rawDescription)
        if (
          b.clientId === clientId
          || (bNorm && cNorm && (bNorm.includes(cNorm) || cNorm.includes(bNorm)))
          || aliasMap.get(bNorm) === clientId
        ) {
          used.add(i)
          matched = true
          break
        }
      }

      if (!matched) {
        suspects.push({
          id: p.id,
          paymentDate: p.paymentDate.toISOString().slice(0, 10),
          clientId,
          clientName: cName,
          amount: p.amount,
          notes: p.notes,
          createdAt: p.createdAt.toISOString().slice(0, 10),
        })
      }
    }

    // 거래처별 그룹
    const byClient: Record<string, { clientId: string; clientName: string; total: number; count: number; items: Suspect[] }> = {}
    for (const s of suspects) {
      if (!byClient[s.clientId]) byClient[s.clientId] = { clientId: s.clientId, clientName: s.clientName, total: 0, count: 0, items: [] }
      byClient[s.clientId].total += s.amount
      byClient[s.clientId].count += 1
      byClient[s.clientId].items.push(s)
    }
    const groups = Object.values(byClient).sort((a, b) => b.total - a.total)

    const totals = {
      ledgerPayments: payments.length,
      bankInPayments: banks.length,
      suspectCount: suspects.length,
      suspectAmount: suspects.reduce((s, x) => s + x.amount, 0),
    }

    return NextResponse.json({ totals, groups, suspects })
  } catch (error) {
    console.error('[audit/payments]', error)
    return NextResponse.json({ error: '점검 중 오류' }, { status: 500 })
  }
}

// DELETE: 특정 ArPayment 삭제
export async function DELETE(request: Request) {
  try {
    const { paymentId } = await request.json()
    if (!paymentId) return NextResponse.json({ error: 'paymentId 필요' }, { status: 400 })
    await prisma.arPayment.delete({ where: { id: paymentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[audit/payments DELETE]', msg)
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 })
  }
}
