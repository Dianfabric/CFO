/**
 * AI Create — 상세페이지 에이전트 오케스트레이터
 *
 * Phase 1: section-architect → copy-craftsman 2단계 파이프라인.
 * 실제 Anthropic Claude API 호출.
 *
 * Phase 2 (예정): + image-prompter (Imagen 4) + html-renderer + design-reviewer.
 *
 * 모든 함수는 서버 전용. ANTHROPIC_API_KEY 필요.
 */
import 'server-only'
import { getAnthropic, MODEL, extractText, parseJsonResponse } from '@/lib/anthropic'
import type {
  ProductBrief,
  SectionPlan,
  CopyDeck,
  DianTier,
} from './types'

// ============================================================
// 공통 — Claude 호출 + 견고한 JSON 파싱
// ============================================================

interface CallClaudeOpts {
  system: string
  user: string
  /** 출력 토큰 상한 (기본 8000) */
  maxTokens?: number
  /** 모델 오버라이드 */
  model?: string
}

async function callClaudeJSON<T>(opts: CallClaudeOpts): Promise<T> {
  const client = getAnthropic()
  const message = await client.messages.create({
    model: opts.model ?? MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [
      {
        role: 'user',
        content: opts.user,
      },
    ],
  })

  const text = extractText(message)
  const parsed = parseJsonResponse<T>(text)
  if (!parsed) {
    throw new Error(
      `Claude 응답을 JSON 으로 파싱하지 못했습니다.\n응답 일부:\n${text.slice(0, 500)}`,
    )
  }
  return parsed
}

// ============================================================
// 티어별 정책 요약 (프롬프트에 주입)
// ============================================================

const TIER_POLICY: Record<DianTier, string> = {
  value:
    '저가 (value) — 마진 20-30%. 광고에 가격 강조 가능, 9.99 같은 문턱가격 OK. 헤드라인 명확·실용적. CTA 2-3개. "지금 구매·할인" OK.',
  mid:
    '중가 (mid) — 마진 35-45%. 제한적 할인 가능. 헤드라인은 가치+실용. CTA 2개. 가격 노출.',
  premium:
    '프리미엄 (premium) — 마진 50-65%. 특가·세일 회피, 가치 강조. 헤드라인 Apple-tight (10-14자), 마침표로 끝. CTA 2개 (샘플/미팅). 가격 노출은 신중.',
  luxury:
    '럭셔리 (luxury) — 마진 70-85%. 할인·세일·특가 절대 금지. "Price upon request". 헤드라인 한 단어 또는 6자 이내. CTA 1개 (Reserve a Sample). 가격 미노출. 절제·여백·시적 어휘.',
}

const FORBIDDEN_LUXURY_WORDS = [
  '할인',
  '특가',
  '세일',
  '이벤트',
  '9.99',
  '지금 구매',
  '원',
  '%',
  'OFF',
]

// ============================================================
// Agent 1: section-architect
// ============================================================

