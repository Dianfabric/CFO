import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST /api/samples/ocr — 명함 사진 → 거래처 정보 자동 추출
//   body: { imageBase64: "data:image/jpeg;base64,..." 또는 순수 base64, mediaType?: "image/jpeg" }
export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다' }, { status: 500 })
    }
    const { imageBase64, mediaType } = await request.json()
    if (!imageBase64) return NextResponse.json({ error: '이미지가 필요합니다' }, { status: 400 })

    const m = /^data:(image\/\w+);base64,(.+)$/.exec(imageBase64)
    const type = (m?.[1] || mediaType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'
    const data = m?.[2] || imageBase64

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: type, data } },
          {
            type: 'text',
            text: '명함 사진이야. 원단회사 거래처 등록에 쓸 정보를 JSON으로만 답해줘 (설명 없이):\n' +
              '{"company":"회사명","person":"이름","title":"직급/직함","phone":"휴대폰(010 우선, 하이픈 포함)","email":"이메일","clientName":"회사명(이름직급) 형식"}\n' +
              '읽을 수 없는 항목은 빈 문자열. clientName 예시: "현대리바트(안희연책임)"',
          },
        ],
      }],
    })
    const text = msg.content.find((b) => b.type === 'text')?.text || '{}'
    const json = JSON.parse(text.replace(/```json|```/g, '').trim())
    return NextResponse.json(json)
  } catch (e) {
    console.error('samples/ocr', e)
    return NextResponse.json({ error: '명함 인식에 실패했습니다. 직접 입력해주세요.' }, { status: 500 })
  }
}
