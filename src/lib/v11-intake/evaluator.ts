/**
 * 입고 샘플 AI 평가기 (#10)
 * Claude Sonnet 4.5 호출 → 24셀 매핑 + 티어 + 경쟁력 점수 추천
 */
import 'server-only'
import { getAnthropic, MODEL, extractText, parseJsonResponse } from '@/lib/anthropic'
import type { AIEvaluation, EvaluateInput } from './types'

const SYSTEM_PROMPT = `당신은 디안(Dian)의 시니어 머천다이저(MD).
디안은 B2B 프리미엄 인테리어 원단 큐레이터로 4티어와 6직업군 × 4제품군 매트릭스를 운영합니다.

# 4티어 정의
- value (저가, 마진 20-30%): 화재인증·내구성·청소·가격 강조
- mid (중가, 마진 35-45%): 가성비, 합리적 선택, 양산 안정성
- premium (프리미엄, 50-65%): 디자이너 사례, 디테일, 가치
- luxury (럭셔리, 70-85%): 장인성, 한정, 여백, Price upon request

# 6직업군
- interior_project: 인테리어 프로젝트 (공간·시공)
- brand_furniture: 브랜드 가구 (R&D·양산)
- project_furniture: 프로젝트 가구 (납기·단가)
- commercial_reupholster: 업소용 천갈이 (내구·인증)
- curtain_styling: 커튼 스타일링 (광원·드레이프)
- display: 디스플레이 (트렌드·단기)

# 4제품군
- sofa, curtain, wall, accessory

# 티어 추천 가중
- 해외 출처: +1 티어
- 단가 ≥ 5만원/단위: premium 후보
- 단가 ≥ 10만원/단위: luxury 후보
- 100% 천연 (실크·카시미어·울 등): 티어 ↑
- 합성 (폴리에스터): mid 이하

# 출력
JSON only:
{
  "recommended_division": "sofa|curtain|wall|accessory",
  "recommended_tier": "value|mid|premium|luxury",
  "recommended_occupations": ["interior_project", ...],
  "competitive_score": 1~5,
  "differentiator": "차별화 포인트 한 줄 (예: '벨기에 직조의 결, 양면 사용 가능')",
  "reasoning": "추천 근거 1-2문장"
}

JSON 외 다른 텍스트 절대 금지.`

export async function evaluateSample(
  input: EvaluateInput,
): Promise<{ ok: true; evaluation: AIEvaluation } | { ok: false; error: string }> {
  try {
    const client = getAnthropic()
    const userPrompt = [
      `# 입고 샘플 정보`,
      `- 이름: ${input.name}`,
      input.supplier ? `- 공급처: ${input.supplier}` : null,
      `- 출처: ${input.source === 'overseas' ? '해외 🌍' : '국내 🇰🇷'}`,
      input.material ? `- 소재: ${input.material}` : null,
      input.colors?.length ? `- 컬러군: ${input.colors.join(', ')}` : null,
      input.estimated_unit_price != null
        ? `- 추정 단가: ${input.estimated_unit_price.toLocaleString('ko-KR')} 원/단위`
        : null,
      input.notes ? `- 메모: ${input.notes}` : null,
      ``,
      `위 정보로 디안의 24셀 매트릭스 매핑과 티어를 추천하세요. JSON only.`,
    ]
      .filter(Boolean)
      .join('\n')

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = extractText(response)
    const parsed = parseJsonResponse<AIEvaluation>(text)

    if (!parsed || !parsed.recommended_tier || !parsed.recommended_division) {
      return { ok: false, error: 'AI 응답 파싱 실패' }
    }

    // 안전 가드
    if (parsed.competitive_score < 1 || parsed.competitive_score > 5) {
      parsed.competitive_score = 3
    }

    return { ok: true, evaluation: parsed }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
