/**
 * POST /api/documents/quote-ocr
 *
 * 견적서 이미지(JPG/PNG)를 Claude 비전으로 읽어 견적서 JSON(data 형식)으로 변환.
 * 대금 청구서 작성에서 "파일로 불러오기"에 이미지가 들어올 때 사용 (대표 지시 2026-11-05).
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5'

const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp'])

const SYSTEM = `당신은 디안(DiAN) 원단 회사의 견적서 이미지를 데이터로 옮기는 정밀 판독기입니다.
견적서 이미지에서 아래 JSON 스키마대로 값을 추출해 **JSON 하나만** 출력하세요. 설명·코드펜스 금지.

{
  "quoteDate": "견적일 (이미지 표기 그대로, 예: 2026년 10월 30일)",
  "clientName": "수신 거래처명 (귀하/귀중 제외)",
  "attn": "담당자명 (없으면 빈 문자열)",
  "clientTel": "전화번호 (없으면 빈 문자열)",
  "siteName": "현장명 (없으면 빈 문자열)",
  "vatMode": "excl 또는 incl",
  "notes": ["표 아래 REMARK 문구를 한 줄씩 (* 기호 제외, 없으면 빈 배열)"],
  "items": [
    { "name": "품목명", "color": "색상 (품목명 뒤 괄호 안 코드, 없으면 빈 문자열)", "spec": "규격", "qty": "수량", "unit": "단위", "price": "단가", "remark": "비고" }
  ]
}

규칙:
- 숫자(qty, price)는 콤마 없는 순수 숫자 문자열로 ("18,000" → "18000").
- 상단 금액 라벨이 "공급가액 (VAT 별도)"면 vatMode="excl", "합계금액 (VAT 포함)"이면 "incl". 불명확하면 "excl".
- items에는 실제 품목 행만. 공급가액/부가세/총합계 같은 합계 행은 제외.
- 품목명이 "린넨 쉬어 (IV)"처럼 괄호 색상을 포함하면 name="린넨 쉬어", color="IV"로 분리.
- 읽을 수 없는 칸은 빈 문자열. 값을 지어내지 말 것.`

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { image?: string; media_type?: string }
    const image = (body.image || '').replace(/\s/g, '')
    const mediaType = body.media_type || 'image/jpeg'
    if (!image) return NextResponse.json({ error: '이미지가 없습니다.' }, { status: 400 })
    if (!ALLOWED_MEDIA.has(mediaType)) {
      return NextResponse.json({ error: `지원하지 않는 이미지 형식: ${mediaType}` }, { status: 400 })
    }
    // base64 4MB(원본 ~3MB) 초과 거부 — 클라이언트에서 축소해 보내는 것이 정상
    if (image.length > 4_200_000) {
      return NextResponse.json({ error: '이미지가 너무 큽니다. 다시 시도해주세요.' }, { status: 413 })
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: image },
            },
            { type: 'text', text: '이 견적서를 스키마대로 JSON으로 변환해줘.' },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: '이미지를 처리할 수 없습니다.' }, { status: 422 })
    }

    let text = ''
    for (const block of response.content) {
      if (block.type === 'text') text += block.text
    }
    // 코드펜스·앞뒤 잡음 방어
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end <= start) {
      return NextResponse.json({ error: '견적서 내용을 읽지 못했습니다.' }, { status: 422 })
    }
    const data = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return NextResponse.json({ error: '이미지에서 품목을 찾지 못했습니다.' }, { status: 422 })
    }
    return NextResponse.json({ data })
  } catch (e) {
    console.error('quote-ocr failed:', e)
    const msg = e instanceof Anthropic.APIError ? `AI 호출 실패 (${e.status})` : '견적서 이미지 읽기 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
