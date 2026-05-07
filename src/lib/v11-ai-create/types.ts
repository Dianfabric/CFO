/**
 * AI Create — 상세페이지 에이전트 공유 타입
 *
 * 5-agent pipeline의 각 단계별 산출물 스키마.
 * 파일시스템 저장 (`docs/ai-create/runs/<run_id>/*.json`) 형식과 동일.
 *
 * Agents: section-architect → copy-craftsman → image-prompter
 *         → html-renderer → design-reviewer
 *
 * Phase 1: section-architect + copy-craftsman 만 실제 Claude API 호출.
 * Phase 2 이상: image-prompter + Imagen 4, html-renderer, design-reviewer 추가.
 */

// ============================================================
// 0. 입력 — ProductBrief
// ============================================================

export type DianTier = 'value' | 'mid' | 'premium' | 'luxury'

export type DianDivision = 'sofa' | 'curtain' | 'wall' | 'accessory'

export type DianOccupation =
  | 'interior_project'
  | 'brand_furniture'
  | 'project_furniture'
  | 'commercial_reupholster'
  | 'curtain_styling'
  | 'display'

export type PageLength = 'short' | 'medium' | 'long'

export interface ToneSignature {
  /** 0-10 — 감성/감정 어조 강도 */
  emotional: number
  /** 0-10 — 격식/포멀 정도 */
  formal: number
  /** 0-10 — 시각적 밀도 (이미지·여백 비율) */
  visual_density: number
}

export interface BrandIdentity {
  big_idea: string
  brand_persona: string
  voice_tone: string
  visual_primary_color: string
  visual_secondary_color: string
  visual_accent_color: string
  visual_font_heading: string
  visual_font_body: string
  visual_image_style: string
}

export interface ProductBrief {
  run_id: string
  agent_kind: 'product_detail'
  input_mode: 'wizard' | 'default-fill' | 'manual'

  // 제품 정보
  product_name: string
  category: DianDivision
  material: string
  colors: string[]
  season: string
  estimated_unit_price?: number | null

  // 24셀 + 4티어
  target_occupations: DianOccupation[]
  target_division: DianDivision
  target_tier: DianTier

  // 셀링 포인트
  key_selling_points: string[]

  // 참고 자료
  reference_urls?: string[]
  reference_images?: string[]
  competitor_pages?: string[]

  // 페이지 변주
  page_length: PageLength
  tone: ToneSignature

  // 브랜드 (자동 적용) — 레거시 brief 는 없을 수 있음
  brand_identity?: BrandIdentity

  client_context?: string | null

  // 레거시 brief 는 _meta 가 없을 수 있음
  _meta?: {
    created_at: string
    team_lead_version: string
    skills_used: string[]
  }
}

// ============================================================
// 1. SectionPlan — section-architect 산출
// ============================================================

export type TileKind = 'canvas' | 'tile-dark' | 'parchment'

export type SectionLayout =
  | 'full-bleed'
  | 'centered-text'
  | 'image-left-text-right'
  | 'image-right-text-left'
  | 'gallery-grid'
  | 'stat-row'
  | 'comparison-2col'
  | 'cta-band'
  | 'faq-list'
  | 'testimonial'

export interface ImageBrief {
  placement: 'hero' | 'macro' | 'swatch' | 'lifestyle' | 'comparison' | 'craft'
  aspect: '1:1' | '4:3' | '16:9' | '21:9' | '3:4'
  mood: string
}

export interface CopyConstraints {
  headline_max_chars: number
  body_max_chars: number
  bullet_max_count: number
}

export interface SectionPlanItem {
  section_id: string
  order: number
  tile: TileKind
  frameworks: string[]
  purpose: string
  layout: SectionLayout
  image_brief: ImageBrief | null
  copy_constraints: CopyConstraints
  tier_variation: string
  skip_for_tiers: DianTier[]
  /** luxury 변주 메모 (선택) */
  _luxury_change?: string
  _luxury_change_image?: string
}

export interface SectionPlan {
  total_sections: number
  tile_rhythm: TileKind[]
  tier_applied: DianTier
  skipped_sections?: string[]
  frameworks_distribution?: Record<string, string[]>
  sections: SectionPlanItem[]
  notes: string
  _meta?: Record<string, unknown>
}

// ============================================================
// 2. CopyDeck — copy-craftsman 산출
// ============================================================

export interface CopyHero {
  headline: string
  subheadline: string
  primary_cta: string
  secondary_cta: string | null
}

export interface CopyColorChip {
  name: string
  hex: string
  story: string
}

export interface CopyTableRow {
  label: string
  value: string
}

export interface CopyUseCase {
  designer: string
  space: string
}

export interface CopyQuote {
  text: string
  author: string
  role: string
}

export interface CopySection {
  id: string
  headline: string
  subhead?: string
  body: string
  bullets?: string[]
  image_brief?: string | null
  color_chips?: CopyColorChip[]
  table?: CopyTableRow[]
  use_cases?: CopyUseCase[]
  quote?: CopyQuote
  framework_applied: string
}

export interface CopyMeta {
  seo_title: string
  seo_description: string
  keywords: string[]
  og_title: string
  og_description: string
}

export interface CopyTierAudit {
  forbidden_words_found: string[]
  cta_tier_match: boolean
  _notes: string
}

export interface CopyDeck {
  hero: CopyHero
  sections: CopySection[]
  meta: CopyMeta
  tier_audit: CopyTierAudit
  /** luxury vs premium 비교 메모 (선택) */
  _diff_from_premium?: Record<string, unknown>
}

// ============================================================
// 3. ImagePromptDeck — image-prompter 산출 (Phase 2)
// ============================================================

export interface ImagePromptItem {
  section_id: string
  placement: ImageBrief['placement']
  aspect: ImageBrief['aspect']
  prompt: string
  negative_prompt: string
  style_modifiers: string[]
  fallback_brief: string
}

export interface ImagePromptDeck {
  global_style: {
    photographer_reference: string
    color_temperature: string
    grain: string
    tier_modifier: string
  }
  prompts: ImagePromptItem[]
  notes: string
}

// ============================================================
// 4. ReviewReport — design-reviewer 산출 (Phase 2)
// ============================================================

export interface ReviewReport {
  overall_status: 'pass' | 'pass_with_warnings' | 'fail'
  total_issues: number
  highlights: string[]
  warnings?: string[]
  errors?: string[]
  tier_audit?: Record<string, unknown>
  _meta?: Record<string, unknown>
}

// ============================================================
// 5. RunMeta — 런 인덱스
// ============================================================

export type RunStatus =
  | 'queued'
  | 'running:section'
  | 'running:copy'
  | 'running:image'
  | 'running:render'
  | 'running:review'
  | 'done'
  | 'error'

export interface RunMeta {
  run_id: string
  product_name: string
  target_tier: DianTier
  target_division: DianDivision
  status: RunStatus
  /** 완료된 단계 (filename stem) */
  artifacts: string[]
  /** ISO timestamp */
  created_at: string
  updated_at: string
  /** 에러 메시지 (status=error 일 때) */
  error?: string
}

// ============================================================
// 6. 위저드 폼 — UI에서 직접 입력받는 가벼운 형태
// ============================================================

export interface WizardFormInput {
  product_name: string
  category: DianDivision
  material: string
  colors: string // comma-separated
  season: string
  estimated_unit_price?: number | null

  target_occupations: DianOccupation[]
  target_tier: DianTier

  key_selling_points: string // newline-separated

  page_length: PageLength
  emotional: number
  formal: number
  visual_density: number
}
