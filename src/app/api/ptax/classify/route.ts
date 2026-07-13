/**
 * 매입 세금계산서 성격 분류 (대표 지시 2026-07-13)
 *
 * GET  ?month=YYYY-MM (선택) — 미분류 매입 계산서 목록 + 관리회계 대분류 카테고리
 * POST { approval_number, nature: 'cogs'|'variable'|'fixed'|'other', cost_category? }
 *
 * 분류된 공급가는 발행일 기준 본체 손익 반영 (other 는 미반영).
 * 관리회계 명세에 이미 있는 지출(임대료·통신 등)은 이중계상 방지를 위해 other 권장.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NATURES = ['cogs', 'variable', 'fixed', 'other'] as const

// 관리회계 대분류 폴백 (mgmt_ledger 비어있을 때)
const FALLBACK_CATS = {
  fixed: ['임대료/관리비', '인건비', '차량·운송비', '통신·전기', '운영유지비', '외주용역', '기타 고정비'],
  variable: ['마케팅·광고', '교통·유류', '교육·복리', '운영유지비', '접대·회식', '기타 변동비'],
}

export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get('month') // YYYY-MM | null=전체
    const supabase = createServiceClient()

    let q = supabase
      .from('purchase_tax_invoices')
      .select('approval_number, issue_date, supplier_name_raw, supply_amount, item_name, status, nature', { count: 'exact' })
      .is('nature', null)
      .order('issue_date', { ascending: false })
      .limit(300)
    if (month) {
      const [y, m] = month.split('-').map(Number)
      const end = new Date(y, m, 0).getDate()
      q = q.gte('issue_date', `${month}-01`).lte('issue_date', `${month}-${String(end).padStart(2, '0')}`)
    }
    const { data, error, count } = await q
    if (error) {
      if (/column .*nature|does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({ invoices: [], columnMissing: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 카테고리 목록 — 관리회계 명세 대분류 (없으면 폴백)
    const cats = { fixed: [...FALLBACK_CATS.fixed], variable: [...FALLBACK_CATS.variable] }
    try {
      const { data: majors } = await supabase
        .from('mgmt_ledger')
        .select('major, cost_type')
        .eq('source', 'summary')
        .eq('nature', '판관비')
        .not('major', 'is', null)
        .limit(2000)
      const fx = new Set<string>(), vr = new Set<string>()
      for (const r of (majors ?? []) as { major: string; cost_type: string }[]) {
        if (r.cost_type === '고정') fx.add(r.major)
        else if (r.cost_type === '변동') vr.add(r.major)
      }
      if (fx.size) cats.fixed = [...fx].sort()
      if (vr.size) cats.variable = [...vr].sort()
    } catch { /* 폴백 사용 */ }

    return NextResponse.json({ invoices: data ?? [], total: count ?? (data?.length ?? 0), categories: cats })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.approval_number || !NATURES.includes(b.nature)) {
      return NextResponse.json({ error: 'approval_number, nature(cogs|variable|fixed|other) 필요' }, { status: 400 })
    }
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('purchase_tax_invoices')
      .update({
        nature: b.nature,
        cost_category:
          b.nature === 'variable' || b.nature === 'fixed' ? (b.cost_category?.trim() || null) : null,
      })
      .eq('approval_number', b.approval_number)
    if (error) {
      if (/column .*nature|does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json(
          { error: 'nature 컬럼이 없습니다 — supabase/migrations/2026-07-13_ptax_nature.sql 실행 필요' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '분류 실패' }, { status: 500 })
  }
}
