import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

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
