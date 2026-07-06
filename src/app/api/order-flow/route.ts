/**
 * 주문 진행 상황판 API — 거래 관리.
 *
 * GET  /api/order-flow?days=60
 *   최근 매출(발주) 거래 + 진행 단계(order_flow) 병합.
 *   입금(paymentStatus)·계산서(taxStatus)·미수 잔액까지 한 줄에.
 * POST /api/order-flow { txId, route?, stage? }
 *   단계/경로 upsert — history 에 변경 이력 누적.
 *   order_flow 테이블 없으면 안내 메시지 반환.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { EXCLUDE_BALANCE_CORRECTION } from '@/lib/sales-filter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TABLE_MISSING_RE = /find the table|does not exist|schema cache/i

export async function GET(req: NextRequest) {
  try {
    const days = Math.min(Number(req.nextUrl.searchParams.get('days') ?? 60), 365)
    const since = new Date()
    since.setDate(since.getDate() - days)

    const supabase = await createClient()
    const [txs, flowRes] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          type: 'SALE',
          date: { gte: since },
          totalAmount: { gt: 0 },
          ...EXCLUDE_BALANCE_CORRECTION,
        },
        include: {
          client: { select: { name: true, phone: true } },
          items: { select: { productName: true, quantity: true } },
          accountsReceivable: { select: { remainingAmount: true } },
        },
        orderBy: { date: 'desc' },
        take: 200,
      }),
      supabase.from('order_flow').select('*'),
    ])

    const tableMissing = !!flowRes.error && TABLE_MISSING_RE.test(flowRes.error.message)
    const flowMap = new Map(
      ((flowRes.data ?? []) as { tx_id: string; route: string; stage: number; updated_at: string }[]).map(
        (f) => [f.tx_id, f],
      ),
    )

    const rows = txs.map((t) => {
      const f = flowMap.get(t.id)
      const itemsSummary = t.items
        .slice(0, 3)
        .map((i) => `${i.productName}×${i.quantity}`)
        .join(', ') + (t.items.length > 3 ? ` 외 ${t.items.length - 3}` : '')
      const arRemaining = t.accountsReceivable.reduce((s, a) => s + a.remainingAmount, 0)
      return {
        txId: t.id,
        date: t.date.toISOString().slice(0, 10),
        client: t.client?.name ?? '거래처 미상',
        phone: t.client?.phone ?? null,
        itemsSummary: itemsSummary || (t.description ?? ''),
        amount: t.totalAmount,
        person: t.salesPerson ?? null,
        paymentStatus: t.paymentStatus,
        taxStatus: t.taxStatus ?? null,
        arRemaining,
        route: (f?.route as 'domestic' | 'overseas') ?? 'domestic',
        stage: f?.stage ?? 0,
        touched: !!f, // 한 번이라도 단계를 만졌는지
        updatedAt: f?.updated_at ?? null,
      }
    })

    return NextResponse.json({ days, tableMissing, rows })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '주문 흐름 조회 실패' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const txId = String(body.txId ?? '')
    if (!txId) return NextResponse.json({ error: 'txId 필요' }, { status: 400 })

    const supabase = await createClient()
    const { data: existing } = await supabase.from('order_flow').select('*').eq('tx_id', txId).maybeSingle()

    const route = body.route ?? existing?.route ?? 'domestic'
    const stage = body.stage ?? existing?.stage ?? 0
    const history = Array.isArray(existing?.history) ? existing.history : []
    history.push({ at: new Date().toISOString(), route, stage })

    const { error } = await supabase.from('order_flow').upsert(
      { tx_id: txId, route, stage, history, updated_at: new Date().toISOString() },
      { onConflict: 'tx_id' },
    )
    if (error) {
      if (TABLE_MISSING_RE.test(error.message)) {
        return NextResponse.json({ error: 'order_flow 테이블이 아직 없습니다 — supabase/migrations/2026-07-06_order_flow.sql 실행 필요' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, route, stage })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '저장 실패' }, { status: 500 })
  }
}
