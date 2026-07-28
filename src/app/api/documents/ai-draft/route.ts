import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

const TYPE_GUIDES: Record<string, string> = {
  PRICE_CHANGE: `유형: 거래처 단가 인상/인하 안내 공문.
- 인사 → 감사 → 배경 설명 → 자체 흡수 노력(있다면) → 부득이한 결정 → 적용 시점 → 협조 요청 → 마무리 인사 흐름.
- 거래처가 결정을 받아들이도록 정중하면서도 단호한 톤.`,
  HOLIDAY: `유형: 휴무 안내 공문.
- 인사 → 감사 → 핵심 일정 박스 → 상세 안내 → 업무 제한 안내 → 긴급 연락처(있다면) → 양해 요청 → 마무리.
- 사용자가 입력한 휴무기간, 정상 업무 재개일, 긴급 연락처는 반드시 본문 앞부분에 별도 줄로 강하게 노출.
- 핵심 일정은 "■ 휴무기간 : ...", "■ 정상 업무 : ..." 형식으로 작성.
- 간결하고 명료한 톤.`,
  PAYMENT_REQUEST: `유형: 결제(입금) 요청 공문.
- 인사 → 미수 사실 환기 → 금액과 기일 → 입금 협조 요청 → 향후 거래의 신뢰 강조 → 마무리.
- 거래관계를 해치지 않으면서도 단호한 톤.`,
  PRICE_INFO: `유형: 단가 안내 공문.
- 인사 → 거래 감사 → 단가표 참조 안내 → 적용 기간 → 문의 안내 → 마무리.
- 객관적이고 깔끔한 톤.`,
}

const MODEL_CANDIDATES = [
  process.env.ANTHROPIC_MODEL,
  'claude-3-5-sonnet-latest',
  'claude-3-5-sonnet-20241022',
].filter(Boolean) as string[]

function holidayFallback(keywords?: string) {
  const source = (keywords || '').trim()
  const period = source.match(/(\d{1,2}\s*[\/.월]\s*\d{1,2}\s*(?:일)?\s*[~\-–—]\s*\d{1,2}\s*[\/.월]\s*\d{1,2}\s*(?:일)?)/)?.[1]
    || source.match(/(\d{1,2}\s*[\/.월]\s*\d{1,2}\s*(?:일)?\s*[~\-–—]\s*\d{1,2}\s*(?:일)?)/)?.[1]
    || '별도 안내드리는 기간'
  const reopen = source.match(/(\d{1,2}\s*[\/.월]\s*\d{1,2}\s*(?:일)?\s*(?:부터|부터는|정상\s*업무|업무\s*재개)[^,\.\n]*)/)?.[1]
    || source.match(/(\d{1,2}\s*[\/.월]\s*\d{1,2}\s*(?:일)?부터[^,\.\n]*)/)?.[1]
    || '휴무 종료 후 정상 업무를 재개하겠습니다'
  const emergency = source.match(/(긴급[^,\.\n]*(?:연락|카카오톡|카톡|전화)[^,\.\n]*)/)?.[1]
    || source.match(/((?:카카오톡|카톡|전화)[^,\.\n]*(?:연락|문의)[^,\.\n]*)/)?.[1]

  return `1. 귀사의 무궁한 발전을 기원합니다.

2. 평소 저희 디안에 보내주시는 신뢰와 협조에 깊이 감사드립니다.

3. 당사의 휴무 일정을 아래와 같이 안내드립니다.

■ 휴무기간 : ${period}
■ 정상 업무 : ${reopen}
${emergency ? `■ 긴급 연락 : ${emergency}\n` : ''}
4. 위 기간 중에는 주문, 출고 및 상담 업무가 제한될 수 있습니다.

5. 정상 업무 재개 후 접수된 요청은 순차적으로 빠르게 처리하겠습니다.

6. 거래처 업무 일정에 차질이 없도록 휴무기간과 정상 업무 재개일을 꼭 확인 부탁드립니다.

${emergency ? '7' : '7'}. 너른 양해를 부탁드리며, 항상 협조해 주셔서 감사합니다.`
}

function genericFallback(type: string, keywords?: string) {
  if (type === 'HOLIDAY') return holidayFallback(keywords)
  const detail = keywords?.trim() ? `\n\n3. 안내드릴 내용은 다음과 같습니다.\n${keywords.trim()}` : ''
  return `1. 귀사의 무궁한 발전을 기원합니다.

2. 평소 저희 디안에 보내주시는 신뢰와 협조에 깊이 감사드립니다.${detail}

4. 업무에 참고 부탁드리며, 추가 문의사항은 언제든지 연락 주시기 바랍니다.

5. 감사합니다.`
}

export async function POST(request: NextRequest) {
  const { type, recipientName, keywords, currentBody } = await request.json()

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ text: genericFallback(type, keywords), source: 'fallback', warning: 'ANTHROPIC_API_KEY missing' })
    }

    const guide = TYPE_GUIDES[type] || TYPE_GUIDES.PRICE_CHANGE

    const systemPrompt = `당신은 한국 B2B 거래에서 사용하는 공문(공식 서한)의 본문을 작성하는 전문가입니다.

작성 규칙:
1. 한국어, 정중하고 격식 있는 비즈니스 문어체
2. 각 문장은 짧고 명료하게
3. 번호 매김 (1. 2. 3. ...) 으로 단락 구분
4. 사실 → 배경 → 결정/안내 → 협조 요청 순으로 논리적 흐름
5. 사용자가 입력한 날짜, 기간, 금액, 연락처 같은 구체 정보는 반드시 반영
6. 영업 톤이나 사과 톤이 아니라 동등한 파트너의 톤
7. 첫 문장은 보통 "귀사의 무궁한 발전을 기원합니다." 같은 인사
8. 마지막 문장은 보통 감사와 문의 안내
9. 문장 수는 자유롭게. 필요한 만큼만. 보통 5~9개.
10. 출력은 본문 텍스트만. 제목/서명/표는 절대 포함하지 말 것.

${guide}`

    const userPrompt = `수신: ${recipientName || '○○○ 귀하'}
키워드 / 상황 설명:
${keywords || '(없음)'}

${currentBody ? `현재 작성된 본문(수정해야 함):\n${currentBody}\n\n위 본문을 키워드와 상황에 맞게 다듬어 주세요. 특히 날짜/기간/재개일/연락처는 빠짐없이 본문에 넣어 주세요.` : '위 정보를 바탕으로 공문 본문을 작성해 주세요.'}`

    let lastError: unknown = null
    for (const model of MODEL_CANDIDATES) {
      try {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        const text = textBlock?.type === 'text' ? textBlock.text : ''
        if (text.trim()) return NextResponse.json({ text, source: 'anthropic', model })
      } catch (error) {
        lastError = error
        console.warn(`ai-draft model failed: ${model}`, error)
      }
    }

    console.error('ai-draft all models failed:', lastError)
    return NextResponse.json({ text: genericFallback(type, keywords), source: 'fallback', warning: 'AI model failed' })
  } catch (error) {
    console.error('ai-draft Error:', error)
    return NextResponse.json({ text: genericFallback(type, keywords), source: 'fallback', warning: 'AI draft failed' })
  }
}
