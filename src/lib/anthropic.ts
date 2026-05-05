/**
 * Anthropic Claude API 클라이언트 (서버 전용)
 *
 * 절대 클라이언트 코드에서 import 금지 — ANTHROPIC_API_KEY 누출 위험.
 * Server Actions / Route Handlers / Server Components 에서만 사용.
 */
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.')
  }
  _client = new Anthropic({ apiKey })
  return _client
}

/** v1.1에서 사용할 모델. ENV 로 오버라이드 가능. */
export const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5'

/**
 * 텍스트만 추출하는 헬퍼 — content blocks에서 'text' 타입만 합쳐 반환.
 */
export function extractText(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((c): c is Anthropic.Messages.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

/**
 * Claude 응답이 JSON 문자열인 경우 안전하게 파싱.
 * 코드펜스(```json ... ```)가 있을 수도 있어 처리.
 */
export function parseJsonResponse<T = unknown>(text: string): T | null {
  let cleaned = text.trim()
  // 코드펜스 제거
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) cleaned = fenced[1].trim()
  // 문자열 시작이 { 가 아니면 첫 { 부터 마지막 } 까지 추출
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const first = cleaned.indexOf('{')
    const last = cleaned.lastIndexOf('}')
    if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1)
  }
  try {
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}
