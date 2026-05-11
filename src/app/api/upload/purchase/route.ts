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
    const hasGlogi = text.includes('GLOGITECH') || (text.includes('Ocean Inbound') && text.includes('TOTAL AMOUNT'))
    const hasImportDecl = text.includes('수입신고필증') || text.includes('수 입 신 고 필 증')
    const hasImportTax = text.includes('수입세금계산서') || text.includes('수 입 세 금 계 산 서')

    // 배 통관 번들 (글로지텍 INVOICE + 수입신고필증/세금계산서 한 PDF에 묶임)
    if (hasGlogi && (hasImportDecl || hasImportTax)) {
      return handleBundlePDF(text)
    }

    if (hasImportTax) {
      return handleImportTax(text)
    } else if (hasGlogi) {
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

// 수입세금계산서/수입신고필증에서 과세표준 + 세액 + 날짜 추출 (Claude AI)
// 주의: 프롬프트에 구체적인 숫자 예시를 넣으면 모델이 그대로 복사하는 경향이 있어
// 예시는 0/플레이스홀더만 사용
async function extractImportTaxFields(text: string): Promise<{ taxBase: number; taxAmount: number; date: string }> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    messages: [{
      role: 'user',
      content: `다음 PDF 텍스트는 한국 수입신고필증/수입세금계산서야. 3가지 필드를 정확히 추출해.

추출할 필드:
1. taxBase: 과세표준 원화금액 (필드명: "총과세가격 ￦" 또는 "부가가치세과표")
2. taxAmount: 부가가치세 원화금액 (필드명: "부가가치세" 또는 "총세액합계")
3. date: 수리일자 또는 신고일 (YYYY-MM-DD 형식, "/"는 "-"로 변환)

PDF 텍스트:
${text.slice(0, 6000)}

위 PDF에서 실제로 추출한 숫자를 JSON으로만 반환 (예시 복사 금지, 추출 실패시 0):
{"taxBase":<숫자>,"taxAmount":<숫자>,"date":"<YYYY-MM-DD>"}`,
    }],
  })

  const raw = msg.content[0]
  if (raw.type !== 'text') throw new Error('AI 응답 오류')
  const jsonMatch = raw.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('수입세금 파싱 실패')

  const parsed = JSON.parse(jsonMatch[0])
  return {
    taxBase: Number(parsed.taxBase) || 0,
    taxAmount: Number(parsed.taxAmount) || 0,
    date: parsed.date || '',
  }
}

// 글로지텍 INVOICE에서 운임/날짜/B/L 추출 (Claude AI — pdf-parse 텍스트 레이아웃이 깨져 regex 신뢰 불가)
async function extractGlogiFields(text: string): Promise<{ totalAmount: number; date: string; invoiceNo: string; blNo: string }> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `다음 PDF 텍스트는 글로지텍(GLOGITECH) 해운 INVOICE야. 4가지 필드를 추출해.

추출할 필드:
1. totalAmount: TOTAL AMOUNT KRW 원화금액 (운임+VAT 합계)
2. date: 청구일자 (YYYY-MM-DD 형식)
3. invoiceNo: INVOICE No. (예: OIHI로 시작)
4. blNo: H.B/L No. (예: YWYTIN으로 시작하는 코드. "FCL/LCL"이나 "M.B/L" 등 라벨이 아님)

PDF 텍스트:
${text.slice(0, 4000)}

위 PDF에서 실제로 추출한 값을 JSON으로만 반환 (예시 복사 금지, 추출 실패시 0/빈문자열):
{"totalAmount":<숫자>,"date":"<YYYY-MM-DD>","invoiceNo":"<문자열>","blNo":"<문자열>"}`,
    }],
  })

  const raw = msg.content[0]
  if (raw.type !== 'text') throw new Error('AI 응답 오류')
  const jsonMatch = raw.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('글로지텍 파싱 실패')

  const parsed = JSON.parse(jsonMatch[0])
  return {
    totalAmount: Number(parsed.totalAmount) || 0,
    date: parsed.date || '',
    invoiceNo: String(parsed.invoiceNo || '').trim(),
    blNo: String(parsed.blNo || '').trim(),
  }
}

