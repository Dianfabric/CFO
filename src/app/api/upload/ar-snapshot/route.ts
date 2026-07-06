/**
 * POST /api/upload/ar-snapshot — '미수 현황' 엑셀 흡수.
 *
 * 시트 '26년01월' 형식(YY년MM월)마다: 상호명·전기이월·매출액(공급가)·수금액·잔액(VAT포함)·전화·소계.
 * - ar_snapshots 에 (월, 거래처) upsert — 매월 시트가 늘어나는 구조 그대로 재업로드 안전
 * - 응답에 시스템 미수금과의 교차 검증: 장부 잔액 vs 시스템 AR 잔액 차이 상위 목록
 *   (이월분·누락 입금 파악용 — 잔액은 양쪽 다 VAT 포함이라 직접 비교 가능)
 */
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { normBizName } from '@/lib/recon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SHEET_RE = /^(\d{2})년\s*(\d{1,2})월$/

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? Math.round(n) : 0
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
    const monthSheets = wb.SheetNames.filter((n) => SHEET_RE.test(n.trim()))
    if (monthSheets.length === 0) {
      return NextResponse.json({ error: "월 시트(예: '26년01월')를 찾지 못했습니다" }, { status: 400 })
    }

    const supabase = await createClient()
    const results: {
      monthKey: string
      rows: number
      balanceSum: number
      openingSum: number
    }[] = []
    let latestKey = ''
    const latestRows: { name: string; balance: number; category: string }[] = []

    for (const sheetName of monthSheets) {
      const m = sheetName.trim().match(SHEET_RE)!
      const monthKey = `20${m[1]}-${m[2].padStart(2, '0')}`
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: '' })
      const recs: {
        month_key: string; client_name: string; category: string | null
        opening: number; sales: number; collected: number; balance: number; phone: string | null
      }[] = []
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        const name = String(r[1] ?? '').trim()
        if (!name || name === '상호명') continue
        const rec = {
          month_key: monthKey,
          client_name: name,
          category: String(r[9] ?? '').replace(/\s+/g, ' ').trim() || null,
          opening: num(r[2]),
          sales: num(r[3]),
          collected: num(r[4]),
          balance: num(r[7]),
          phone: String(r[8] ?? '').trim() || null,
        }
        if (rec.opening === 0 && rec.sales === 0 && rec.collected === 0 && rec.balance === 0) continue
        recs.push(rec)
      }
      const { error } = await supabase
        .from('ar_snapshots')
        .upsert(recs, { onConflict: 'month_key,client_name' })
      if (error) {
        if (/find the table|does not exist|schema cache/i.test(error.message)) {
          return NextResponse.json(
            { error: 'ar_snapshots 테이블이 없습니다 — supabase/migrations/2026-07-06_ar_snapshots.sql 실행 필요' },
            { status: 409 },
          )
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      results.push({
        monthKey,
        rows: recs.length,
        balanceSum: recs.reduce((s, x) => s + x.balance, 0),
        openingSum: recs.reduce((s, x) => s + x.opening, 0),
      })
      if (monthKey > latestKey) {
        latestKey = monthKey
        latestRows.length = 0
        latestRows.push(...recs.map((x) => ({ name: x.client_name, balance: x.balance, category: x.category ?? '' })))
      }
    }

    // ── 교차 검증 (최신 시트 기준): 장부 잔액 vs 시스템 AR 잔액 (해당 월말 시점) ──
    const [y, mo] = latestKey.split('-').map(Number)
    const monthEnd = new Date(y, mo, 0, 23, 59, 59)
    const ars = await prisma.accountsReceivable.findMany({
      where: { transaction: { date: { lte: monthEnd } } },
      select: {
        originalAmount: true,
        client: { select: { name: true } },
        payments: { select: { amount: true, paymentDate: true } },
      },
    })
    const sysByName = new Map<string, number>()
    for (const ar of ars) {
      const key = normBizName(ar.client?.name ?? '')
      if (!key) continue
      const paidByEnd = ar.payments
        .filter((p) => p.paymentDate <= monthEnd)
        .reduce((s, p) => s + p.amount, 0)
      sysByName.set(key, (sysByName.get(key) ?? 0) + ar.originalAmount - paidByEnd)
    }
    const diffs: { name: string; ledger: number; system: number; diff: number; category: string }[] = []
    for (const row of latestRows) {
      if (row.category.includes('7.공') || row.category.includes('매입처')) continue // 매입처 잔액은 미수 아님
      const sys = sysByName.get(normBizName(row.name)) ?? 0
      const diff = row.balance - sys
      if (Math.abs(diff) >= 1000 && row.balance !== 0) diffs.push({ name: row.name, ledger: row.balance, system: sys, diff, category: row.category })
    }
    diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

    return NextResponse.json({
      ok: true,
      sheets: results,
      crossCheck: {
        monthKey: latestKey,
        mismatchCount: diffs.length,
        mismatchSum: diffs.reduce((s, d) => s + d.diff, 0),
        top: diffs.slice(0, 15),
        note: '차이(+) = 장부가 더 큼(이월·미등록 매출 가능성), 차이(−) = 시스템이 더 큼(장부 반영 누락 가능성)',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '미수 현황 업로드 실패' }, { status: 500 })
  }
}
