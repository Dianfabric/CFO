/**
 * 영업자료 자동생성 (#9) — 공통 타입
 */

export type Tier = 'value' | 'mid' | 'premium' | 'luxury'

export type Occupation =
  | 'interior_project'
  | 'brand_furniture'
  | 'project_furniture'
  | 'commercial_reupholster'
  | 'curtain_styling'
  | 'display'

export type SlideKind =
  | 'cover'
  | 'hook'
  | 'big_idea'
  | 'material_detail'
  | 'color_palette'
  | 'use_case'
  | 'comparison'
  | 'value_proposition'
  | 'scarcity'
  | 'cta'
  | 'story'
  | 'guide'
  | 'plan'
  | 'success'
  | 'authority'
  | 'social_proof'
  | 'closing'

export interface Slide {
  kind: SlideKind
  headline: string
  subhead?: string
  body?: string
  bullets?: string[]
  image_brief?: string
  caption?: string
}

export interface VideoCut {
  time_range: string
  voiceover?: string
  subtitle?: string
  image_brief?: string
  bgm_mood?: string
}

export interface VideoScript {
  duration_sec: number
  cuts: VideoCut[]
  bgm_mood?: string
  closing_text?: string
}

export interface GeneratedMaterial {
  title: string
  slides: Slide[]
  video_scripts: VideoScript[]
  meta?: {
    framework_keys?: string[]
    target_tier?: Tier
    target_occupation?: Occupation
    target_persona?: string
  }
}

export interface ToneSettings {
  emotional: number // 0~10 (정보 ↔ 감성)
  formal: number // 0~10 (친근 ↔ 격조)
  visual_density: number // 0~10 (텍스트 ↔ 비주얼)
}

export interface BrandIdentity {
  big_idea?: string | null
  brand_persona?: string | null
  voice_tone?: string | null
  visual_primary_color?: string | null
  visual_secondary_color?: string | null
  visual_accent_color?: string | null
  visual_font_heading?: string | null
  visual_font_body?: string | null
  visual_image_style?: string | null
}

export interface FrameworkRow {
  id: number
  key: string
  name: string
  summary: string | null
  principles: string[]
  recommended_tiers: Tier[]
  recommended_occupations: Occupation[]
  prompt_template: string | null
}

export interface AssetRef {
  id: number
  kind: 'image' | 'pdf' | 'url' | 'text'
  title: string | null
  description?: string | null
  external_url?: string | null
  body_text?: string | null
  source: 'domestic' | 'overseas'
}

export interface GenerateInput {
  title: string
  target_tier?: Tier
  target_occupation?: Occupation
  target_persona?: string
  product_name: string
  product_attrs?: {
    material?: string
    colors?: string[]
    season?: string
    estimated_unit_price?: number | null
    category?: string
  }
  framework_keys: string[]
  tone: ToneSettings
  slide_count: number
  video_durations: number[]
  brand?: BrandIdentity | null
  source_text?: string
  reference_urls?: string[]
  reference_assets?: AssetRef[]
}
