/**
 * 매입 세금계산서 성격 분류 (대표 지시 2026-07-13)
 *
 * GET  ?month=YYYY-MM (선택) &view=classified (선택)
 *   — 기본: 규칙 자동 분류 스윕 후 미분류 목록 + 카테고리 + 규칙 목록 + 자동 적용 내역
 *   — view=classified: 분류 완료 내역 (재분류·자동 분류 검수용)
 * POST { approval_number, nature: 'cogs'|'variable'|'fixed'|'other', cost_category? }
 *   — 분류 저장 + 거래처 규칙 갱신 (같은 거래처 다음 계산서부터 자동 분류).
 *     이전과 다른 성격으로 분류하면 규칙이 '혼합(수동)'으로 전환 — 매번 물어봄.
 *
 * 분류된 공급가는 발행일 기준 본체 손익 반영 (other 는 미반영).
 * 관리회계 명세에 이미 있는 지출(임대료·통신 등)은 이중계상 방지를 위해 other 권장.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { applyPtaxRules, upsertPtaxRule } from '@/lib/ptax-rules'

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
    const view = req.nextUrl.searchParams.get('view') // 'classified' | null=미분류
    const supabase = createServiceClient()

    // 규칙 자동 분류 스윕 (미분류 조회 전에 — 새로 들어온 계산서에 규칙 적용)
    let autoApplied: Awaited<ReturnType<typeof applyPtaxRules>> = []
    if (view !== 'classified') {
      try {
        autoApplied = await applyPtaxRules(supabase)
      } catch { /* 규칙 테이블 미생성 — 무시 */ }
    }

    let q = supabase
      .from('purchase_tax_invoices')
      .select(
        'approval_number, issue_date, supplier_name_raw, supply_amount, item_name, status, nature, cost_category, classified_by',
        { count: 'exact' },
      )
      .order('issue_date', { ascending: false })
      .limit(300)
    q = view === 'classified' ? q.not('nature', 'is', null) : q.is('nature', null)
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

    // 규칙 목록 (관리 UI 용)
    let rules: unknown[] = []
    try {
      const { data: ruleRows } = await supabase
        .from('ptax_supplier_rules')
        .select('supplier_key, supplier_name, nature, cost_category, mode, hit_count')
        .order('updated_at', { ascending: false })
        .limit(300)
      rules = ruleRows ?? []
    } catch { /* 테이블 미생성 — 빈 목록 */ }

    return NextResponse.json({
      invoices: data ?? [],
      total: count ?? (data?.length ?? 0),
      categories: cats,
      rules,
      autoApplied,
    })
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
    const costCategory =
      b.nature === 'variable' || b.nature === 'fixed' ? (b.cost_category?.trim() || null) : null
    const { data: updated, error } = await supabase
      .from('purchase_tax_invoices')
      .update({ nature: b.nature, cost_category: costCategory, classified_by: 'user' })
      .eq('approval_number', b.approval_number)
      .select('supplier_name_raw')
    if (error) {
      if (/column .*nature|does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json(
          { error: 'nature 컬럼이 없습니다 — supabase/migrations/2026-07-13_ptax_nature.sql 실행 필요' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 거래처 규칙 갱신 — 다음 계산서부터 자동 분류 (성격 엇갈리면 혼합 전환)
    let conflict: { supplier_name: string; prevNature: string } | undefined
    const supplierName = updated?.[0]?.supplier_name_raw
    if (supplierName) {
      try {
        const r = await upsertPtaxRule(supabase, supplierName, b.nature, costCategory)
        conflict = r.conflict
      } catch { /* 규칙 테이블 미생성 — 분류 자체는 저장됨 */ }
    }

    return NextResponse.json({ ok: true, conflict: conflict ?? null })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '분류 실패' }, { status: 500 })
  }
}
