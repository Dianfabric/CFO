import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { applyPtaxRules } from '@/lib/ptax-rules'

export const runtime = 'nodejs'

// 디안 사업자등록번호 — 매출/매입 목록 자동 구분에 사용
const DIAN_BIZ_NO = '211-08-78685'

function normName(name: string): string {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
}

function parseDate(v: unknown): Date | null {
  const s = String(v ?? '').trim()
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return null
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 12, 0, 0)
}

function parseNum(v: unknown): number {
  const s = String(v ?? '').replace(/,/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.abs(n)
}

// 세금계산서 → SALE 트랜잭션 매칭
// 1차: 거래처 + 합계금액 + 동일/근접 날짜 (±3일)
// 2차: 거래처 + 동월 합계금액 합산
async function matchTaxInvoice(inv: { clientId: string | null; totalAmount: number; issueDate: Date }) {
  if (!inv.clientId) return null
  const dateStart = new Date(inv.issueDate); dateStart.setDate(dateStart.getDate() - 3)
  const dateEnd = new Date(inv.issueDate); dateEnd.setDate(dateEnd.getDate() + 3)
  const tx = await prisma.transaction.findFirst({
    where: {
      type: 'SALE',
      clientId: inv.clientId,
      totalAmount: inv.totalAmount,
      date: { gte: dateStart, lte: dateEnd },
    },
  })
  return tx?.id ?? null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

    // 헤더 행 (행 5: 작성일자, 승인번호, ...)
    let dataStartRow = -1
    for (let i = 0; i < Math.min(20, rows.length); i++) {
      if (String(rows[i]?.[0] ?? '').includes('작성일자')) { dataStartRow = i + 1; break }
    }
    if (dataStartRow < 0) return NextResponse.json({ error: '세금계산서 헤더를 찾을 수 없습니다' }, { status: 400 })

    // ── 매출/매입 자동 구분 ──
    // 1) 제목 행에 '매입'/'매출' 명시 여부  2) 데이터 행의 공급자 사업자번호가
    //    디안이면 매출, 공급받는자가 디안이면 매입
    let direction: 'sales' | 'purchase' | null = null
    for (let i = 0; i < Math.min(dataStartRow, rows.length); i++) {
      const line = (rows[i] ?? []).map((c) => String(c ?? '')).join(' ')
      if (/매입\s*전자.*세금계산서/.test(line)) { direction = 'purchase'; break }
      if (/매출\s*전자.*세금계산서/.test(line)) { direction = 'sales'; break }
    }
    if (!direction) {
      const probe = rows[dataStartRow] ?? []
      const supplierBiz = String(probe[4] ?? '').trim()
      const buyerBiz = String(probe[9] ?? '').trim()
      direction = buyerBiz === DIAN_BIZ_NO && supplierBiz !== DIAN_BIZ_NO ? 'purchase' : 'sales'
    }

    // ── 법인(엔에이아이디) 세금계산서 자동 분기 — 법인 매출·매입의 정본 (대표 결정 2026-07-10) ──
    const NAID_BIZ_NO = '835-81-02363'
    const ownerLine = (rows[0] ?? []).map((c) => String(c ?? '')).join(' ')
    if (ownerLine.includes(NAID_BIZ_NO)) {
      const supabase = await createClient()
      const dir: 'sale' | 'purchase' = direction === 'purchase' ? 'purchase' : 'sale'
      const recs: {
        approval_no: string; direction: string; issue_date: string; month_key: string
        counterparty: string | null; supply_amount: number; tax_amount: number; item: string | null
      }[] = []
      for (let i = dataStartRow; i < rows.length; i++) {
        const r = rows[i] ?? []
        const d = parseDate(r[0])
        const approval = String(r[1] ?? '').trim()
        if (!d || !approval) continue
        const iso = d.toISOString()
        recs.push({
          approval_no: approval,
          direction: dir,
          issue_date: iso.slice(0, 10),
          month_key: iso.slice(0, 7),
          counterparty: String((dir === 'sale' ? r[11] : r[6]) ?? '').trim() || null,
          supply_amount: parseNum(r[15]),
          tax_amount: parseNum(r[16]),
          item: String(r[26] ?? '').trim() || null,
        })
      }
      if (recs.length === 0) {
        return NextResponse.json({ error: '법인 계산서 데이터 행을 찾지 못했습니다' }, { status: 400 })
      }
      const { error } = await supabase.from('naid_invoices').upsert(recs, { onConflict: 'approval_no' })
      if (error) {
        const missing = /find the table|does not exist|schema cache/i.test(error.message)
        return NextResponse.json(
          {
            error: missing
              ? 'naid_invoices 테이블이 없습니다 — supabase/migrations/2026-07-10_naid_invoices.sql 실행 필요'
              : error.message,
          },
          { status: missing ? 409 : 500 },
        )
      }
      return NextResponse.json({
        success: true,
        naid: true,
        direction: dir,
        count: recs.length,
        supplySum: recs.reduce((s, x) => s + x.supply_amount, 0),
        months: [...new Set(recs.map((x) => x.month_key))].sort(),
      })
    }

    // ── 매입 세금계산서 → Supabase 저장 + 일계표 매입 거래 대사 ──
    if (direction === 'purchase') {
      const supabase = await createClient()
      let pCreated = 0, pDup = 0, pMatched = 0, pUnmatched = 0, pSum = 0
      for (let i = dataStartRow; i < rows.length; i++) {
        const r = rows[i]
        const approvalNumber = String(r[1] ?? '').trim()
        if (!approvalNumber) continue
        const issueDate = parseDate(r[0]) ?? new Date()
        const supplierNameRaw = String(r[6] ?? '').trim() // 공급자 상호
        const supplierBizNo = String(r[4] ?? '').trim()
        const totalAmount = parseNum(r[14])
        const supplyAmount = parseNum(r[15])
        const taxAmount = parseNum(r[16])
        const itemName = String(r[26] ?? '').trim() || null
        if (!supplierNameRaw || totalAmount === 0) continue

        // 중복 체크
        const { data: exists, error: selErr } = await supabase
          .from('purchase_tax_invoices')
          .select('approval_number')
          .eq('approval_number', approvalNumber)
          .maybeSingle()
        if (selErr) {
          const missing = /find the table|does not exist/i.test(selErr.message)
          return NextResponse.json(
            {
              error: missing
                ? '매입 계산서 테이블이 없습니다 — supabase/migrations/2026-07-03_purchase_tax_invoices.sql 을 실행해 주세요.'
                : selErr.message,
            },
            { status: 400 },
          )
        }
        if (exists) { pDup++; continue }

        // 매입 거래 대사 — 거래처(사업자번호→이름) → PURCHASE 공급가·±3일
        let client: { id: string } | null = supplierBizNo
          ? await prisma.client.findFirst({ where: { businessNumber: supplierBizNo }, select: { id: true } })
          : null
        if (!client) {
          const all = await prisma.client.findMany({ select: { id: true, name: true } })
          const k = normName(supplierNameRaw)
          client = all.find((c) => normName(c.name) === k) ?? null
        }
        let matchedTxId: string | null = null
        if (client) {
          const ds = new Date(issueDate); ds.setDate(ds.getDate() - 3)
          const de = new Date(issueDate); de.setDate(de.getDate() + 3)
          const tx = await prisma.transaction.findFirst({
            where: {
              type: 'PURCHASE',
              clientId: client.id,
              totalAmount: supplyAmount,
              date: { gte: ds, lte: de },
            },
          })
          matchedTxId = tx?.id ?? null
        }

        const { error: insErr } = await supabase.from('purchase_tax_invoices').insert({
          approval_number: approvalNumber,
          issue_date: issueDate.toLocaleDateString('sv-SE'),
          supplier_name_raw: supplierNameRaw,
          supplier_biz_no: supplierBizNo || null,
          supply_amount: supplyAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          item_name: itemName,
          matched_tx_id: matchedTxId,
          status: matchedTxId ? 'MATCHED' : 'UNMATCHED',
        })
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
        pCreated++
        pSum += totalAmount
        if (matchedTxId) pMatched++; else pUnmatched++
      }
      // 거래처 자동 분류 규칙 적용 — 새 계산서에 성격(원가/변동/고정/기타) 즉시 부여
      let autoClassified = 0
      try {
        const applied = await applyPtaxRules(supabase)
        autoClassified = applied.reduce((s, a) => s + a.count, 0)
      } catch { /* 규칙 테이블 미생성 — 무시 */ }
      return NextResponse.json({
        success: true, type: 'purchase_tax_invoice',
        created: pCreated, duplicate: pDup, matched: pMatched, unmatched: pUnmatched,
        totalAmount: pSum, autoClassified,
      })
    }

    let created = 0, dup = 0, matched = 0, unmatched = 0
    let totalSum = 0

    for (let i = dataStartRow; i < rows.length; i++) {
      const r = rows[i]
      const approvalNumber = String(r[1] ?? '').trim()
      if (!approvalNumber) continue
      const issueDate = parseDate(r[0]) ?? new Date()
      const clientNameRaw = String(r[11] ?? '').trim()
      const businessNumber = String(r[9] ?? '').trim()
      const totalAmount = parseNum(r[14])
      const supplyAmount = parseNum(r[15])
      const taxAmount = parseNum(r[16])
      const itemName = String(r[26] ?? '').trim() || null
      if (!clientNameRaw || totalAmount === 0) continue

      // 중복 체크 (승인번호 unique)
      const exists = await prisma.taxInvoice.findUnique({ where: { approvalNumber } })
      if (exists) { dup++; continue }

      // 거래처 매칭 (사업자번호 우선 → 이름 정규화)
      let client: { id: string; name: string; businessNumber: string | null } | null =
        businessNumber ? await prisma.client.findFirst({
          where: { businessNumber }, select: { id: true, name: true, businessNumber: true },
        }) : null
      if (!client) {
        const all = await prisma.client.findMany({ select: { id: true, name: true, businessNumber: true } })
        const k = normName(clientNameRaw)
        client = all.find(c => normName(c.name) === k) ?? null
      }

      const matchedTxId = client ? await matchTaxInvoice({
        clientId: client.id, totalAmount, issueDate,
      }) : null

      await prisma.taxInvoice.create({
        data: {
          approvalNumber, issueDate,
          clientId: client?.id ?? null,
          clientNameRaw, businessNumber: businessNumber || null,
          supplyAmount, taxAmount, totalAmount,
          itemName, matchedTransactionId: matchedTxId,
          status: matchedTxId ? 'MATCHED' : 'UNMATCHED',
        },
      })

      // 거래처에 businessNumber 없으면 채우기
      if (client && businessNumber && !client.businessNumber) {
        await prisma.client.update({ where: { id: client.id }, data: { businessNumber } })
      }

      created++
      totalSum += totalAmount
      if (matchedTxId) matched++; else unmatched++
    }

    return NextResponse.json({
      success: true, type: 'tax_invoice',
      created, duplicate: dup, matched, unmatched, totalAmount: totalSum,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Tax invoice upload error:', msg)
    return NextResponse.json({ error: '처리 중 오류', detail: msg.slice(0, 300) }, { status: 500 })
  }
}
