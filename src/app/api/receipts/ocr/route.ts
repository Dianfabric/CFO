/**
 * 간이영수증 사진 OCR — Claude 비전으로 날짜·상호·항목·금액 자동 추출.
 *
 * POST multipart(image) → { ok, date, vendor, item, amount, raw? }
 * 판독 실패/불확실 값은 빈 문자열 또는 0 으로 반환 (사용자가 손입력 보정).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAnthropic, MODEL, extractText, parseJsonResponse } from '@/lib/anthropic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface OcrResult {
  date?: string
  vendor?: string
  item?: string
  amount?: number | string
}

function prompt(currentYear: number): string {
  return `이 사진은 한국의 손글씨 간이영수증이다. 아래 항목을 읽어 JSON 한 줄로만 출력하라.
{"date":"YYYY-MM-DD","vendor":"공급자 상호","item":"종목 또는 품목","amount":정수원화}

규칙:
- date: '작성년월일' 칸. 연도가 '20'처럼 일부만 인쇄돼 있으면 ${currentYear}년으로 간주하고, 월·일 손글씨를 판독한다.
- vendor: 공급자 '상호'(예: (주)일신항공해운). 없으면 "".
- item: '종목' 또는 '품목'(예: 항공운송대행, 서비스, 운송료). 없으면 "".
- amount: '공급대가총액' 또는 '위 금액을 영수(청구)함'의 금액. ₩·콤마 제거한 숫자만. 판독 불가하면 0.
- 확실하지 않은 값은 비우거나 0으로 둔다. 설명·코드펜스 없이 JSON 한 줄만 출력.`
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('image') as File | null
    if (!file || file.size === 0) {
      return NextResponse.json({ ok: false, error: '이미지가 없습니다.' }, { status: 400 })
    }
    const mediaType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    const currentYear = new Date().getFullYear()

    const anthropic = getAnthropic()
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: base64,
              },
            },
            { type: 'text', text: prompt(currentYear) },
          ],
        },
      ],
    })

    const parsed = parseJsonResponse<OcrResult>(extractText(msg))
    if (!parsed) {
      return NextResponse.json({ ok: true, date: '', vendor: '', item: '', amount: 0 })
    }

    // 날짜 형식 검증 (YYYY-MM-DD)
    const date = typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date.trim())
      ? parsed.date.trim()
      : ''
    const vendor = (parsed.vendor ?? '').toString().trim()
    const item = (parsed.item ?? '').toString().trim()
    const amountNum = Math.max(0, Math.floor(Number(String(parsed.amount ?? 0).replace(/[^0-9.]/g, '')) || 0))

    return NextResponse.json({ ok: true, date, vendor, item, amount: amountNum })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'OCR 실패' },
      { status: 500 },
    )
  }
}
