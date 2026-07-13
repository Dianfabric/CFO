import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { differenceInDays } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { normBizName } from '@/lib/recon'

/** ar_snapshots 최신 월 구분 → 거래처 리스크 등급 (악질/파산 자동 분리) */
async function loadRiskGrades(): Promise<Map<string, 'blacklist' | 'bankrupt'>> {
  const out = new Map<string, 'blacklist' | 'bankrupt'>()
  try {
    const sb = await createClient()
    const { data: months } = await sb
      .from('ar_snapshots')
      .select('month_key')
      .order('month_key', { ascending: false })
      .limit(1)
    const latest = months?.[0]?.month_key
    if (!latest) return out
    const { data } = await sb
      .from('ar_snapshots')
      .select('client_name, category')
      .eq('month_key', latest)
    for (const r of (data ?? []) as { client_name: string; category: string | null }[]) {
      const cat = r.category ?? ''
      const grade = /악질/.test(cat) ? 'blacklist' : /파산/.test(cat) ? 'bankrupt' : null
      if (grade) out.set(normBizName(r.client_name), grade)
    }
  } catch {
    /* ar_snapshots 없거나 오류 — 등급 없이 (전부 normal) */
  }
  return out
}

export async function GET(request: NextRequest) {
  try {
    const includeFullyPaid = new URL(request.url).searchParams.get('includeFullyPaid') === 'true'
    const riskGrades = await loadRiskGrades()
    // 항상 모든 AR 가져옴 — 거래처 잔액은 sum(orig) - sum(all payments) 로 계산
    const receivables = await prisma.accountsReceivable.findMany({
      where: undefined,
      include: {
        client: { select: { id: true, name: true, phone: true, notes: true } },
        transaction: {
          select: {
            id: true, date: true, channel: true, salesPerson: true, description: true, taxStatus: true,
            items: { select: { productName: true, quantity: true, unitPrice: true, amount: true } },
            taxInvoices: { select: { id: true, totalAmount: true } },
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

    // 거래처별 세금계산서 + 통장 입금 (참고용 — 잔액 계산 X)
    const [allTaxInvoices, allBankTxs, allMemos] = clientIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          prisma.taxInvoice.findMany({
            where: { clientId: { in: clientIds } },
            orderBy: { issueDate: 'desc' },
          }),
          prisma.bankTransaction.findMany({
            where: { clientId: { in: clientIds }, type: 'IN' },
            orderBy: { txDateTime: 'desc' },
          }),
          prisma.rowMemo.findMany(),
        ])
    const memoMap = new Map<string, string>()
    for (const m of allMemos) memoMap.set(`${m.rowType}__${m.rowId}`, m.text)
    const taxByClient = new Map<string, typeof allTaxInvoices>()
    for (const t of allTaxInvoices) {
      if (!t.clientId) continue
      if (!taxByClient.has(t.clientId)) taxByClient.set(t.clientId, [])
      taxByClient.get(t.clientId)!.push(t)
    }
    const bankByClient = new Map<string, typeof allBankTxs>()
    for (const b of allBankTxs) {
      if (!b.clientId) continue
      if (!bankByClient.has(b.clientId)) bankByClient.set(b.clientId, [])
      bankByClient.get(b.clientId)!.push(b)
    }

    // 거래처별 집계
    const byClient: Record<string, {
      clientId: string; clientName: string; phone: string | null; clientNotes: string | null;
      riskGrade: 'normal' | 'blacklist' | 'bankrupt'; dueDate: string | null;
      totalAmount: number; count: number; oldestDays: number;
      salesPersons: { name: string; count: number; amount: number }[];
      unassignedCount: number; unassignedAmount: number;
      items: typeof receivables;
      allPayments: { id: string; amount: number; paymentDate: Date; paymentMethod: string; notes: string | null }[];
      taxInvoices: { id: string; issueDate: Date; supplyAmount: number; taxAmount: number; totalAmount: number; itemName: string | null; matchedTransactionId: string | null }[];
      bankIns: { id: string; txDateTime: Date; amount: number; rawDescription: string; rawCounterparty: string; matchedPaymentId: string | null }[];
      taxSum: number;
      bankInSum: number;
      memos: Record<string, string>;  // "TYPE__id" → text
    }> = {}

    const now = new Date()
    receivables.forEach(ar => {
      const cid = ar.clientId
      if (!byClient[cid]) {
        const taxList = (taxByClient.get(cid) ?? []).map(t => ({
          id: t.id, issueDate: t.issueDate, supplyAmount: t.supplyAmount, taxAmount: t.taxAmount,
          totalAmount: t.totalAmount, itemName: t.itemName, matchedTransactionId: t.matchedTransactionId,
        }))
        const bankList = (bankByClient.get(cid) ?? []).map(b => ({
          id: b.id, txDateTime: b.txDateTime, amount: b.amount,
          rawDescription: b.rawDescription, rawCounterparty: b.rawCounterparty,
          matchedPaymentId: b.matchedPaymentId,
        }))
        byClient[cid] = {
          clientId: cid, clientName: ar.client.name, phone: ar.client.phone, clientNotes: ar.client.notes,
          riskGrade: riskGrades.get(normBizName(ar.client.name)) ?? 'normal',
          dueDate: null,
          totalAmount: 0, count: 0, oldestDays: 0,
          salesPersons: [], unassignedCount: 0, unassignedAmount: 0,
          items: [],
          allPayments: (paymentsByClient.get(cid) ?? []).map(p => ({
            id: p.id, amount: p.amount, paymentDate: p.paymentDate,
            paymentMethod: p.paymentMethod, notes: p.notes,
          })),
          taxInvoices: taxList,
          bankIns: bankList,
          taxSum: taxList.reduce((s, t) => s + t.totalAmount, 0),
          bankInSum: bankList.reduce((s, b) => s + b.amount, 0),
          memos: Object.fromEntries(allMemos.map(m => [`${m.rowType}__${m.rowId}`, m.text])),
        }
      }
      const c = byClient[cid]
      // 거래처 잔액은 sum(original) - sum(all payments) 로 별도 계산 (아래)
      c.count += 1
      const days = differenceInDays(now, ar.createdAt)
      if (days > c.oldestDays) c.oldestDays = days
      c.items.push(ar)
      // 결제 예정일 — 거래처 대표값(가장 이른 미래 예정일, 없으면 아무 값). 미결제 건 기준.
      if (ar.dueDate) {
        const d = ar.dueDate.toLocaleDateString('sv-SE')
        if (!c.dueDate || d < c.dueDate) c.dueDate = d
      }

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

    // 거래처 잔액 = sum(모든 AR 원금) - sum(모든 입금) — 음수면 입금 초과(선수금)
    for (const c of Object.values(byClient)) {
      const totalOrig = c.items.reduce((s, ar) => s + ar.originalAmount, 0)
      const totalPaid = c.allPayments.reduce((s, p) => s + p.amount, 0)
      c.totalAmount = totalOrig - totalPaid
    }

    // 담당자별 정렬 (건수 내림차순)
    Object.values(byClient).forEach(c => c.salesPersons.sort((a, b) => b.count - a.count))

    // includeFullyPaid=false 면 잔액 0 거래처만 숨김 (음수=입금초과는 노출)
    const summary = Object.values(byClient)
      .filter(c => includeFullyPaid || c.totalAmount !== 0)
      .sort((a, b) => b.totalAmount - a.totalAmount)
    const totalAR = summary.reduce((s, c) => s + c.totalAmount, 0)
    const overdueTotal = receivables
      .filter(ar => ar.status === 'OVERDUE' || differenceInDays(now, ar.createdAt) > 30)
      .reduce((s, ar) => s + ar.remainingAmount, 0)

    // 전체 담당자 목록 (필터용)
    const allPersons = Array.from(new Set(
      receivables.map(ar => ar.transaction.salesPerson).filter(Boolean) as string[],
    )).sort()

    // 미수 건 부가정보 (프로젝트명·거래처 담당자·연락처) — ar_meta 오버레이 (테이블 없으면 빈 맵)
    let arMeta: Record<string, { project_name: string | null; contact_name: string | null; contact_phone: string | null }> = {}
    try {
      const sb = await createClient()
      const { data: metas } = await sb.from('ar_meta').select('ar_id, project_name, contact_name, contact_phone').limit(5000)
      arMeta = Object.fromEntries(
        ((metas ?? []) as { ar_id: string; project_name: string | null; contact_name: string | null; contact_phone: string | null }[])
          .map((m) => [m.ar_id, { project_name: m.project_name, contact_name: m.contact_name, contact_phone: m.contact_phone }]),
      )
    } catch { /* 없으면 빈 맵 */ }

    return NextResponse.json({ summary, totalAR, overdueTotal, totalCount: receivables.length, allPersons, arMeta })
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
