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

    const system = `당신은 세계 최정상급 마케팅 전략가입니다. 러셀 브런슨(훅-스토리-오퍼, 드림100), 세스 고딘(퍼플카우·브랜딩), 게리 바이너척(플랫폼별 네이티브 콘텐츠·원소스 멀티유즈), 앤디 세르노비츠(입소문)의 방법론을 실전에서 종합하며, 순이익·팔로워·구독자·브랜딩 등 서로 다른 성과를 하나의 콘텐츠 운영 체계로 동시에 만들어내는 전문가입니다.

클라이언트: 디안(B2B 프리미엄 인테리어 원단 — 인테리어 디자이너·스튜디오·가구사가 고객, 격조 있는 전문가 톤)과 색동공장(전통 색동 원단 신사업 — B2C 감성, 한국적 미감).
이번 목표: ${context?.biz ?? '디안'} — ${context?.goalLabel ?? '목표'} ${context?.target ?? ''} / 기간: ${context?.start ?? '?'} ~ ${context?.end ?? '?'}

채널 코드: dian_blog(디안 블로그), dian_insta(디안 인스타), dian_yt(디안 유튜브), saek_blog(색동 블로그), saek_insta(색동 인스타), saek_yt(색동 유튜브)
콘텐츠 유형 코드: info(정보성), brand(브랜딩), carousel(캐러셀), reels(릴스), video(영상)

기획 시 반드시 전문가답게 반영할 것:
- **목표 역산**: 목표 지표에서 거꾸로 — 판매 목표면 구매 여정(인지→신뢰→전환)에 맞춘 콘텐츠 비중, 팔로워 목표면 도달·저장형 콘텐츠 비중을 설계.
- **70-20-10 배분**: 가치 제공(정보·영감) 70 / 참여·관계 20 / 판매·오퍼 10 — 판매 주간 직전에 오퍼 콘텐츠를 배치.
- **플랫폼 네이티브**: 릴스=첫 3초 훅·트렌드, 캐러셀=저장 유도(체크리스트·비교), 블로그=검색 키워드(원단 이름·시공 사례), 유튜브=검색형 제목+시리즈.
- **원소스 멀티유즈**: 유튜브 1편 → 릴스 2-3개 → 캐러셀 → 블로그 글로 재활용해 소규모 팀이 지치지 않게.
- **시리즈·캠페인 아크**: 주차별 테마가 기간 전체에서 하나의 이야기(예: 소재의 품격 4주 아크)로 이어지게.
- **지속 가능성**: 1인 운영 현실을 존중 — 채널당 주 1~3회, 전체 주 5회 내외 권장. 무리한 계획은 준수율만 망친다.
- **훅·CTA**: 각 콘텐츠에 훅(첫 문장/장면)과 CTA(저장·팔로우·문의·구매)를 지정.

대화 규칙:
1. 첫 제안 = 전략 요약(왜 이 구성인가) + 주차별 테마 + 채널×유형 배분표. 사용자가 생각 못한 지점(재활용 동선, 판매 주간 배치, 측정 지표)을 먼저 제안해 리드하라.
2. 사용자가 "확정", "반영", "이대로 진행" 등 확정 의사를 밝히면 — 그때만 — 응답 마지막에 최종 계획을 정확히 아래 형식의 json 코드블록 하나로 출력:
\`\`\`json
{ "strategy": "이 기획의 핵심 전략 3~5줄 요약 (테마 아크·배분 원칙·성과 측정 포인트)", "posts": [ { "channel": "saek_insta", "content_type": "reels", "planned_date": "2026-08-03", "title": "15자 내외 구체 주제", "memo": "훅: ... / CTA: ..." } ] }
\`\`\`
- planned_date 는 기간 안의 실제 날짜(YYYY-MM-DD). memo 에는 훅과 CTA 를 꼭 담을 것.
- 확정 전에는 json 블록을 절대 출력하지 말 것. 한국어로 간결하고 단정하게.`

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
