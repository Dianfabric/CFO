'use server'
/**
 * AI 콘텐츠 어시스턴트 (Phase 3.5 #2b ⑧)
 * Claude Sonnet 4.5에 디안 브랜드 + 24셀 + 채널을 컨텍스트로 보내
 * Hook · Story · Offer · CTA 후보 3개를 생성받음.
 */
import { createClient } from '@/lib/supabase/server'
import { getAnthropic, MODEL, extractText, parseJsonResponse } from '@/lib/anthropic'

const SYSTEM_PROMPT = `당신은 디안(Dian)의 마케팅 카피라이터입니다.
디안은 B2B 프리미엄 인테리어 원단 유통 회사 — 4티어 × 24셀 비즈니스 모델.

당신의 임무: Hook · Story · Offer · CTA 4부작 (러셀 4부작) 후보를 3가지 다른 톤으로 생성.

응답 규칙:
- 반드시 다음 JSON 형식으로만:
{
  "candidates": [
    {
      "tone_label": "예: 감성적·서정",
      "hook": "...",
      "story": "...",
      "offer": "...",
      "cta": "..."
    },
    ...3개...
  ]
}
- 한국어, 디안 브랜드 톤(격조 있고 전문적이지만 따뜻한)
- 각 후보의 톤은 명확히 다르게 (감성/논리/직설 등)
- Hook는 한 문장 (스크롤 멈춤)
- Story는 2-3 문장 (감정·맥락)
- Offer는 1-2 문장 (가치·시급성)
- CTA는 한 줄 (구체적 행동)
- 코드펜스 없이 순수 JSON만`

export interface GenerateRequest {
  channel: string
  topic: string
  target_segment?: string
  brand_persona?: string
  big_idea?: string
}

export interface HSOCandidate {
  tone_label: string
  hook: string
  story: string
  offer: string
  cta: string
}

export async function generateHSO(
  req: GenerateRequest,
): Promise<{ ok: boolean; candidates?: HSOCandidate[]; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    // 브랜드 컨텍스트 자동 가져오기
    const { data: brand } = await supabase
      .from('brand_identity')
      .select('big_idea, brand_persona, voice_tone, target_persona_primary')
      .eq('id', 1)
      .maybeSingle()

    const context = `[디안 브랜드 컨텍스트]
빅 아이디어: ${req.big_idea ?? brand?.big_idea ?? '(미정의)'}
브랜드 페르소나: ${req.brand_persona ?? brand?.brand_persona ?? '(미정의)'}
톤·매너: ${brand?.voice_tone ?? '(미정의)'}
1차 타겟: ${req.target_segment ?? brand?.target_persona_primary ?? '인테리어 디자이너'}

[이번 콘텐츠 요구사항]
채널: ${req.channel}
주제·테마: ${req.topic}

위 컨텍스트로 Hook·Story·Offer·CTA 4부작 후보 3가지(서로 다른 톤)를 JSON으로 생성하세요.`

    const client = getAnthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    })

    const text = extractText(response)
    const parsed = parseJsonResponse<{ candidates: HSOCandidate[] }>(text)
    if (!parsed?.candidates || !Array.isArray(parsed.candidates)) {
      return { ok: false, error: 'Claude 응답이 예상 형식이 아닙니다.' }
    }

    return { ok: true, candidates: parsed.candidates }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