// ── 수입세금계산서/수입신고필증 단독 업로드 ──
async function handleImportTax(text: string): Promise<NextResponse> {
  const { taxBase, taxAmount, date: dateStr } = await extractImportTaxFields(text)

  if (!taxAmount && !taxBase) {
    return NextResponse.json({ error: '과세표준/세액을 찾을 수 없습니다' }, { status: 400 })
  }

  const txDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
  const yearMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

  const transactionIds: string[] = []

  if (taxBase > 0) {
    await upsertMonthlyCost(taxBase, yearMonth, `수입원자재 (과세표준) | ${dateStr ?? ''}`)
    const tx = await prisma.transaction.create({
      data: {
        date: txDate,
        type: 'PURCHASE',
        description: '해외운송비 (수입원자재)',
        totalAmount: taxBase,
        taxAmount: 0,
        paymentMethod: 'TRANSFER',
        paymentStatus: 'PAID',
        channel: 'B2B',
        notes: `수입신고필증 과세표준 (CIF) | ${dateStr ?? ''}`,
        items: { create: [{ productName: '수입원자재 (CIF)', quantity: 1, unitPrice: taxBase, amount: taxBase }] },
      },
    })
    transactionIds.push(tx.id)
  }

  if (taxAmount > 0) {
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
    transactionIds.push(tx.id)
  }

  return NextResponse.json({
    success: true,
    type: 'import_tax',
    date: dateStr,
    totalAmount: taxBase + taxAmount,
    breakdown: { taxBase, taxAmount },
    transactionIds,
  })
}

// ── 배 통관 번들 (글로지텍 운임 + 수입신고필증/세금계산서) ──
async function handleBundlePDF(text: string): Promise<NextResponse> {
  // pdf-parse가 라벨/값을 분리해서 추출하므로 regex로는 신뢰 불가
  // 두 영역(글로지텍 INVOICE / 수입신고필증) 모두 Claude AI 로 추출
  const [
    { totalAmount: freightAmount, date: freightDate, invoiceNo, blNo },
    { taxBase, taxAmount, date: clearanceDate },
  ] = await Promise.all([
    extractGlogiFields(text),
    extractImportTaxFields(text),
  ])

  if (freightAmount === 0 && taxBase === 0 && taxAmount === 0) {
    return NextResponse.json({ error: '번들에서 어떤 금액도 추출하지 못했습니다.' }, { status: 400 })
  }

  // 운임은 freightDate, 수입세금은 clearanceDate 기준 (양쪽 다 있을 때 우선순위는 운임 청구일)
  const dateStr = freightDate || clearanceDate || ''
  const txDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
  const yearMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

  const blRef = blNo ? `B/L: ${blNo}` : ''
  const transactionIds: string[] = []

  // 글로지텍 운임
  if (freightAmount > 0) {
    await upsertMonthlyCost(freightAmount, yearMonth, `글로지텍 운임${invoiceNo ? ` | ${invoiceNo}` : ''}`)
    const tx = await prisma.transaction.create({
      data: {
        date: txDate,
        type: 'PURCHASE',
        description: '해외운송비 (글로지텍 운임)',
        totalAmount: freightAmount,
        taxAmount: 0,
        paymentMethod: 'TRANSFER',
        paymentStatus: 'PAID',
        channel: 'B2B',
        notes: [invoiceNo ? `Invoice: ${invoiceNo}` : '', blRef].filter(Boolean).join(' | '),
        items: { create: [{ productName: '해외운송비 (글로지텍)', quantity: 1, unitPrice: freightAmount, amount: freightAmount }] },
      },
    })
    transactionIds.push(tx.id)
  }

  // 수입원자재 (과세표준 CIF)
  if (taxBase > 0) {
    await upsertMonthlyCost(taxBase, yearMonth, `수입원자재 (과세표준)${blRef ? ` | ${blRef}` : ''}`)
    const tx = await prisma.transaction.create({
      data: {
        date: txDate,
        type: 'PURCHASE',
        description: '해외운송비 (수입원자재)',
        totalAmount: taxBase,
        taxAmount: 0,
        paymentMethod: 'TRANSFER',
        paymentStatus: 'PAID',
        channel: 'B2B',
        notes: ['수입신고필증 과세표준 (CIF)', blRef].filter(Boolean).join(' | '),
        items: { create: [{ productName: '수입원자재 (CIF)', quantity: 1, unitPrice: taxBase, amount: taxBase }] },
      },
    })
    transactionIds.push(tx.id)
  }

  // 수입세금 (부가세)
  if (taxAmount > 0) {
    await upsertMonthlyCost(taxAmount, yearMonth, `수입세금 (세액)${blRef ? ` | ${blRef}` : ''}`)
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
        notes: ['수입세금계산서 세액', blRef].filter(Boolean).join(' | '),
        items: { create: [{ productName: '수입세금', quantity: 1, unitPrice: taxAmount, amount: taxAmount }] },
      },
    })
    transactionIds.push(tx.id)
  }

  return NextResponse.json({
    success: true,
    type: 'glogi_freight',
    date: dateStr,
    invoiceNo,
    blNo,
    totalAmount: freightAmount + taxBase + taxAmount,
    breakdown: { freight: freightAmount, taxBase, taxAmount },
    transactionIds,
  })
}

// ── 글로지텍 해운 인보이스 (단독) ──
async function handleGlogiInvoice(text: string): Promise<NextResponse> {
  const { totalAmount, date: dateStr, invoiceNo, blNo } = await extractGlogiFields(text)

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
