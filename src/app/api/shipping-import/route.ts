import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import pdfParse from 'pdf-parse'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

interface ParsedDoc {
  docType: 'invoice' | 'customs'
  amount: number
  date: string
  vendor: string
  fileName: string
}

interface SaveItem {
  docType: 'invoice' | 'customs'
  amount: number
  date: string
  vendor: string
}

async function parseOnePdf(buffer: Buffer, fileName: string): Promise<ParsedDoc> {
  const data = await pdfParse(buffer)
  const text = data.text.slice(0, 4000)

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `해외운송 관련 한국 문서에서 금액을 추출하세요.

문서:
${text}

두 종류 중 하나입니다:
1. 물류/해운 인보이스 (예: GLOGITECH) → "TOTAL AMOUNT" 뒤 KRW 합계
2. 수입세금계산서 → 세액(세금합계, 과세표준의 약 10%)

JSON만 반환 (다른 텍스트 없이):
{"docType":"invoice","amount":1054394,"date":"2026-03-19","vendor":"글로지텍"}
또는
{"docType":"customs","amount":351892,"date":"2026-03-18","vendor":"세관"}`,
    }],
  })

  const raw = msg.content[0]
  if (raw.type !== 'text') throw new Error('AI 응답 오류')

  const jsonMatch = raw.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('JSON 파싱 실패')

  const parsed = JSON.parse(jsonMatch[0])
  return { ...parsed, fileName }
}

// POST multipart → PDF 파싱만 (미리보기)
// POST JSON { items } → DB 저장
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''

  // ── 저장 모드 ──
  if (contentType.includes('application/json')) {
    try {
      const { items }: { items: SaveItem[] } = await request.json()
      if (!items?.length) return NextResponse.json({ error: '항목 없음' }, { status: 400 })

      const created = await Promise.all(items.map(async (item) => {
        const label = item.docType === 'invoice' ? '해외운송비 (운임)' : '해외운송비 (수입세금)'
        return prisma.transaction.create({
          data: {
            date: new Date(item.date),
            type: 'PURCHASE',
            description: label,
            totalAmount: item.amount,
            taxAmount: 0,
            paymentMethod: 'TRANSFER',
            paymentStatus: 'PAID',
            channel: 'B2B',
            notes: item.vendor,
            items: {
              create: [{
                productName: label,
                quantity: 1,
                unitPrice: item.amount,
                amount: item.amount,
              }],
            },
          },
        })
      }))

      return NextResponse.json({ saved: created.length })
    } catch (err) {
      console.error('shipping-import save error:', err)
      return NextResponse.json({ error: '저장 오류' }, { status: 500 })
    }
  }

  // ── 파싱 모드 ──
  try {
    const form = await request.formData()
    const files = form.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ error: '파일을 선택해주세요' }, { status: 400 })

    const results: ParsedDoc[] = []
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const parsed = await parseOnePdf(buffer, file.name)
      results.push(parsed)
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('shipping-import parse error:', err)
    return NextResponse.json({ error: `파싱 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}` }, { status: 500 })
  }
}
