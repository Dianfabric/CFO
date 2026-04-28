import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const runtime = 'nodejs'

async function getPdfParse() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('pdf-parse/lib/pdf-parse.js')
}

async function upsertMonthlyCost(amount: number, yearMonth: string, notes: string) {
  const category = await prisma.costCategory.findFirst({
    where: { name: { contains: '해외' } },
  })
  if (!category) return
  const existing = await prisma.monthlyCost.findUnique({
    where: { costCategoryId_yearMonth: { costCategoryId: category.id, yearMonth } },
  })
  if (existing) {
    await prisma.monthlyCost.update({
      where: { id: existing.id },
      data: { amount: existing.amount + amount, notes, source: 'PDF_UPLOAD' },
    })
  } else {
    await prisma.monthlyCost.create({
      data: { costCategoryId: category.id, yearMonth, amount, source: 'PDF_UPLOAD', notes },
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const pdfParse = await getPdfParse()
    const data = await pdfParse(buffer)
    const text = data.text as string

    // 문서 유형 자동 판별
    if (text.includes('수입세금계산서') || text.includes('수 입 세 금 계 산 서')) {
      return handleImportTax(text)
    } else if (text.includes('GLOGITECH') || (text.includes('Ocean Inbound') && text.includes('TOTAL AMOUNT'))) {
      return handleGlogiInvoice(text)
    } else if (text.includes('관세법인') || text.includes('자금요청서') || (text.includes('GLOBAL TEXTILE') && text.includes('관세'))) {
      return handleCustomsPDF(text)
    } else if (text.includes('ROADSUN') || text.includes('로드썬') || (text.includes('INVOICE') && text.includes('AIR EXPRESS'))) {
      return handleFreightPDF(text)
    } else {
      return NextResponse.json({
        error: '알 수 없는 PDF 형식입니다. 지원: 관세 청구서, 로드썬 인보이스, 글로지텍 인보이스, 수입세금계산서',
      }, { status: 400 })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Purchase upload error:', msg)
    return NextResponse.json({ error: '파일 처리 중 오류가 발생했습니다.', detail: msg.slice(0, 300) }, { status: 500 })
  }
}

// ── 수입세금계산서 (Claude AI로 세액 파싱) ──
async function handleImportTax(text: string): Promise<NextResponse> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `수입세금계산서에서 세액과 날짜를 추출하세요.

${text.slice(0, 3000)}

JSON만 반환 (다른 텍스트 없이):
{"taxAmount":351892,"date":"2026-03-18"}`,
    }],
  })

  const raw = msg.content[0]
  if (raw.type !== 'text') return NextResponse.json({ error: 'AI 응답 오류' }, { status: 500 })
  const jsonMatch = raw.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: '세액 파싱 실패' }, { status: 400 })

  const { taxAmount, date: dateStr } = JSON.parse(jsonMatch[0])
  if (!taxAmount || taxAmount === 0) return NextResponse.json({ error: '세액을 찾을 수 없습니다' }, { status: 400 })

  const txDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
  const yearMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

  await upsertMonthlyCost(taxAmount, yearMonth, `수입세금 (세액) | ${dateStr ?? ''}`)

  const tx = await prisma.transaction.create({
    data: {
      date: txDate,
      type: 'PURCHASE',
      description: '해외운송비 (수입세금)',
      totalAmount: taxAmount,
      taxAmount: 0,
      paymentMethod: 'TRANSFER',
      paymentStatus: 'PAID',
      channel: 'B2B',
      notes: `수입세금계산서 세액 | ${dateStr ?? ''}`,
      items: { create: [{ productName: '수입세금', quantity: 1, unitPrice: taxAmount, amount: taxAmount }] },
    },
  })

  return NextResponse.json({ success: true, type: 'import_tax', date: dateStr, totalAmount: taxAmount, transactionId: tx.id })
}

// ── 글로지텍 해운 인보이스 ──
async function handleGlogiInvoice(text: string): Promise<NextResponse> {
  const extractNum = (pattern: RegExp) => {
    const m = text.match(pattern)
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0
  }
  const extractStr = (pattern: RegExp) => {
    const m = text.match(pattern)
    return m ? m[1].trim() : ''
  }

  // "TOTAL AMOUNT: KRW 1,054,394"
  const totalAmount = extractNum(/TOTAL AMOUNT[:\s]+KRW[\s]*([\d,]+)/)
  const dateStr = extractStr(/청구일자\s*:\s*(\d{4}-\d{2}-\d{2})/) || extractStr(/(\d{4}-\d{2}-\d{2})/)
  const invoiceNo = extractStr(/INVOICE No\.\s*:\s*(\S+)/)
  const blNo = extractStr(/H\.B\/L No\.\s*:\s*(\S+)/)

  if (totalAmount === 0) {
    return NextResponse.json({ error: 'TOTAL AMOUNT를 파싱할 수 없습니다.' }, { status: 400 })
  }

  const txDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
  const yearMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

  await upsertMonthlyCost(totalAmount, yearMonth, `글로지텍 운임${invoiceNo ? ` | ${invoiceNo}` : ''}`)

  const tx = await prisma.transaction.create({
    data: {
      date: txDate,
      type: 'PURCHASE',
      description: '해외운송비 (글로지텍 운임)',
      totalAmount,
      taxAmount: 0,
      paymentMethod: 'TRANSFER',
      paymentStatus: 'PAID',
      channel: 'B2B',
      notes: [invoiceNo ? `Invoice: ${invoiceNo}` : '', blNo ? `B/L: ${blNo}` : ''].filter(Boolean).join(' | '),
      items: { create: [{ productName: '해외운송비 (글로지텍)', quantity: 1, unitPrice: totalAmount, amount: totalAmount }] },
    },
  })

  return NextResponse.json({ success: true, type: 'glogi_freight', date: dateStr, invoiceNo, blNo, totalAmount, transactionId: tx.id })
}

