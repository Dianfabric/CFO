/**
 * 영업자료 AI 생성기 (#9)
 * - Claude Sonnet 4.5에게 컨텍스트 + 프레임워크를 주입해 슬라이드 + 영상 스크립트를 JSON으로 생성.
 */
import 'server-only'
import { getAnthropic, MODEL, extractText, parseJsonResponse } from '@/lib/anthropic'
import type {
  GenerateInput,
  GeneratedMaterial,
  FrameworkRow,
} from './types'

const TIER_LABEL: Record<string, string> = {
  value: '저가 (Value, 마진 20-30%, 가격 강조 가능, 9.99 같은 문턱가격)',
  mid: '중가 (Mid, 마진 35-45%, 가성비, 제한적 할인)',
  premium: '프리미엄 (Premium, 마진 50-65%, 가치/디자이너 사례, 할인 회피)',
  luxury: '럭셔리 (Luxury, 마진 70-85%, 할인 절대 금지, Price upon request)',
}

const OCCUPATION_LABEL: Record<string, string> = {
  interior_project: '인테리어 프로젝트 — 공간 완성도, 클라이언트 만족, 시공 사례 강조',
  brand_furniture: '브랜드 가구 — 디자인 일관성, 양산 안정성, 브랜드 톤',
  project_furniture: '프로젝트 가구 — 납기, 단가, 품질 인증',
  commercial_reupholster: '업소용 천갈이 — 내구성, 청소, 화재 인증',
  curtain_styling: '커튼 스타일링 — 광원, 드레이프, 계절감',
  display: '디스플레이 — 임팩트, 단기 효과, 회수 가능성',
}

function buildSystemPrompt(input: GenerateInput, frameworks: FrameworkRow[]): string {
  const tierLabel = input.target_tier ? TIER_LABEL[input.target_tier] : '미지정'
  const occLabel = input.target_occupation ? OCCUPATION_LABEL[input.target_occupation] : '일반 디자이너/스튜디오'

  const frameworkBlock = frameworks
    .map(
      (f) =>
        `### ${f.name} (${f.key})
원리:
${(f.principles ?? []).map((p) => `- ${p}`).join('\n')}
적용 가이드:
${f.prompt_template ?? '(가이드 없음)'}`,
    )
    .join('\n\n')

  const brand = input.brand
  const brandBlock = brand
    ? `# 디안 브랜드 정체성 (반드시 반영)
- 빅 아이디어: ${brand.big_idea ?? '(미설정)'}
- 페르소나: ${brand.brand_persona ?? '(미설정)'}
- 톤·매너: ${brand.voice_tone ?? '(미설정)'}
- 컬러: 주 ${brand.visual_primary_color ?? '(미설정)'} / 보조 ${brand.visual_secondary_color ?? '-'} / 강조 ${brand.visual_accent_color ?? '-'}
- 폰트: 제목 ${brand.visual_font_heading ?? '-'} / 본문 ${brand.visual_font_body ?? '-'}
- 이미지 스타일: ${brand.visual_image_style ?? '(미설정)'}`
    : '# 디안 브랜드 정체성 (미설정 — 일반 톤으로 작성)'

  return `당신은 디안(Dian)의 시니어 영업·브랜드 디렉터입니다.
디안은 B2B 프리미엄 인테리어 원단 큐레이터로, 4티어(저가~럭셔리)와 6직업군 × 4제품군 매트릭스를 운영합니다.

# 절대 원칙
- 디안 톤: 세련된 전문가, 격조 있고 신뢰감 있게.
- 한국어 영업자료. 디자이너/스튜디오/가구사가 받는다고 가정.
- 절대 과장 금지. 특히 premium·luxury는 할인·세일 언급 금지.
- 단정적 의학·환경 효능 주장 금지 (예: "100% 친환경" → "친환경 인증 소재" 식).
- 럭셔리 라인은 가격을 절대 표시하지 말고 "Price upon request"로 처리.

# 대상 컨텍스트
- 티어: ${tierLabel}
- 직업군: ${occLabel}
- 페르소나: ${input.target_persona ?? '미지정'}

${brandBlock}

# 적용할 심리·인지과학 프레임워크
${frameworkBlock}

# 톤 설정 (0=정보·친근·텍스트 / 10=감성·격조·비주얼)
- 감성도: ${input.tone.emotional}/10
- 격조: ${input.tone.formal}/10
- 비주얼 밀도: ${input.tone.visual_density}/10

# 출력 형식 (반드시 이 JSON 스키마만, 코드펜스 없이)
{
  "title": "자료 제목 (제품명 + 컬렉션/시즌 포함)",
  "slides": [
    {
      "kind": "cover|hook|big_idea|material_detail|color_palette|use_case|comparison|value_proposition|scarcity|cta|story|guide|plan|success|authority|social_proof|closing",
      "headline": "한 줄 핵심 메시지",
      "subhead": "보조 한 줄 (옵션)",
      "body": "2-3문장 설명 (옵션, 정보 슬라이드)",
      "bullets": ["불릿 1", "불릿 2"],
      "image_brief": "이미지 자리표시자 — 어떤 사진/일러스트가 들어가야 하는지 한국어로 설명",
      "caption": "캡션 (옵션)"
    }
  ],
  "video_scripts": [
    {
      "duration_sec": 15,
      "bgm_mood": "BGM 무드 (예: 미니멀 피아노, 따뜻한 어쿠스틱)",
      "closing_text": "마지막 한 줄",
      "cuts": [
        {
          "time_range": "0-3",
          "voiceover": "내레이션 (옵션, 짧게)",
          "subtitle": "자막",
          "image_brief": "컷 비주얼 설명 (마크로샷, 미디엄, 풀샷 등)",
          "bgm_mood": "이 컷의 무드 (옵션)"
        }
      ]
    }
  ],
  "meta": {
    "framework_keys": ["적용한 프레임워크 키"],
    "target_tier": "value|mid|premium|luxury",
    "target_occupation": "...",
    "target_persona": "..."
  }
}

JSON 외 다른 어떤 텍스트도 출력하지 마세요.`
}

