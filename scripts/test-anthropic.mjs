/**
 * Anthropic API 키 작동 검증 스크립트
 * 키 자체는 출력하지 않음. 응답 정상 여부만 확인.
 *
 * 실행: node scripts/test-anthropic.mjs
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// 1) .env 먼저 (override:true — 시스템 환경변수의 빈 값을 덮어씀)
// 2) .env.local 나중 (override:true — 로컬이 .env 보다 우선)
const envResult = config({ path: join(projectRoot, '.env'), override: true })
const localResult = config({ path: join(projectRoot, '.env.local'), override: true })

console.log(`📂 .env.local: ${localResult.error ? '없음' : '로드됨'}`)
console.log(`📂 .env:       ${envResult.error ? '없음' : '로드됨'}`)
console.log('')

const startTime = Date.now()

// 1) 키 존재 확인 (마스킹)
const key = process.env.ANTHROPIC_API_KEY
if (!key) {
  console.error('❌ ANTHROPIC_API_KEY 환경변수가 설정되어 있지 않습니다.')
  console.error('   .env 또는 .env.local 파일을 확인하세요.')
  process.exit(1)
}

const masked =
  key.length > 16
    ? `${key.slice(0, 10)}...${key.slice(-4)} (총 ${key.length}자)`
    : '(너무 짧음)'
console.log(`🔑 키 감지: ${masked}`)
console.log(`   접두어: ${key.startsWith('sk-ant-') ? 'sk-ant- ✓' : '⚠ 비표준'}`)

const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5'
console.log(`🤖 모델: ${model}`)
console.log('')

// 2) 실제 호출
const client = new Anthropic({ apiKey: key })

try {
  console.log('📡 API 호출 중...')
  const response = await client.messages.create({
    model,
    max_tokens: 50,
    messages: [
      {
        role: 'user',
        content: '연결 테스트. "디안 CFO 정상 작동" 한 문장만 답변해줘.',
      },
    ],
  })

  const elapsedMs = Date.now() - startTime
  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('')

  console.log('')
  console.log('✅ API 키 작동 정상')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📤 응답 모델:   ${response.model}`)
  console.log(`📊 입력 토큰:   ${response.usage.input_tokens}`)
  console.log(`📊 출력 토큰:   ${response.usage.output_tokens}`)
  console.log(`⏱  응답 시간:   ${elapsedMs}ms`)
  console.log(`🛑 종료 사유:   ${response.stop_reason}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`💬 응답 내용:`)
  console.log(`   ${text}`)
  console.log('')
  console.log('🎉 v1.1 신규 기능 (모닝 브리핑·라이브 컨설팅·영업자료 자동생성·')
  console.log('   입고 AI 평가) 모두 정상 작동 가능합니다.')
} catch (err) {
  console.error('')
  console.error('❌ API 호출 실패')
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (err.status) {
    console.error(`상태 코드: ${err.status}`)
    if (err.status === 401) {
      console.error('→ 키가 잘못됐거나 만료됐습니다.')
      console.error('  https://console.anthropic.com/settings/keys 에서 새 키 발급 후')
      console.error('  .env 파일의 ANTHROPIC_API_KEY 갱신 필요.')
    } else if (err.status === 429) {
      console.error('→ 레이트 리밋 또는 크레딧 부족.')
      console.error('  https://console.anthropic.com/settings/billing 확인.')
    } else if (err.status === 400) {
      console.error('→ 모델명이 잘못됐을 수 있습니다.')
      console.error(`  현재 모델: ${model}`)
    }
  }
  console.error(`메시지: ${err.message ?? err}`)
  if (err.error) console.error(`상세:   ${JSON.stringify(err.error)}`)
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  process.exit(1)
}
