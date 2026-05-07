/**
 * Imagen 4 응답 구조 디버그
 * - 다양한 요청 형식 시도
 * - raw 응답 출력
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

config({ path: join(projectRoot, '.env'), override: true })
config({ path: join(projectRoot, '.env.local'), override: true })

const key = process.env.GOOGLE_GENAI_API_KEY
const model = process.env.IMAGEN_MODEL ?? 'imagen-4.0-generate-001'

console.log(`🎨 Imagen 디버그 — model: ${model}\n`)

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${key}`

const payload = {
  instances: [
    {
      prompt: 'A simple beige square with subtle linen texture, minimal, neutral light',
    },
  ],
  parameters: {
    sampleCount: 1,
  },
}

console.log('📤 Request payload:')
console.log(JSON.stringify(payload, null, 2))
console.log('')

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  console.log(`📥 HTTP ${res.status} ${res.statusText}`)
  console.log('')

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    console.log('📄 Raw text response:')
    console.log(text)
    process.exit(1)
  }

  console.log('📦 Response keys:', Object.keys(data))
  console.log('')

  // Predictions 가 있으면 첫 항목의 키들 출력
  if (data.predictions && data.predictions.length > 0) {
    console.log('✅ predictions 존재')
    const first = data.predictions[0]
    console.log('   첫 prediction keys:', Object.keys(first))

    // bytesBase64Encoded
    if (first.bytesBase64Encoded) {
      const sizeKB = Math.round(first.bytesBase64Encoded.length * 0.75 / 1024)
      console.log(`   bytesBase64Encoded: ${sizeKB} KB`)

      const outDir = join(projectRoot, 'docs/ai-create/runs/_test')
      fs.mkdirSync(outDir, { recursive: true })
      const outPath = join(outDir, 'imagen-test.png')
      fs.writeFileSync(outPath, Buffer.from(first.bytesBase64Encoded, 'base64'))
      console.log(`   💾 저장: ${outPath}`)
    } else {
      console.log('   ⚠ bytesBase64Encoded 없음 — 다른 필드 확인:')
      for (const [k, v] of Object.entries(first)) {
        const sample = typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v).slice(0, 80)
        console.log(`     ${k}: ${sample}...`)
      }
    }
  } else {
    console.log('❌ predictions 없음 또는 비어있음')
    console.log('')
    console.log('📄 전체 응답 (raw):')
    console.log(JSON.stringify(data, null, 2))
  }
} catch (err) {
  console.error('❌ 호출 실패')
  console.error(err.message ?? err)
}
