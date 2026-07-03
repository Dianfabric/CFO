/**
 * GET /api/receipts/export?year=2026&q=2  (q 생략 시 연간 전체)
 *
 * 간이영수증 엑셀 다운로드 — 기존 수기 대장과 동일 양식:
 * 날짜 | 상호 | 적요 | 금액  (시트명 "{YY}년 간이영수증")
 */
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sb = createServiceClient()
    const now = new Date()
    const year = Number(req.nextUrl.searchParams.get('year')) || now.getFullYear()
    const qParam = req.nextUrl.searchParams.get('q')
    const q = qParam ? Number(qParam) : null

    const start = q ? `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01` : `${year}-01-01`
    const end = q
      ? new Date(year, (q - 1) * 3 + 3, 0).toLocaleDateString('sv-SE')
      : `${year}-12-31`

    const { data, error } = await sb
      .from('simple_receipts')
      .select('receipt_date, vendor, item, amount')
      .gte('receipt_date', start)
      .lte('receipt_date', end)
      .order('receipt_date', { ascending: true })
      .order('id', { ascending: true })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // 기존 대장 양식: 날짜(M/D/YY) | 상호 | 적요 | 금액
    const rows: (string | number)[][] = [['날짜', '상호', '적요', '금액']]
    for (const r of data ?? []) {
      const d = String(r.receipt_date) // YYYY-MM-DD
      const label = `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}/${d.slice(2, 4)}`
      rows.push([label, r.vendor as string, r.item as string, r.amount as number])
    }
    // 합계 행
    const total = (data ?? []).reduce((s, r) => s + (r.amount as number), 0)
    rows.push(['', '', '합계', total])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 10 }, { wch: 22 }, { wch: 14 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    const sheetName = `${String(year).slice(2)}년 간이영수증${q ? ` ${q}분기` : ''}`
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const filename = `간이영수증(디안)-${year}${q ? `-Q${q}` : ''}.xlsx`
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '다운로드 실패' },
      { status: 500 },
    )
  }
}
