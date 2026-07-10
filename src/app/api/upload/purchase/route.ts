import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const runtime = 'nodejs'
export const maxDuration = 300

const STORAGE_BUCKET = 'shipping-uploads'

/** 같은 날 + 같은 설명 + 같은 금액이 이미 있으면 중복 — 재업로드 이중 등록 방지 */
async function isDuplicate(txDate: Date, type: 'PURCHASE' | 'EXPENSE', description: string, amount: number): Promise<boolean> {
  const dayStart = new Date(txDate); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(txDate); dayEnd.setHours(23, 59, 59, 999)
  const existing = await prisma.transaction.findFirst({
    where: { type, description, totalAmount: amount, date: { gte: dayStart, lte: dayEnd } },
    select: { id: true },
  })
  return !!existing
}

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

// 4MB 초과 파일용 — Supabase Storage 서명 업로드 URL 발급 (Vercel 요청 한도 4.5MB 우회)
export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get('signedUrl') !== '1') {
      return NextResponse.json({ error: 'signedUrl=1 필요' }, { status: 400 })
    }
    const name = (request.nextUrl.searchParams.get('name') ?? 'file.pdf').replace(/[^\w.\-가-힣]/g, '_')
    const path = `tmp/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`
    const supabase = createServiceClient()
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      return NextResponse.json({ error: `업로드 URL 발급 실패: ${error?.message ?? ''}` }, { status: 500 })
    }
    return NextResponse.json({ path: data.path, token: data.token })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let buffer: Buffer
    let storagePath: string | null = null

    if (contentType.includes('application/json')) {
      // 대용량 경로: 클라이언트가 Storage에 올린 파일을 서버가 내려받아 파싱
      const body = await request.json() as { storagePath?: string }
      if (!body.storagePath || !body.storagePath.startsWith('tmp/')) {
        return NextResponse.json({ error: 'storagePath 필요' }, { status: 400 })
      }
      storagePath = body.storagePath
      const supabase = createServiceClient()
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath)
      if (error || !data) {
        return NextResponse.json({ error: `스토리지 다운로드 실패: ${error?.message ?? ''}` }, { status: 500 })
      }
      buffer = Buffer.from(await data.arrayBuffer())
    } else {
      const formData = await request.formData()
      const file = formData.get('file') as File
      if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
      buffer = Buffer.from(await file.arrayBuffer())
    }

    const res = await processPdfBuffer(buffer)

    // 임시 스토리지 파일 정리 (실패해도 무시)
    if (storagePath) {
      try {
        const supabase = createServiceClient()
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
      } catch { /* noop */ }
    }
    return res
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Purchase upload error:', msg)
    return NextResponse.json({ error: '파일 처리 중 오류가 발생했습니다.', detail: msg.slice(0, 300) }, { status: 500 })
  }
}

async function processPdfBuffer(buffer: Buffer): Promise<NextResponse> {
  const pdfParse = await getPdfParse()
  const data = await pdfParse(buffer)
  const text = data.text as string

  // 스캔본(텍스트 레이어 없음) → Claude 비전으로 전체 추출
  if (text.replace(/\s/g, '').length < 60) {
    return handleScannedPDF(buffer)
  }

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
}