const SECTION_ARCHITECT_SYSTEM = `당신은 디안(Dian) 의 상세페이지 섹션 아키텍트입니다.

디안은 한국 B2B 프리미엄 인테리어 원단 유통·큐레이션 기업입니다. 멀티티어 (value/mid/premium/luxury) 라인을 가지며, 인테리어 디자이너·스튜디오·가구사가 주 고객입니다.

당신의 임무: 입력된 ProductBrief 를 받아, Apple 스타일의 alternating tile 리듬을 가진 섹션 계획(JSON)을 만들어 반환하는 것.

## Tile 리듬 규칙
- 3종 타일: canvas (밝은 베이지), tile-dark (디안 다크 #272729), parchment (살짝 더 따뜻한 베이지)
- alternating: 같은 톤이 3개 연속되지 않게 분배
- premium 은 다크 타일 3-4개, luxury 는 4-5개 (시작·끝을 다크로)

## 표준 섹션 카탈로그 (premium 기준 13개)
1. cover — peak-end, 헤드라인 + 풀폭 비주얼
2. big-idea — russell-hook, 한 문장 가치 제안 (다크 타일)
3. material — sensory-integration, 마크로샷 + 촉감 카피
4. color — cognitive-ease, 컬러칩 갤러리
5. specs — authority-cialdini, 사양 표
6. use-case — social-proof + mirror-neuron, 시공 사례
7. designer-voice — mirror-neuron, 디자이너 인용 (다크 타일)
8. compare — cognitive-ease, before/after 2-col (luxury 는 생략 가능)
9. lifestyle — sensory-integration + peak, 분위기 풀-블리드
10. craftsmanship — storybrand, 장인 스토리 (luxury 시그니처)
11. authority — authority-cialdini, 인증·보증
12. faq — cognitive-ease (luxury 는 생략 가능)
13. cta-closing — peak-end + scarcity, 마지막 CTA

## 티어별 변주
- value/mid: 13 섹션 모두 사용 가능, 가격 노출, CTA 2-3개
- premium: 13 섹션, 헤드라인 절제, CTA 2개 (샘플/미팅)
- luxury: 11 섹션 (08 compare, 12 faq 생략), 다크 타일 4-5개, CTA 1개, 가격 미노출, "Price upon request"

## 출력 형식
유효한 JSON 만 반환하세요. 코드펜스 없이, 다른 텍스트 없이, 오직 JSON 객체.

스키마:
{
  "total_sections": number,
  "tile_rhythm": ["canvas" | "tile-dark" | "parchment", ...],  // total_sections 길이
  "tier_applied": "value" | "mid" | "premium" | "luxury",
  "skipped_sections": [string, ...],
  "frameworks_distribution": { "framework_name": ["section_id", ...] },
  "sections": [
    {
      "section_id": string,            // cover, big-idea, material, color, ...
      "order": number,                 // 1부터
      "tile": "canvas" | "tile-dark" | "parchment",
      "frameworks": [string, ...],     // peak-end, russell-hook, ...
      "purpose": string,               // 이 섹션의 역할 1-2 문장
      "layout": "full-bleed" | "centered-text" | "image-left-text-right" | "image-right-text-left" | "gallery-grid" | "stat-row" | "comparison-2col" | "cta-band" | "faq-list" | "testimonial",
      "image_brief": null | { "placement": "hero" | "macro" | "swatch" | "lifestyle" | "comparison" | "craft", "aspect": "1:1" | "4:3" | "16:9" | "21:9" | "3:4", "mood": string },
      "copy_constraints": { "headline_max_chars": number, "body_max_chars": number, "bullet_max_count": number },
      "tier_variation": string,        // 티어별 변주 메모
      "skip_for_tiers": [DianTier, ...]
    }
  ],
  "notes": string
}`

function buildSectionArchitectUser(brief: ProductBrief): string {
  return `다음 ProductBrief 를 받아 섹션 계획(SectionPlan JSON)을 만들어 주세요.

티어 정책:
${TIER_POLICY[brief.target_tier]}

ProductBrief:
\`\`\`json
${JSON.stringify(
  {
    product_name: brief.product_name,
    category: brief.category,
    material: brief.material,
    colors: brief.colors,
    season: brief.season,
    target_occupations: brief.target_occupations,
    target_division: brief.target_division,
    target_tier: brief.target_tier,
    key_selling_points: brief.key_selling_points,
    page_length: brief.page_length,
    tone: brief.tone,
    brand_identity: brief.brand_identity,
  },
  null,
  2,
)}
\`\`\`

요구사항:
1. tier_applied = "${brief.target_tier}"
2. 페이지 길이 "${brief.page_length}" 에 맞게 섹션 수 조정 (short=7, medium=10, long=13 정도)
3. luxury 인 경우 08 compare + 12 faq 생략, 다크 타일 4-5개, layout 에 full-bleed 더 많이
4. tile_rhythm 은 같은 톤 3연속 금지
5. JSON 만 반환 (코드펜스·설명 없이)`
}

export async function runSectionArchitect(brief: ProductBrief): Promise<SectionPlan> {
  return callClaudeJSON<SectionPlan>({
    system: SECTION_ARCHITECT_SYSTEM,
    user: buildSectionArchitectUser(brief),
    maxTokens: 6000,
  })
}

// ============================================================
// Agent 2: copy-craftsman
// ============================================================

