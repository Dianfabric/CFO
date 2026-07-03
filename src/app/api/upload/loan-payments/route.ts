/**
 * POST /api/upload/loan-payments
 *
 * '대출원금,이자상환내역_YYYY.xlsx' 흡수 — 은행별 시트의
 * 거래일자/월 | 상환원금 | 상환이자 행을 loan_payments 원장으로 저장.
 * OCR 추정 표시(판독불가·확인필요·저신뢰·추정)는 needs_review.
 */
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function parseAmount(v: unknown): number {
  const s = String(v ?? '').replace(/[,\s]/g, '')
  if (!s || s === '-') return 0
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.round(Math.abs(n))
}

/** 'M/D/YY' | 'N월' (연도는 파일/시트에서) → YYYY-MM-DD */
function parseDate(v: unknown, year: number): string | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  const md = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (md) {
    const yy = md[3].length === 2 ? 2000 + Number(md[3]) : Number(md[3])
    return `${yy}-${String(Number(md[1])).padStart(2, '0')}-${String(Number(md[2])).padStart(2, '0')}`
  }
  const mo = s.match(/^(\d{1,2})\s*월/)
  if (mo) return `${year}-${String(Number(mo[1])).padStart(2, '0')}-01`
  return null
}

const REVIEW_RE = /판독|확인\s*필요|확인필요|저신뢰|추정|OCR/i

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
    // 파일명에서 귀속 연도 (기본: 올해)
    const yMatch = file.name.match(/(20\d{2})/)
    const year = yMatch ? Number(yMatch[1]) : new Date().getFullYear()
    const entity = /법인|엔에이아이디|naid/i.test(file.name) ? 'naid' : 'dian'

    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
    const out: {
      entity: string; lender: string; pay_date: string; month_key: string
      principal: number; interest: number; rate: string | null; memo: string | null
      needs_review: boolean; dedup_key: string
    }[] = []
    const seen = new Map<string, number>()

    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
        header: 1, defval: '', raw: false,
      }) as unknown[][]
      // 시트 전체 OCR 경고 여부
      const sheetWarn = rows.slice(0, 5).some((r) => REVIEW_RE.test((r ?? []).join(' ')))
      // 헤더 행: '상환원금' + '상환이자' 포함
      let cols: { date: number; principal: number; interest: number; rate: number; memo: number } | null = null
      for (let i = 0; i < rows.length; i++) {
        const r = (rows[i] ?? []).map((c) => String(c ?? ''))
        const pi = r.findIndex((c) => c.includes('상환원금'))
        const ii = r.findIndex((c) => c.includes('상환이자'))
        if (pi >= 0 && ii >= 0) {
          const ri = r.findIndex((c) => c.includes('이율'))
          const mi = r.findIndex((c) => c.includes('비고'))
          cols = { date: 0, principal: pi, interest: ii, rate: ri, memo: mi }
          continue // 시트에 표가 여러 개일 수 있음 — 헤더 갱신하며 진행
        }
        if (!cols) continue
        const dateStr = parseDate(r[cols.date], year)
        if (!dateStr) continue
        const principal = parseAmount(r[cols.principal])
        const interest = parseAmount(r[cols.interest])
        if (principal === 0 && interest === 0) continue
        const memo = cols.memo >= 0 ? String(r[cols.memo] ?? '').trim() || null : null
        const rate = cols.rate >= 0 ? String(r[cols.rate] ?? '').trim() || null : null
        const needs_review = sheetWarn || REVIEW_RE.test(memo ?? '') || REVIEW_RE.test(rate ?? '')
        const base = `${entity}|${sheetName}|${dateStr}|${principal}|${interest}`
        const n = (seen.get(base) ?? 0) + 1
        seen.set(base, n)
        out.push({
          entity, lender: sheetName, pay_date: dateStr, month_key: dateStr.slice(0, 7),
          principal, interest, rate, memo, needs_review, dedup_key: `${base}|#${n}`,
        })
      }
    }

    if (out.length === 0) {
      return NextResponse.json(
        { error: '상환 내역을 찾지 못했습니다 (헤더에 상환원금/상환이자 필요)' },
        { status: 400 },
      )
    }

    const sb = createServiceClient()
    let created = 0
    for (let i = 0; i < out.length; i += 300) {
      const { data, error } = await sb
        .from('loan_payments')
        .upsert(out.slice(i, i + 300), { onConflict: 'dedup_key', ignoreDuplicates: true })
        .select('dedup_key')
      if (error) {
        const missing = /find the table|does not exist/i.test(error.message)
        return NextResponse.json(
          {
            error: missing
              ? '대출 원장 테이블이 없습니다 — supabase/migrations/2026-07-03_loan_payments.sql 을 실행해 주세요.'
              : error.message,
            parsed: out.length,
          },
          { status: 400 },
        )
      }
      created += (data ?? []).length
    }

    return NextResponse.json({
      success: true,
      type: 'loan_payments',
      created,
      duplicate: out.length - created,
      lenders: [...new Set(out.map((r) => r.lender))],
      totalInterest: out.reduce((s, r) => s + r.interest, 0),
      totalPrincipal: out.reduce((s, r) => s + r.principal, 0),
      needsReview: out.filter((r) => r.needs_review).length,
      year,
      entity,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: '처리 중 오류', detail: msg.slice(0, 300) }, { status: 500 })
  }
}