// ── 스캔본 PDF (텍스트 레이어 없음) — Claude 비전으로 번들 필드 추출 ──
async function handleScannedPDF(buffer: Buffer): Promise<NextResponse> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } },
        {
          type: 'text',
          text: `스캔된 해외운송 서류 묶음입니다. 글로지텍(GLOGITECH) 해운 인보이스와 수입신고필증을 찾아 JSON만 반환:
{"freight":{"totalAmount":TOTAL AMOUNT KRW 숫자(없으면 0),"date":"청구일 YYYY-MM-DD","invoiceNo":"OIHI로 시작","blNo":"H.B/L YWYTIN으로 시작"},"importDecl":{"taxBase":부가가치세과표 숫자(없으면 0),"taxAmount":총세액합계 숫자(없으면 0),"date":"수리일자 YYYY-MM-DD"}}`,
        },
      ],
    }],
  })
  let raw = ''
  for (const c of msg.content) if (c.type === 'text') raw += c.text
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: '스캔본에서 금액을 추출하지 못했습니다.' }, { status: 400 })
  const parsed = JSON.parse(jsonMatch[0]) as {
    freight?: { totalAmount?: number; date?: string; invoiceNo?: string; blNo?: string }
    importDecl?: { taxBase?: number; taxAmount?: number; date?: string }
  }
  const freightAmount = Number(parsed.freight?.totalAmount) || 0
  const taxBase = Number(parsed.importDecl?.taxBase) || 0
  const taxAmount = Number(parsed.importDecl?.taxAmount) || 0
  if (freightAmount === 0 && taxBase === 0 && taxAmount === 0) {
    return NextResponse.json({ error: '스캔본에서 어떤 금액도 추출하지 못했습니다.' }, { status: 400 })
  }
  return saveGlogiBundle({
    freightAmount,
    freightDate: parsed.freight?.date || '',
    invoiceNo: String(parsed.freight?.invoiceNo ?? '').trim(),
    blNo: String(parsed.freight?.blNo ?? '').trim(),
    taxBase,
    taxAmount,
    clearanceDate: parsed.importDecl?.date || '',
  })
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
  const skipped: string[] = []

  if (taxBase > 0) {
    if (await isDuplicate(txDate, 'PURCHASE', '해외운송비 (수입원자재)', taxBase)) {
      skipped.push('수입원자재')
    } else {
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
  }

  if (taxAmount > 0) {
    if (await isDuplicate(txDate, 'PURCHASE', '해외운송비 (수입세금)', taxAmount)) {
      skipped.push('수입세금')
    } else {
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
  }

  return NextResponse.json({
    success: true,
    type: 'import_tax',
    date: dateStr,
    totalAmount: taxBase + taxAmount,
    breakdown: { taxBase, taxAmount },
    transactionIds,
    skipped,
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

  return saveGlogiBundle({ freightAmount, freightDate, invoiceNo, blNo, taxBase, taxAmount, clearanceDate })
}

interface GlogiBundleFields {
  freightAmount: number
  freightDate: string
  invoiceNo: string
  blNo: string
  taxBase: number
  taxAmount: number
  clearanceDate: string
}

async function saveGlogiBundle(f: GlogiBundleFields): Promise<NextResponse> {
  const { freightAmount, freightDate, invoiceNo, blNo, taxBase, taxAmount, clearanceDate } = f

  // 운임은 freightDate, 수입세금은 clearanceDate 기준 (양쪽 다 있을 때 우선순위는 운임 청구일)
  const dateStr = freightDate || clearanceDate || ''
  const txDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
  const yearMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

  const blRef = blNo ? `B/L: ${blNo}` : ''
  const transactionIds: string[] = []
  const skipped: string[] = []

  // 글로지텍 운임
  if (freightAmount > 0) {
    if (await isDuplicate(txDate, 'PURCHASE', '해외운송비 (글로지텍 운임)', freightAmount)) {
      skipped.push('운임')
    } else {
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
  }

  // 수입원자재 (과세표준 CIF)
  if (taxBase > 0) {
    if (await isDuplicate(txDate, 'PURCHASE', '해외운송비 (수입원자재)', taxBase)) {
      skipped.push('수입원자재')
    } else {
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
  }

  // 수입세금 (부가세)
  if (taxAmount > 0) {
    if (await isDuplicate(txDate, 'PURCHASE', '해외운송비 (수입세금)', taxAmount)) {
      skipped.push('수입세금')
    } else {
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
    skipped, // 이미 등록돼 건너뛴 항목 (재업로드 중복 방지)
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

  if (await isDuplicate(txDate, 'PURCHASE', '해외운송비 (글로지텍 운임)', totalAmount)) {
    return NextResponse.json({ success: true, type: 'glogi_freight', date: dateStr, invoiceNo, blNo, totalAmount, skipped: ['운임'] })
  }

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

  if (await isDuplicate(txDate, 'EXPENSE', '관세/통관비용', totalBilled)) {
    return NextResponse.json({ success: true, type: 'customs', date: dateStr, blNo, totalBilled, skipped: ['관세/통관'] })
  }

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

  if (await isDuplicate(txDate, 'EXPENSE', '국제운송비 (로드썬)', totalAmount)) {
    return NextResponse.json({ success: true, type: 'freight', date: dateStr, invoiceNo, totalAmount, skipped: ['로드썬 운임'] })
  }

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
