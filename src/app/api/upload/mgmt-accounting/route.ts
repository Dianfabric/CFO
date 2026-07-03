/**
 * POST /api/upload/mgmt-accounting
 *
 * '디안 관리 회계 YYYY-MM.xlsx' 흡수 — 카드내역/통장 입출금/개인사용
 * 분류 시트를 mgmt_ledger 원장으로 저장 (dedup_key 로 재업로드 안전).
 * 월별(~06) / 주별(07~) 파일 모두 동일 처리.
 */
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface LedgerRow {
  source: 'card' | 'bank' | 'personal'
  entry_date: string
  month_key: string
  vendor: string
  amount: number
  flow: 'in' | 'out'
  category: string | null
  major: string | null
  cost_type: string | null
  discretionary: string | null
  nature: string | null
  card_name: string | null
  memo: string | null
  dedup_key: string
}

function parseAmount(v: unknown): number {
  const s = String(v ?? '').replace(/[,\s]/g, '')
  if (!s || s === '-') return 0
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.round(Math.abs(n))
}

/** 'M/D/YY' | 'M/D/YYYY[ H:MM]' | Excel 시리얼 → YYYY-MM-DD */
function parseDate(v: unknown): string | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000)
    return d.toISOString().slice(0, 10)
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (m) {
    const yy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    return `${yy}-${String(Number(m[1])).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  return null
}

function str(v: unknown): string {
  return String(v ?? '').trim()
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
    const sheet = (name: string): unknown[][] =>
      wb.Sheets[name]
        ? (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false }) as unknown[][])
        : []

    const out: LedgerRow[] = []
    const seen = new Map<string, number>()
    const push = (r: Omit<LedgerRow, 'dedup_key' | 'month_key'>) => {
      const base = `${r.source}|${r.entry_date}|${r.vendor}|${r.amount}|${r.category ?? ''}`
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      out.push({ ...r, month_key: r.entry_date.slice(0, 7), dedup_key: `${base}|#${n}` })
    }

    // ── 카드내역 분류 ──
    const card = sheet('카드내역 분류')
    let counts = { card: 0, bank: 0, personal: 0 }
    {
      const hi = card.findIndex((r) => str(r[0]) === '이용일' && str(r[2]) === '가맹점명')
      for (let i = hi + 1; hi >= 0 && i < card.length; i++) {
        const r = card[i]
        const date = parseDate(r[0])
        const vendor = str(r[2])
        const amount = parseAmount(r[3])
        if (!date || !vendor || amount <= 0) continue
        push({
          source: 'card', entry_date: date, vendor, amount, flow: 'out',
          category: str(r[5]) || null, major: str(r[6]) || null,
          cost_type: str(r[7]) || null, discretionary: str(r[8]) || null,
          nature: str(r[9]) || null, card_name: str(r[1]) || null, memo: str(r[11]) || null,
        })
        counts.card++
      }
    }

    // ── 통장 입출금 분류 ──
    const bank = sheet('통장 입출금 분류')
    {
      const hi = bank.findIndex((r) => str(r[0]) === '순번')
      for (let i = hi + 1; hi >= 0 && i < bank.length; i++) {
        const r = bank[i]
        const date = parseDate(r[1])
        const vendor = str(r[6])
        const outAmt = parseAmount(r[3])
        const inAmt = parseAmount(r[4])
        if (!date || !vendor || (outAmt <= 0 && inAmt <= 0)) continue
        push({
          source: 'bank', entry_date: date, vendor,
          amount: outAmt > 0 ? outAmt : inAmt,
          flow: outAmt > 0 ? 'out' : 'in',
          category: str(r[7]) || null, major: str(r[8]) || null,
          cost_type: str(r[9]) || null, discretionary: str(r[10]) || null,
          nature: str(r[11]) || null, card_name: null, memo: null,
        })
        counts.bank++
      }
    }

    // ── 개인사용 분류 (회사 비용에서 제외 대상 표시용) ──
    const personal = sheet('개인사용 분류')
    {
      const hi = personal.findIndex((r) => str(r[0]) === '이용일')
      for (let i = hi + 1; hi >= 0 && i < personal.length; i++) {
        const r = personal[i]
        const date = parseDate(r[0])
        const vendor = str(r[2])
        const amount = parseAmount(r[3])
        if (!date || !vendor || amount <= 0) continue
        push({
          source: 'personal', entry_date: date, vendor, amount, flow: 'out',
          category: str(r[4]) || null, major: null,
          cost_type: str(r[5]) || null, discretionary: str(r[6]) || null,
          nature: null, card_name: str(r[1]) || null, memo: null,
        })
        counts.personal++
      }
    }

    if (out.length === 0) {
      return NextResponse.json({ error: '관리회계 시트에서 데이터를 찾지 못했습니다' }, { status: 400 })
    }

    // ── 저장 — upsert(ignoreDuplicates) 로 재업로드 안전 + 신규만 카운트 ──
    const sb = createServiceClient()
    let created = 0
    for (let i = 0; i < out.length; i += 300) {
      const { data, error } = await sb
        .from('mgmt_ledger')
        .upsert(out.slice(i, i + 300), { onConflict: 'dedup_key', ignoreDuplicates: true })
        .select('dedup_key')
      if (error) {
        const missing = /find the table|does not exist/i.test(error.message)
        return NextResponse.json(
          {
            error: missing
              ? '관리회계 원장 테이블이 없습니다 — supabase/migrations/2026-07-03_mgmt_ledger.sql 을 실행해 주세요.'
              : error.message,
            parsed: counts,
          },
          { status: 400 },
        )
      }
      created += (data ?? []).length
    }

    const months = [...new Set(out.map((r) => r.month_key))].sort()
    return NextResponse.json({
      success: true,
      type: 'mgmt_ledger',
      created,
      duplicate: out.length - created,
      card: counts.card,
      bank: counts.bank,
      personal: counts.personal,
      months,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: '처리 중 오류', detail: msg.slice(0, 300) }, { status: 500 })
  }
}
