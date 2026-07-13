/**
 * 매입 세금계산서 거래처 자동 분류 규칙 (대표 지시 2026-07-13)
 *
 * 한 번 분류하면 같은 거래처(정규화 이름)의 이후 계산서는 자동으로 같은 성격.
 * 혼합 거래처(성격이 엇갈리게 분류된 곳)는 mode='manual' 로 전환되어 매번 물어봄.
 * 적용 시점: ① 세금계산서 업로드 직후 ② 분류 목록 조회(GET) 때 스윕.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { normBizName } from '@/lib/recon'

export type PtaxRule = {
  supplier_key: string
  supplier_name: string
  nature: 'cogs' | 'variable' | 'fixed' | 'other'
  cost_category: string | null
  mode: 'auto' | 'manual'
  hit_count: number
}

export type PtaxRuleApplied = {
  supplier_name: string
  nature: string
  cost_category: string | null
  count: number
}

/** mode='auto' 규칙을 미분류 계산서 전체에 적용. 컬럼/테이블 미생성 시 조용히 건너뜀. */
export async function applyPtaxRules(supabase: SupabaseClient): Promise<PtaxRuleApplied[]> {
  const { data: rules, error: rulesErr } = await supabase
    .from('ptax_supplier_rules')
    .select('supplier_key, supplier_name, nature, cost_category, mode, hit_count')
    .eq('mode', 'auto')
  if (rulesErr || !rules?.length) return []

  const ruleMap = new Map<string, PtaxRule>()
  for (const r of rules as PtaxRule[]) ruleMap.set(r.supplier_key, r)

  const { data: unclassified, error: unclErr } = await supabase
    .from('purchase_tax_invoices')
    .select('approval_number, supplier_name_raw')
    .is('nature', null)
    .limit(1000)
  if (unclErr || !unclassified?.length) return []

  // 규칙별로 대상 승인번호 묶기
  const byRule = new Map<string, string[]>()
  for (const inv of unclassified as { approval_number: string; supplier_name_raw: string }[]) {
    const key = normBizName(inv.supplier_name_raw)
    if (!ruleMap.has(key)) continue
    const arr = byRule.get(key) ?? []
    arr.push(inv.approval_number)
    byRule.set(key, arr)
  }

  const applied: PtaxRuleApplied[] = []
  for (const [key, approvals] of byRule) {
    const rule = ruleMap.get(key)!
    const { error: upErr } = await supabase
      .from('purchase_tax_invoices')
      .update({ nature: rule.nature, cost_category: rule.cost_category, classified_by: 'rule' })
      .in('approval_number', approvals)
    if (upErr) continue
    await supabase
      .from('ptax_supplier_rules')
      .update({ hit_count: rule.hit_count + approvals.length, updated_at: new Date().toISOString() })
      .eq('supplier_key', key)
    applied.push({
      supplier_name: rule.supplier_name,
      nature: rule.nature,
      cost_category: rule.cost_category,
      count: approvals.length,
    })
  }
  return applied
}

/**
 * 사용자 수동 분류 시 규칙 갱신.
 *  - 규칙 없음 → auto 규칙 생성
 *  - auto + 같은 성격 → 카테고리·이름 최신화
 *  - auto + 다른 성격 → 혼합 거래처: mode='manual' 전환 (conflict 반환 — UI 안내용)
 *  - manual → 규칙 건드리지 않음 (매번 물어보는 상태 유지)
 */
export async function upsertPtaxRule(
  supabase: SupabaseClient,
  supplierName: string,
  nature: string,
  costCategory: string | null,
): Promise<{ conflict?: { supplier_name: string; prevNature: string } }> {
  const key = normBizName(supplierName)
  if (!key) return {}

  const { data: existing, error } = await supabase
    .from('ptax_supplier_rules')
    .select('supplier_key, supplier_name, nature, cost_category, mode, hit_count')
    .eq('supplier_key', key)
    .maybeSingle()
  if (error) return {} // 테이블 미생성 등 — 규칙 없이 진행

  if (!existing) {
    await supabase.from('ptax_supplier_rules').insert({
      supplier_key: key,
      supplier_name: supplierName,
      nature,
      cost_category: costCategory,
      mode: 'auto',
    })
    return {}
  }
  const rule = existing as PtaxRule
  if (rule.mode === 'manual') return {} // 혼합 확정 — 유지

  if (rule.nature === nature) {
    await supabase
      .from('ptax_supplier_rules')
      .update({ supplier_name: supplierName, cost_category: costCategory, updated_at: new Date().toISOString() })
      .eq('supplier_key', key)
    return {}
  }
  // 성격이 엇갈림 → 혼합 거래처로 자동 전환
  await supabase
    .from('ptax_supplier_rules')
    .update({ mode: 'manual', updated_at: new Date().toISOString() })
    .eq('supplier_key', key)
  return { conflict: { supplier_name: rule.supplier_name, prevNature: rule.nature } }
}
