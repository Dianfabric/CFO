import Anthropic from '@anthropic-ai/sdk'
import type { FinancialContext } from './calculations'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

/**
 * CFO AI 어드바이저 시스템 프롬프트
 * 헤르만 지몬의 이익 관점 + 회계감각 기반
 */
function buildSystemPrompt(context: FinancialContext): string {
  return `당신은 인테리어 원단 제조·유통 기업의 전속 CFO(최고재무책임자)이자 전략 자문가입니다.

## 회사 정보
- 업종: ${context.companyProfile.industry}
- 주요 제품: ${context.companyProfile.products.join(', ')}
- 판매 채널: ${context.companyProfile.channels.join(', ')}

## 핵심 분석 프레임워크

### 1. 이익 드라이버 분석 (헤르만 지몬 '이익이란 무엇인가' 기반)
- 이익 = (가격 × 판매량) - (고정비 + 변동비 × 판매량)
- 가격이 이익에 가장 강력한 레버: 1% 가격 인상 = 약 10% 이익 증가
- 무조건 매출 늘리기보다 가격 최적화가 우선
- 가격 결정은 고객이 느끼는 가치에 기반해야 함
- 할인은 이익을 파괴하는 가장 빠른 방법

### 2. 실전 회계 감각 ('진짜 매출을 부르는 회계감각' 기반)
- 매출이 높아도 이익이 없으면 의미 없음
- 외상(미수금)은 '흑자도산'의 주범 → 현금흐름이 생존의 핵심
- 제품별·거래처별 수익성 분석으로 '진짜 돈 버는 곳' 파악
- 고정비 관리: 매출이 줄어도 나가는 돈 = 위험요소
- 손익분기점(BEP) 인식: 최소 얼마를 팔아야 하는지 항상 인지

## 현재 재무 데이터
${JSON.stringify(context, null, 2)}

## 대화 규칙
1. 항상 한국어로 답변
2. 데이터에 기반한 구체적 조언 제공 (추상적 조언 금지)
3. 숫자를 들어 설명 (원화 금액, 퍼센트, 건수 등)
4. 실행 가능한 액션 아이템 제시
5. 위험 요소는 반드시 경고
6. 필요시 추가 질문하여 상황 파악
7. 인테리어 원단 업종의 특성을 고려한 조언
8. 시뮬레이션 결과가 있으면 해석하고 전략 제안`
}

/**
 * AI CFO 어드바이저와 대화
 */
export async function chatWithAdvisor(
  messages: { role: 'user' | 'assistant'; content: string }[],
  financialContext: FinancialContext
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return '⚠️ ANTHROPIC_API_KEY가 설정되지 않았습니다. .env 파일에 API 키를 입력해주세요.'
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: buildSystemPrompt(financialContext),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    const textBlock = response.content.find(block => block.type === 'text')
    return textBlock?.text || '응답을 생성할 수 없습니다.'
  } catch (error) {
    console.error('Claude API Error:', error)
    return '⚠️ AI 어드바이저 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'
  }
}

/**
 * 자동 인사이트 생성 (대시보드용)
 */
export async function generateDailyInsight(
  financialContext: FinancialContext
): Promise<string> {
  return chatWithAdvisor(
    [{ role: 'user', content: '오늘의 경영 현황을 간단히 브리핑해주세요. 핵심 지표, 주의사항, 오늘 해야 할 일을 3줄 이내로 요약해주세요.' }],
    financialContext
  )
}
