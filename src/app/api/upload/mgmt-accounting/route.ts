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
  source: 'card' | 'bank' | 'personal' | 'summary' | 'invoice'
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

    // ── '관리회계' 명세 시트 (정본, 대표 결정 2026-07-10) ──
    // 고정비 명세(임대료·급여·이자...) + 변동비 입력칸을 source='summary' 로 흡수.
    // nature: 법인 몫 → '법인'(엔에이아이디 대기) / 대출이자 → '영업외비용' /
    //         원금상환 → '원금상환'(손익 제외) / 변동 운임 → '운임'(인보이스 중복 제외) / 나머지 '판관비'
    const summarySheet = sheet('관리회계')
    const summaryMonths = new Set<string>()
    let summaryFixed = 0
    let summaryVar = 0
    {
      const fn = file.name.match(/20(\d{2})\s*-\s*0?(\d{1,2})/)
      const fileMonth = fn ? `20${fn[1]}-${String(Number(fn[2])).padStart(2, '0')}` : null
      for (const r of summarySheet) {
        const type = str(r[2])
        if (type !== '고정' && type !== '변동') continue
        const vendor = str(r[1])
        const amount = parseAmount(r[3])
        if (!vendor || amount <= 0) continue
        const rowDate = parseDate(r[0])
        // 고정 명세는 '한번 입력 후 유지'라 날짜가 과거일 수 있음 → 파일명 월 우선
        const month =
          type === '고정'
            ? (fileMonth ?? rowDate?.slice(0, 7) ?? new Date().toISOString().slice(0, 7))
            : (rowDate?.slice(0, 7) ?? fileMonth ?? new Date().toISOString().slice(0, 7))
        const category = str(r[4]) || null
        const major = str(r[5]) || null
        const isCorp = /법인/.test(vendor)
        const isPrincipal = /원금상환/.test(vendor) || (category ?? '').includes('원금상환')
        const isInterest = (category ?? '').includes('대출이자') || ((major ?? '').includes('금융') && /이자/.test(vendor))
        const isFreight = type === '변동' && /운임|운송/.test(`${vendor} ${category ?? ''}`)
        const nature = isCorp ? '법인' : isPrincipal ? '원금상환' : isInterest ? '영업외비용' : isFreight ? '운임' : '판관비'
        push({
          source: 'summary',
          entry_date: type === '고정' ? `${month}-01` : (rowDate ?? `${month}-01`),
          vendor, amount, flow: 'out',
          category, major, cost_type: type, discretionary: null, nature,
          card_name: null, memo: null,
        })
        summaryMonths.add(month)
        if (type === '고정') summaryFixed += amount
        else summaryVar += amount
      }
    }

    // ── '세금계산서 분류' 시트 — 비용성격='매출원가' 흡수 (대표 지시 2026-07-13) ──
    // 대상: 가공비(방염·염색·임가공·의장 등) + TMS 단가표에 없는 원단의 원가.
    // 제외: 세관·매입(해외) 행 — 관세·수입세금 인보이스로 이미 반영 (이중계상 방지).
    // 손익 반영은 pnl/trend 에서 2026-07-01 발행분부터 (1~6월 확정 손익 동결).
    const taxSheet = sheet('세금계산서 분류')
    const invoiceMonths = new Set<string>()
    let invoiceCogs = 0
    let invoiceCount = 0
    let invoiceSkipped = 0
    {
      const hi = taxSheet.findIndex(
        (r) => r.some((c) => str(c) === '비용성격') && r.some((c) => str(c) === '작성일자'),
      )
      if (hi >= 0) {
        const header = taxSheet[hi].map((c) => str(c))
        const cDate = header.indexOf('작성일자')
        const cVendor = header.indexOf('공급자 상호')
        const cItem = header.indexOf('대표 품목')
        const cSupply = header.indexOf('공급가액')
        const cCat = header.indexOf('카테고리')
        const cType = header.indexOf('변동/고정')
        const cMajor = header.indexOf('대분류')
        const cNat = header.indexOf('비용성격')
        for (let i = hi + 1; i < taxSheet.length; i++) {
          const r = taxSheet[i]
          if (str(r[cNat]) !== '매출원가') continue
          const date = parseDate(r[cDate])
          const vendor = str(r[cVendor])
          const amount = parseAmount(r[cSupply])
          if (!date || !vendor || amount <= 0) continue
          const category = str(r[cCat]) || null
          if (/세관/.test(vendor) || (category ?? '').includes('매입(해외)')) { invoiceSkipped++; continue }
          push({
            source: 'invoice', entry_date: date, vendor, amount, flow: 'out',
            category, major: str(r[cMajor]) || null, cost_type: str(r[cType]) || null,
            discretionary: null, nature: '매출원가', card_name: null, memo: str(r[cItem]) || null,
          })
          invoiceMonths.add(date.slice(0, 7))
          invoiceCogs += amount
          invoiceCount++
        }
      }
    }

    if (out.length === 0) {
      return NextResponse.json({ error: '관리회계 시트에서 데이터를 찾지 못했습니다' }, { status: 400 })
    }

    // ── 저장 — upsert(ignoreDuplicates) 로 재업로드 안전 + 신규만 카운트 ──
    const sb = createServiceClient()
    // 명세(summary)는 금액이 매달 바뀌므로 해당 월을 교체(delete→insert)
    if (summaryMonths.size > 0) {
      await sb.from('mgmt_ledger').delete().eq('source', 'summary').in('month_key', [...summaryMonths])
    }
    // 계산서 원가(invoice)도 같은 방식으로 월 교체 — 재업로드 안전
    if (invoiceMonths.size > 0) {
      await sb.from('mgmt_ledger').delete().eq('source', 'invoice').in('month_key', [...invoiceMonths])
    }
    let created = 0
    for (let i = 0; i < out.length; i += 300) {
      const { data, error } = await sb
        .from('mgmt_ledger')
        .upsert(out.slice(i, i + 300), { onConflict: 'dedup_key', ignoreDuplicates: true })
        .select('dedup_key')
      if (error) {
        const missing = /find the table|does not exist/i.test(error.message)
        const checkFail = /check constraint/i.test(error.message)
        return NextResponse.json(
          {
            error: missing
              ? '관리회계 원장 테이블이 없습니다 — supabase/migrations/2026-07-03_mgmt_ledger.sql 을 실행해 주세요.'
              : checkFail
                ? "source 제약 미갱신 — supabase/migrations/2026-07-13_mgmt_invoice_source.sql 을 실행해 주세요."
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
      summary: { months: [...summaryMonths].sort(), fixed: summaryFixed, variable: summaryVar },
      // 세금계산서 분류 시트의 매출원가 — 가공·미등록 원단 (세관·해외매입 제외)
      invoiceCogs: { months: [...invoiceMonths].sort(), count: invoiceCount, sum: invoiceCogs, skippedCustoms: invoiceSkipped },
      months,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: '처리 중 오류', detail: msg.slice(0, 300) }, { status: 500 })
  }
}