function buildUserPrompt(input: GenerateInput): string {
  const lines: string[] = []
  lines.push(`# 자료 제목 후보\n${input.title}`)
  lines.push(`\n# 제품 정보`)
  lines.push(`- 제품명: ${input.product_name}`)
  if (input.product_attrs?.material) lines.push(`- 소재: ${input.product_attrs.material}`)
  if (input.product_attrs?.colors?.length)
    lines.push(`- 컬러군: ${input.product_attrs.colors.join(', ')}`)
  if (input.product_attrs?.season) lines.push(`- 시즌: ${input.product_attrs.season}`)
  if (input.product_attrs?.category) lines.push(`- 카테고리: ${input.product_attrs.category}`)
  if (input.product_attrs?.estimated_unit_price != null)
    lines.push(`- 추정 단가: ${input.product_attrs.estimated_unit_price.toLocaleString('ko-KR')} 원/단위`)

  lines.push(`\n# 생성 옵션`)
  lines.push(`- 슬라이드 수: ${input.slide_count}장`)
  lines.push(`- 영상 길이 (각각): ${input.video_durations.join(', ')}초`)

  if (input.source_text) {
    lines.push(`\n# 참고 자료 — 텍스트 (해외 기사·인터뷰 등, 인용·재가공 자유)`)
    lines.push(input.source_text.slice(0, 5000))
  }

  if (input.reference_urls?.length) {
    lines.push(`\n# 참고 URL (직접 fetch는 안 함, 도메인 맥락만 참고)`)
    for (const u of input.reference_urls) lines.push(`- ${u}`)
  }

  if (input.reference_assets?.length) {
    lines.push(`\n# 첨부 자산 (자료 생성 시 image_brief에 자연스럽게 반영)`)
    for (const a of input.reference_assets) {
      lines.push(
        `- [${a.kind}/${a.source}] ${a.title ?? '(제목 없음)'}${a.description ? ` — ${a.description}` : ''}${
          a.body_text ? `\n  본문 발췌: ${a.body_text.slice(0, 500)}` : ''
        }`,
      )
    }
  }

  lines.push(
    `\n위 정보로 ${input.slide_count}장 슬라이드와 ${input.video_durations.length}개 영상 스크립트(${input.video_durations.join(', ')}초)를 생성하세요. JSON만 출력.`,
  )

  return lines.join('\n')
}

export async function generateMaterial(
  input: GenerateInput,
  frameworks: FrameworkRow[],
): Promise<{ ok: true; material: GeneratedMaterial } | { ok: false; error: string }> {
  try {
    const client = getAnthropic()
    const system = buildSystemPrompt(input, frameworks)
    const user = buildUserPrompt(input)

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.7,
      system,
      messages: [{ role: 'user', content: user }],
    })

    const text = extractText(response)
    const parsed = parseJsonResponse<GeneratedMaterial>(text)

    if (!parsed || !parsed.slides) {
      return {
        ok: false,
        error: 'AI 응답을 JSON으로 파싱하지 못했습니다. 다시 시도해주세요.',
      }
    }

    return { ok: true, material: parsed }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export function recommendFrameworks(
  tier: string | undefined,
  occupation: string | undefined,
  frameworks: FrameworkRow[],
): FrameworkRow[] {
  if (!frameworks.length) return []
  const scored = frameworks.map((f) => {
    let score = 0
    if (tier && (f.recommended_tiers ?? []).includes(tier as 'value' | 'mid' | 'premium' | 'luxury'))
      score += 2
    if (
      occupation &&
      (f.recommended_occupations ?? []).includes(occupation as 'interior_project' | 'brand_furniture' | 'project_furniture' | 'commercial_reupholster' | 'curtain_styling' | 'display')
    )
      score += 1
    return { f, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 2).map((s) => s.f)
}
