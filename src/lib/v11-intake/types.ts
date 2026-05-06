/**
 * 입고 워크플로우 (#10) — 공통 타입
 */

export type Stage =
  | 'arrived'
  | 'evaluating'
  | 'planned'
  | 'in_action'
  | 'tracking'
  | 'archived'

export type Division = 'sofa' | 'curtain' | 'wall' | 'accessory'

export type Tier = 'value' | 'mid' | 'premium' | 'luxury'

export type Occupation =
  | 'interior_project'
  | 'brand_furniture'
  | 'project_furniture'
  | 'commercial_reupholster'
  | 'curtain_styling'
  | 'display'

export type ActionKind =
  | 'manual'
  | 'sales_material'
  | 'marketing_content'
  | 'sample_send'
  | 'wam'
  | 'slack'
  | 'showroom'
  | 'asset'

export interface AIEvaluation {
  recommended_division: Division
  recommended_tier: Tier
  recommended_occupations: Occupation[]
  competitive_score: number
  differentiator: string
  reasoning?: string
}

export interface EvaluateInput {
  name: string
  supplier?: string | null
  source: 'domestic' | 'overseas'
  material?: string | null
  colors?: string[]
  estimated_unit_price?: number | null
  notes?: string | null
}
