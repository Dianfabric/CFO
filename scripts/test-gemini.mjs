/**
 * Google Gemini API 키 검증 스크립트
 *
 * - GOOGLE_GENAI_API_KEY 가 .env.local 에 잘 들어갔는지
 * - Gemini 3 Pro 호출 가능한지
 * - Imagen 3 이미지 생성 가능한지 (선택)
 *
 * 키 자체는 출력하지 않음. 응답 정상 여부만 확인.
 *
 * 실행: node scripts/test-gemini.mjs
 *      node scripts/test-gemini.mjs --skip-image   (Gemini 만)
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// .env 먼저 (override true — 시스템 env 의 빈 값 덮어쓰기)
config({ path: join(projectRoot, '.env'), override: true })
config({ path: join(projectRoot, '.env.local'), override: true })

const startTime = Date.now()
const skipImage = process.argv.includes('--skip-image')

// 1) 키 존재 확인 (마스킹)
const key = process.env.GOOGLE_GENAI_API_KEY
const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-pro'
const imagenModel = process.env.IMAGEN_MODEL ?? 'imagen-3.0-generate-002'

if (!key) {
  console.error('❌ GOOGLE_GENAI_API_KEY 환경변수가 설정되어 있지 않습니다.')
  console.error('   .env.local 파일을 확인하세요.')
  process.exit(1)
}

const masked =
  key.length > 16
    ? `${key.slice(0, 6)}...${key.slice(-4)} (총 ${key.length}자)`
    : '(너무 짧음)'

console.log('🔑 Google AI 키 감지')
console.log(`   ${masked}`)
console.log(`   접두어: ${key.startsWith('AIza') ? 'AIza ✓' : '⚠ 비표준 (보통 AIza 로 시작)'}`)
console.log(`🤖 Gemini 모델: ${geminiModel}`)
console.log(`🎨 Imagen 모델: ${imagenModel}`)
console.log('')

// 2) Gemini 3 Pro 호출 테스트
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Test 1/2 · Gemini 텍스트 호출')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

const gemini = new GoogleGenerativeAI(key)

let geminiOk = false
let geminiResponse = ''

try {
  const t0 = Date.now()
  const model = gemini.getGenerativeModel({ model: geminiModel })
  const result = await model.generateContent(
    '연결 테스트입니다. "디안 AI Create 작동" 한 문장만 답변해주세요.',
  )
  const text = result.response.text()
  const elapsed = Date.now() - t0

  console.log(`✅ Gemini 호출 성공`)
  console.log(`📤 응답 모델: ${geminiModel}`)
  console.log(`⏱  응답 시간: ${elapsed}ms`)
  console.log(`💬 응답:`)
  console.log(`   ${text.trim()}`)
  console.log('')

  geminiOk = true
  geminiResponse = text.trim()
} catch (err) {
  console.error('❌ Gemini 호출 실패')
  console.error(`   ${err.message ?? err}`)
  if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('400')) {
    console.error('   → 키가 잘못됐거나 활성화 안 됐을 수 있음')
    console.error('   https://aistudio.google.com/app/apikey 에서 재발급 시도')
  } else if (err.message?.includes('not found') || err.message?.includes('404')) {
    console.error(`   → 모델명 "${geminiModel}" 이 잘못됐을 수 있음`)
    console.error('   .env.local 의 GEMINI_MODEL 을 확인 (gemini-2.5-pro 등)')
  } else if (err.message?.includes('429') || err.message?.includes('quota')) {
    console.error('   → 무료 한도 초과 또는 레이트 리밋')
  }
  console.log('')
}

// 3) Imagen 3 이미지 생성 테스트
if (!skipImage) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Test 2/2 · Imagen 3 이미지 생성')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const t0 = Date.now()

    // Imagen 3 는 generative-ai SDK 의 imageGeneration API 또는 직접 REST 호출
    // 현재 SDK 버전에 따라 다른 방식이 필요할 수 있음
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${imagenModel}:predict?key=${key}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [
          {
            prompt:
              'A simple test image: a soft beige square with subtle texture, minimal style, neutral light',
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
        },
      }),
    })

    const elapsed = Date.now() - t0

    if (!res.ok) {
      const errText = await res.text()
      console.error(`❌ Imagen 호출 실패 (HTTP ${res.status})`)
      console.error(`   ${errText.slice(0, 400)}`)
      if (res.status === 404) {
        console.error(`   → 모델 "${imagenModel}" 사용 불가 — 무료 tier 에서는`)
        console.error(`     Imagen 사용이 제한될 수 있음 (계정 등급 확인 필요)`)
      } else if (res.status === 403) {
        console.error('   → Imagen 사용 권한 없음 — Google AI Studio 에서')
        console.error('     이미지 생성 활성화 필요 또는 결제 정보 등록')
      }
    } else {
      const data = await res.json()
      const predictions = data.predictions ?? []
      if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
        const sizeKB = Math.round(predictions[0].bytesBase64Encoded.length * 0.75 / 1024)
        const outDir = join(projectRoot, 'docs/ai-create/runs/_test')
        fs.mkdirSync(outDir, { recursive: true })
        const outPath = join(outDir, 'gemini-test-image.png')
        fs.writeFileSync(outPath, Buffer.from(predictions[0].bytesBase64Encoded, 'base64'))

        console.log('✅ Imagen 호출 성공')
        console.log(`📤 응답 모델: ${imagenModel}`)
        console.log(`⏱  응답 시간: ${elapsed}ms`)
        console.log(`📁 파일 크기: ~${sizeKB} KB`)
        console.log(`💾 저장 위치: ${outPath}`)
      } else {
        console.error('❌ Imagen 응답 형식 비정상')
        console.error('   ', JSON.stringify(data).slice(0, 300))
      }
    }
    console.log('')
  } catch (err) {
    console.error('❌ Imagen 호출 중 예외')
    console.error(`   ${err.message ?? err}`)
    console.log('')
  }
}

// 4) 최종 요약
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📊 검증 결과 요약')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Gemini 텍스트:  ${geminiOk ? '✅ 작동' : '❌ 실패'}`)
console.log(`총 소요 시간:   ${Date.now() - startTime}ms`)
console.log('')

if (geminiOk) {
  console.log('🎉 디안 AI Create 시스템에서 Gemini 활용 가능합니다.')
  console.log('   다음 단계: 워시드 리넨 preview 의 9개 이미지 자리표시자를')
  console.log('   Imagen 3 로 자동 채우거나, Puppeteer 로 풀-페이지 PNG 캡처.')
} else {
  console.log('⚠️  Gemini 텍스트 호출 실패. 위 에러 메시지 확인 후')
  console.log('   .env.local 의 GOOGLE_GENAI_API_KEY 또는 GEMINI_MODEL 점검.')
  process.exit(1)
}
