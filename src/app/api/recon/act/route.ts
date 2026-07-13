/**
 * POST /api/recon/act
 *
 * 대사 제안 승인/거절.
 * - confirm tax: 세금계산서 MATCHED + 거래 발행 확인(taxStatus=ISSUED)
 * - confirm deposit: ArPayment 생성 + AR 재계산 + 통장 MATCHED
 * - reject: 조합 기억 → 재제안 방지
 */
import { NextRequest, NextResponse } from 'next/server'
import { confirmTaxLink, confirmPurchaseTaxLink, confirmDepositLink, rejectPair } from '@/lib/recon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  action: 'confirm' | 'reject'
  kind: 'tax' | 'ptax' | 'deposit'
  key: string
  leftId?: string // txId | bankId
  rightId?: string // invoiceId | clientId | approvalNumber
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    if (body.action === 'reject') {
      const res = await rejectPair(body.key)
      return NextResponse.json(res, { status: res.ok ? 200 : 400 })
    }
    if (!body.leftId || !body.rightId) {
      return NextResponse.json({ ok: false, error: 'leftId/rightId 필요' }, { status: 400 })
    }
    if (body.kind === 'tax') {
      await confirmTaxLink(body.leftId, body.rightId)
    } else if (body.kind === 'ptax') {
      await confirmPurchaseTaxLink(body.leftId, body.rightId)
    } else {
      await confirmDepositLink(body.leftId, body.rightId)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : '처리 실패' },
      { status: 500 },
    )
  }
}
