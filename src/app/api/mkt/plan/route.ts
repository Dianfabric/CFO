/**
 * AI 발행 기획자 (대표 지시 2026-07-28)
 * POST { messages: [{role:'user'|'assistant', content}], context: { biz, goalLabel, target, start, end } }
 * → 기간·목표 기반으로 콘텐츠 발행 기획을 대화로 다듬고,
 *   확정 요청 시 ```json { "posts": [...] } ``` 형태의 최종 계획을 출력한다.
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()
    if (!Array.isArray(messages) || !messages.length) {
      return NextResponse.json({ error: 'messages 필요' }, { status: 400 })
    }
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 미설정' }, { status: 500 })
    const anthropic = new Anthropic({ apiKey })

    const system = `당신은 디안(B2B 프리미엄 인테리어 원단)과 색동공장(전통 색동 원단 신사업)의 마케팅 콘텐츠 발행 기획자입니다.
목표: ${context?.biz ?? '디안'} — ${context?.goalLabel ?? '목표'} ${context?.target ?? ''} / 기간: ${context?.start ?? '?'} ~ ${context?.end ?? '?'}

채널 코드: dian_blog(디안 블로그), dian_insta(디안 인스타), dian_yt(디안 유튜브), saek_blog(색동 블로그), saek_insta(색동 인스타), saek_yt(색동 유튜브)
콘텐츠 유형 코드: info(정보성), brand(브랜딩), carousel(캐러셀), reels(릴스), video(영상)

역할:
1. 기간 전체의 발행 전략(주차별 테마, 채널 배분, 주당 횟수)을 제안하고 사용자와 대화로 수정한다. 지속 가능한 빈도(주 3~5회 수준)를 권한다.
2. 사용자가 "확정", "반영", "이대로 진행" 등 확정 의사를 밝히면 — 그때만 — 응답 마지막에 최종 계획을 정확히 아래 형식의 json 코드블록 하나로 출력한다:
\`\`\`json
{ "posts": [ { "channel": "saek_insta", "content_type": "reels", "planned_date": "2026-08-03", "title": "주제 요약" } ] }
\`\`\`
- planned_date 는 기간 안의 실제 날짜(YYYY-MM-DD), 각 행의 title 은 15자 내외 구체적 주제.
- 확정 전에는 json 블록을 절대 출력하지 말 것. 한국어로 간결하게 답한다.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      system,
      messages: messages.slice(-20),
    })
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
    return NextResponse.json({ text })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AI 호출 실패' }, { status: 500 })
  }
}
