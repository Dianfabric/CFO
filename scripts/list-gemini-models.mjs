/**
 * 사용 가능한 Gemini / Imagen 모델 목록 조회
 *
 * Google AI Studio 키로 access 가능한 모델만 표시.
 * (계정 등급에 따라 일부 모델은 안 보일 수 있음)
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

config({ path: join(projectRoot, '.env'), override: true })
config({ path: join(projectRoot, '.env.local'), override: true })

const key = process.env.GOOGLE_GENAI_API_KEY
if (!key) {
  console.error('❌ GOOGLE_GENAI_API_KEY 없음')
  process.exit(1)
}

console.log('📡 ListModels 호출 중...\n')

try {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
  )

  if (!res.ok) {
    const errText = await res.text()
    console.error(`❌ HTTP ${res.status}`)
    console.error(errText)
    process.exit(1)
  }

  const data = await res.json()
  const models = data.models ?? []

  // Gemini 텍스트 모델
  const geminiText = models.filter(
    (m) =>
      m.name.includes('gemini') &&
      m.supportedGenerationMethods?.includes('generateContent') &&
      !m.name.includes('embedding'),
  )

  // Imagen / 이미지 생성 모델
  const imageGen = models.filter(
    (m) =>
      (m.name.includes('imagen') || m.name.includes('imagegen')) ||
      m.supportedGenerationMethods?.includes('predict'),
  )

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📝 Gemini 텍스트 모델 (${geminiText.length})`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  for (const m of geminiText) {
    const id = m.name.replace('models/', '')
    const ver = m.version ? ` v${m.version}` : ''
    const display = m.displayName ? ` — ${m.displayName}` : ''
    console.log(`  • ${id}${ver}${display}`)
  }

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`🎨 이미지 생성 모델 (${imageGen.length})`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (imageGen.length === 0) {
    console.log('  (없음 — 무료 tier 에서는 Imagen 미지원일 수 있음)')
  } else {
    for (const m of imageGen) {
      const id = m.name.replace('models/', '')
      const display = m.displayName ? ` — ${m.displayName}` : ''
      console.log(`  • ${id}${display}`)
    }
  }

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ 권장 모델 (가장 최신 Gemini Pro)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  // "pro" 가 들어가고 가장 최신 (preview 또는 latest 우선)
  const pros = geminiText
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => n.includes('pro') && !n.includes('1.0') && !n.includes('1.5'))
  if (pros.length > 0) {
    pros.sort((a, b) => b.localeCompare(a)) // 역순 (최신 먼저)
    console.log(`  GEMINI_MODEL=${pros[0]}`)
  } else if (geminiText.length > 0) {
    console.log(`  GEMINI_MODEL=${geminiText[0].name.replace('models/', '')}`)
  }

  if (imageGen.length > 0) {
    const id = imageGen[0].name.replace('models/', '')
    console.log(`  IMAGEN_MODEL=${id}`)
  } else {
    console.log(`  IMAGEN_MODEL=(이미지 생성 미지원 — 텍스트만 사용)`)
  }
} catch (err) {
  console.error('❌ 호출 실패')
  console.error(err.message ?? err)
  process.exit(1)
}