const COPY_CRAFTSMAN_SYSTEM = `당신은 디안(Dian) 의 상세페이지 카피라이터입니다.

디안의 톤: "세련된 전문가" — 격조 있고 신뢰감 있게. 지나치게 가볍지 않으면서 창의적 영감.
주 고객: 인테리어 디자이너·스튜디오·가구사·스타일리스트.

당신의 임무: SectionPlan 과 ProductBrief 를 받아, 각 섹션의 한국어 카피(CopyDeck JSON)를 작성하는 것.

## 카피 원칙
- Apple-tight: 헤드라인은 짧고 마침표로 끝 ("결의 무게.", "공간이 입을 옷.")
- 본문은 1-3문장, 호흡 단정
- 형용사 연쇄 회피, 명사+동사 위주
- 시즌·소재·산지 등 사실 한 가지를 반드시 포함

## 티어별 톤
- value: 헤드라인 명확·실용 ("매일 쓰는 결, 매일 다른 인상."), 가격·할인 노출 OK, CTA 2개
- mid: 가치 + 실용 균형, 가격 노출, CTA 2개
- premium: 절제 + 시적 ("빛에 가장 가까운 결."), 가격은 마지막에 또는 미노출, CTA 2개 (샘플 신청 + 디자인 미팅)
- luxury: 한 단어 헤드라인 가능 ("결.", "셋"), "Price upon request", CTA 1개 (Reserve a Sample)
  - 금지 어휘: 할인, 특가, 세일, 이벤트, 9.99, 지금 구매, 원

## 컬러칩 처리 (color 섹션)
각 컬러에 시적 story 를 붙이세요 (예: "이보리 — 여명", "그레이지 — 안개")

## 출력 형식
유효한 JSON 만. 코드펜스 없이.

스키마:
{
  "hero": { "headline": string, "subheadline": string, "primary_cta": string, "secondary_cta": string | null },
  "sections": [
    {
      "id": string,                    // SectionPlan 의 section_id 와 일치
      "headline": string,
      "subhead"?: string,
      "body": string,
      "bullets"?: [string, ...],
      "image_brief"?: string | null,   // 이미지가 있는 섹션은 brief 한국어로
      "color_chips"?: [{ "name": string, "hex": string, "story": string }, ...],
      "table"?: [{ "label": string, "value": string }, ...],
      "use_cases"?: [{ "designer": string, "space": string }, ...],
      "quote"?: { "text": string, "author": string, "role": string },
      "framework_applied": string
    }
  ],
  "meta": {
    "seo_title": string,
    "seo_description": string,
    "keywords": [string, ...],
    "og_title": string,
    "og_description": string
  },
  "tier_audit": {
    "forbidden_words_found": [string, ...],
    "cta_tier_match": boolean,
    "_notes": string
  }
}`

function buildCopyCraftsmanUser(brief: ProductBrief, plan: SectionPlan): string {
  return `다음 ProductBrief + SectionPlan 을 받아 CopyDeck JSON 을 만들어 주세요.

티어 정책:
${TIER_POLICY[brief.target_tier]}

${
  brief.target_tier === 'luxury'
    ? `금지 어휘 (luxury): ${FORBIDDEN_LUXURY_WORDS.join(', ')}\n→ 모든 카피에서 이 어휘를 절대 사용하지 마세요.\n`
    : ''
}

ProductBrief:
\`\`\`json
${JSON.stringify(
  {
    product_name: brief.product_name,
    material: brief.material,
    colors: brief.colors,
    season: brief.season,
    target_tier: brief.target_tier,
    estimated_unit_price: brief.estimated_unit_price,
    key_selling_points: brief.key_selling_points,
    brand_identity: brief.brand_identity,
  },
  null,
  2,
)}
\`\`\`

SectionPlan (각 섹션의 copy_constraints 를 반드시 준수):
\`\`\`json
${JSON.stringify(
  {
    sections: plan.sections.map((s) => ({
      section_id: s.section_id,
      order: s.order,
      tile: s.tile,
      frameworks: s.frameworks,
      purpose: s.purpose,
      layout: s.layout,
      copy_constraints: s.copy_constraints,
      tier_variation: s.tier_variation,
    })),
  },
  null,
  2,
)}
\`\`\`

요구사항:
1. SectionPlan 의 모든 sections.section_id 에 대해 1:1 매칭되는 카피 작성
2. 각 섹션의 copy_constraints (headline_max_chars, body_max_chars, bullet_max_count) 를 절대 초과하지 마세요
3. ${brief.target_tier === 'luxury' ? 'luxury 금기 어휘 0건. tier_audit.forbidden_words_found = [].\n4. ' : ''}색상 정보 (${brief.colors.join(', ')}) 를 color 섹션의 color_chips 에 시적 story 와 함께
${brief.target_tier === 'luxury' ? '5' : '4'}. JSON 만 반환 (코드펜스·설명 없이)`
}

export async function runCopyCraftsman(
  brief: ProductBrief,
  plan: SectionPlan,
): Promise<CopyDeck> {
  return callClaudeJSON<CopyDeck>({
    system: COPY_CRAFTSMAN_SYSTEM,
    user: buildCopyCraftsmanUser(brief, plan),
    maxTokens: 8000,
  })
}

// ============================================================
// 에러 헬퍼
// ============================================================

export function isMissingApiKey(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.message.includes('ANTHROPIC_API_KEY')
}
