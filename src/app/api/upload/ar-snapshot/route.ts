/**
 * POST /api/upload/ar-snapshot — '미수 현황' 엑셀 흡수. 두 양식 자동 인식:
 *
 * ① 시트 'YY년MM월'(예: 26년01월)마다: 상호명(1열)·전기이월·매출액·수금액·잔액(7열)·전화·구분(9열).
 * ② '거래처별 잔액 명세서 YYYY.MM월' (Sheet1 단일, ERP 월별 export):
 *    상호명(0열)·주소·전기이월·매출액·수금액·매입액·지급액·잔액(7열)·전화(8열),
 *    구분은 행이 아니라 뒤따르는 '소계: N.구분명' 행이 구간을 닫는 방식 → 구간별로 할당.
 *
 * - ar_snapshots 에 월 단위 delete→upsert — 재업로드 안전
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
const STATEMENT_TITLE_RE = /거래처별\s*잔액\s*명세서\s*(\d{4})\.(\d{1,2})월/

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? Math.round(n) : 0
}

interface ArRec {
  month_key: string
  client_name: string
  category: string | null
  opening: number
  sales: number
  collected: number
  balance: number
  phone: string | null
}

/** 양식① 'YY년MM월' 시트 — 구분이 각 행 9열에 있음 */
function parseMonthSheet(rows: unknown[][], monthKey: string): ArRec[] {
  const recs: ArRec[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const name = String(r[1] ?? '').trim()
    if (!name || name === '상호명') continue
    if (/^(소계|총계|합계)|^\*/.test(name)) continue // 집계·어음 행 제외
    const rec: ArRec = {
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
  return recs
}

/** 양식② '거래처별 잔액 명세서' — '소계: N.구분명' 행이 구간을 닫으며 구분을 알려줌 */
function parseStatementSheet(rows: unknown[][], monthKey: string): ArRec[] {
  const recs: ArRec[] = []
  const pending: ArRec[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const name = String(r[0] ?? '').trim()
    if (!name || name === '상호명') continue
    const subtotal = name.match(/^소계\s*:\s*(.+)$/)
    if (subtotal) {
      const category = subtotal[1].replace(/\s+/g, ' ').trim()
      for (const rec of pending) rec.category = category
      recs.push(...pending)
      pending.length = 0
      continue
    }
    if (/^(총계|합계)|^\*/.test(name)) continue
    const rec: ArRec = {
      month_key: monthKey,
      client_name: name,
      category: null,
      opening: num(r[2]),
      sales: num(r[3]),
      collected: num(r[4]),
      balance: num(r[7]), // 매입액(5)·지급액(6)은 미수 아님 — 저장하지 않음
      phone: String(r[8] ?? '').trim() || null,
    }
    if (rec.opening === 0 && rec.sales === 0 && rec.collected === 0 && rec.balance === 0) continue
    pending.push(rec)
  }
  recs.push(...pending) // 마지막 소계 이후 잔여 행 (정상 파일엔 없음)
  return recs
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })

    // 두 양식 자동 인식 → [{monthKey, recs}] 수집
    const parsed: { monthKey: string; recs: ArRec[] }[] = []
    const monthSheets = wb.SheetNames.filter((n) => SHEET_RE.test(n.trim()))
    if (monthSheets.length > 0) {
      for (const sheetName of monthSheets) {
        const m = sheetName.trim().match(SHEET_RE)!
        const monthKey = `20${m[1]}-${m[2].padStart(2, '0')}`
        const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: '' })
        parsed.push({ monthKey, recs: parseMonthSheet(rows, monthKey) })
      }
    } else {
      for (const sheetName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: '' })
        const title = String(rows[0]?.[0] ?? '')
        const m = title.match(STATEMENT_TITLE_RE)
        if (!m) continue
        const monthKey = `${m[1]}-${m[2].padStart(2, '0')}`
        parsed.push({ monthKey, recs: parseStatementSheet(rows, monthKey) })
      }
    }
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "월 시트(예: '26년01월') 또는 '거래처별 잔액 명세서 YYYY.MM월' 양식을 찾지 못했습니다" },
        { status: 400 },
      )
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

    for (const { monthKey, recs } of parsed) {
      // 월 단위 교체 — 재업로드 시 이전 잔여 행(집계 행 등) 제거
      await supabase.from('ar_snapshots').delete().eq('month_key', monthKey)
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