// ── 관세법인 앤에스 자금요청서 ──
async function handleCustomsPDF(text: string): Promise<NextResponse> {
  const extractNum = (pattern: RegExp) => {
    const m = text.match(pattern)
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0
  }
  const extractStr = (pattern: RegExp) => {
    const m = text.match(pattern)
    return m ? m[1].trim() : ''
  }

  const dateStr = extractStr(/\n\s*(\d{4}-\d{2}-\d{2})\s*\n/)
  const blNo = extractStr(/(RSE\d+)/)
  const supplier = extractStr(/GLOBAL\s+([\w\s.,()]+)\n/)
  const customs = extractNum(/관세\s*([\d,]+)/)
  const vat = extractNum(/부가세\s*([\d,]+)/)
  const warehouse = extractNum(/창고료\s*([\d,]+)/)
  const clearanceFee = extractNum(/통관수수료\s*([\d,]+)/)
  const totalBilled = extractNum(/\n\s*([\d,]+)\s*\n미\s*수\s*금/)

  if (totalBilled === 0) return NextResponse.json({ error: '청구금액을 파싱할 수 없습니다.' }, { status: 400 })

  const txDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
  const yearMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

  await upsertMonthlyCost(
    totalBilled, yearMonth,
    `관세 ${customs.toLocaleString()} | 부가세 ${vat.toLocaleString()}${blNo ? ` | B/L: ${blNo}` : ''}`,
  )

  const tx = await prisma.transaction.create({
    data: {
      date: txDate,
      type: 'EXPENSE',
      description: '관세/통관비용',
      totalAmount: totalBilled,
      taxAmount: vat,
      paymentMethod: 'TRANSFER',
      paymentStatus: 'PAID',
      channel: 'B2B',
      notes: [blNo ? `B/L: ${blNo}` : '', supplier ? `공급자: ${supplier}` : '',
        `관세: ${customs.toLocaleString()}원`, `부가세: ${vat.toLocaleString()}원`,
        warehouse > 0 ? `창고료: ${warehouse.toLocaleString()}원` : '',
        clearanceFee > 0 ? `통관수수료: ${clearanceFee.toLocaleString()}원` : '',
      ].filter(Boolean).join(' | '),
      items: {
        create: [
          customs > 0 && { productName: '관세', quantity: 1, unitPrice: customs, amount: customs },
          vat > 0 && { productName: '부가세', quantity: 1, unitPrice: vat, amount: vat },
          warehouse > 0 && { productName: '창고료', quantity: 1, unitPrice: warehouse, amount: warehouse },
          clearanceFee > 0 && { productName: '통관수수료', quantity: 1, unitPrice: clearanceFee, amount: clearanceFee },
        ].filter(Boolean) as { productName: string; quantity: number; unitPrice: number; amount: number }[],
      },
    },
  })

  return NextResponse.json({ success: true, type: 'customs', date: dateStr, blNo, supplier, breakdown: { customs, vat, warehouse, clearanceFee }, totalBilled, transactionId: tx.id })
}

// ── 로드썬 항공운임 인보이스 ──
async function handleFreightPDF(text: string): Promise<NextResponse> {
  const extractNum = (pattern: RegExp) => {
    const m = text.match(pattern)
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0
  }
  const extractStr = (pattern: RegExp) => {
    const m = text.match(pattern)
    return m ? m[1].trim() : ''
  }

  const dateStr = extractStr(/(\d{4}-\d{2}-\d{2})\s*\//)
  const invoiceNo = extractStr(/\d{4}-\d{2}-\d{2}\s*\/\s*([^\s\n]+)/)
  const totalAmount = extractNum(/TOTAL\s*AMOUNT\s*:\s*\(KRW\)\s*([\d,]+)/)
  const freight = extractNum(/SUB TOTAL[\s\S]*?KRW\s+([\d,]+)/)

  if (totalAmount === 0) return NextResponse.json({ error: 'TOTAL AMOUNT를 파싱할 수 없습니다.' }, { status: 400 })

  const txDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
  const yearMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

  await upsertMonthlyCost(totalAmount, yearMonth, `로드썬 운임${invoiceNo ? ` | Invoice: ${invoiceNo}` : ''}`)

  const tx = await prisma.transaction.create({
    data: {
      date: txDate,
      type: 'EXPENSE',
      description: '국제운송비 (로드썬)',
      totalAmount,
      taxAmount: 0,
      paymentMethod: 'TRANSFER',
      paymentStatus: 'UNPAID',
      channel: 'B2B',
      notes: [invoiceNo ? `Invoice: ${invoiceNo}` : '', freight > 0 ? `운임합계: ${freight.toLocaleString()}원` : ''].filter(Boolean).join(' | '),
      items: { create: [{ productName: '국제항공운송비', quantity: 1, unitPrice: totalAmount, amount: totalAmount, notes: invoiceNo || null }] },
    },
  })

  return NextResponse.json({ success: true, type: 'freight', date: dateStr, invoiceNo, freight, totalAmount, transactionId: tx.id })
}
