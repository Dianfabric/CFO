/**
 * GET /api/recon/clients?q=검색어
 *
 * 통장 입금 수동 연결용 거래처 검색 (이름 부분 일치, 미수 잔액 표시).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (q.length < 1) return NextResponse.json({ clients: [] })
    const clients = await prisma.client.findMany({
      where: { name: { contains: q } },
      select: {
        id: true,
        name: true,
        accountsReceivable: { select: { remainingAmount: true } },
      },
      take: 10,
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        remaining: c.accountsReceivable.reduce((s, r) => s + r.remainingAmount, 0),
      })),
    })
  } catch (e) {
    return NextResponse.json({
      clients: [],
      error: e instanceof Error ? e.message : '거래처 검색 실패',
    })
  }
}
