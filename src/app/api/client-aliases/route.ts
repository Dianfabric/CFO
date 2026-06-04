import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST: 별칭 → 거래처 매핑 추가 + 기존 미매칭 BankTransaction 재매칭
export async function POST(request: NextRequest) {
  try {
    const { alias, clientId } = await request.json()
    if (!alias || !clientId) return NextResponse.json({ error: 'alias / clientId 필수' }, { status: 400 })

    await prisma.clientAlias.upsert({
      where: { alias },
      update: { clientId },
      create: { alias, clientId },
    })

    // 같은 raw 키워드 가진 미매칭 BankTransaction 재매칭
    const updated = await prisma.bankTransaction.updateMany({
      where: {
        OR: [
          { rawCounterparty: { contains: alias } },
          { rawDescription: { contains: alias } },
        ],
        clientId: null,
      },
      data: { clientId, status: 'MATCHED' },
    })

    return NextResponse.json({ success: true, rematched: updated.count })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 })
  }
}

export async function GET() {
  const aliases = await prisma.clientAlias.findMany({
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(aliases)
}
