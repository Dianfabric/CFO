import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { normBankName as normName } from '@/lib/bank-name'

export const runtime = 'nodejs'

function parseDateTime(v: unknown): Date | null {
  const s = String(v ?? '').trim()
  // "2026-06-02 18:02:27"
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})[T\s]?(\d{0,2}):?(\d{0,2}):?(\d{0,2})/)
  if (!m) return null
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
    parseInt(m[4] || '12'), parseInt(m[5] || '0'), parseInt(m[6] || '0'))
}

function parseNum(v: unknown): number {
  const s = String(v ?? '').replace(/,/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.abs(n)
}

// 내부 거래/비AR 키워드 (잔액에 영향 없음, 상태만 분류)
const INTERNAL_KEYWORDS = ['한태원', '한태종']  // 본인 이체
const NON_AR_KEYWORDS = ['tosspayment', '토스페이먼츠', '효성에프엠에스', '비자카드', 'JB029']

function classify(rawDesc: string, rawCp: string): 'INTERNAL' | 'NON_AR' | null {
  const all = `${rawDesc} ${rawCp}`.toLowerCase()
  if (INTERNAL_KEYWORDS.some(k => all.includes(k.toLowerCase()))) return 'INTERNAL'
  if (NON_AR_KEYWORDS.some(k => all.includes(k.toLowerCase()))) return 'NON_AR'
  return null
}

// 거래처 매칭: 상대계좌예금주명/거래내용 → Client
async function matchClient(rawDesc: string, rawCp: string): Promise<{ id: string; name: string } | null> {
  const keys = [rawCp, rawDesc].map(normName).filter(Boolean)
  for (const k of keys) {
    if (!k) continue
    // 1. 별칭 사전
    const alias = await prisma.clientAlias.findUnique({ where: { alias: k }, include: { client: true } })
    if (alias) return { id: alias.clientId, name: alias.client.name }
    // 2. 거래처 이름 정확/부분 일치
    const allClients = await prisma.client.findMany({ select: { id: true, name: true } })
    const exact = allClients.find(c => normName(c.name) === k)
    if (exact) return { id: exact.id, name: exact.name }
    // 부분 일치 (양방향, 길이 ≥ 3)
    if (k.length >= 3) {
      const partial = allClients.find(c => {
        const cn = normName(c.name)
        return cn.length >= 3 && (cn.includes(k) || k.includes(cn))
      })
      if (partial) return { id: partial.id, name: partial.name }
    }
  }
  return null
}

// 통장 입금 → ArPayment 매칭 (거래처 + 금액 + 날짜 ±3일)
async function matchPayment(clientId: string, amount: number, txDate: Date) {
  const dayStart = new Date(txDate); dayStart.setDate(dayStart.getDate() - 3); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(txDate); dayEnd.setDate(dayEnd.getDate() + 3); dayEnd.setHours(23, 59, 59, 999)
  const pay = await prisma.arPayment.findFirst({
    where: {
      amount,
      paymentDate: { gte: dayStart, lte: dayEnd },
      receivable: { clientId },
    },
  })
  return pay?.id ?? null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

    // 헤더 행 찾기 (포함: 거래일시, 출금, 입금)
    let dataStartRow = -1
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const cells = rows[i].map(c => String(c ?? ''))
      if (cells.includes('거래일시') && cells.includes('입금')) { dataStartRow = i + 1; break }
    }
    if (dataStartRow < 0) return NextResponse.json({ error: '통장 헤더(거래일시/입금)를 찾을 수 없습니다' }, { status: 400 })

    let created = 0, dup = 0, matchedClient = 0, matchedPay = 0, internal = 0, nonAr = 0
    let totalIn = 0, totalOut = 0

    for (let i = dataStartRow; i < rows.length; i++) {
      const r = rows[i]
      const txDateTime = parseDateTime(r[1])
      if (!txDateTime) continue
      const outAmt = parseNum(r[2])
      const inAmt = parseNum(r[3])
      if (outAmt === 0 && inAmt === 0) continue
      const type = inAmt > 0 ? 'IN' : 'OUT'
      const amount = inAmt > 0 ? inAmt : outAmt
      const rawDescription = String(r[5] ?? '').trim()
      const rawCounterparty = String(r[12] ?? '').trim()
      const bank = String(r[7] ?? '').trim() || null
      const txCategory = String(r[9] ?? '').trim() || null

      const dedupKey = `${txDateTime.toISOString()}__${type}__${amount}__${rawCounterparty || rawDescription}`
      const exists = await prisma.bankTransaction.findUnique({ where: { dedupKey } })
      if (exists) { dup++; continue }

      // 분류
      const forced = classify(rawDescription, rawCounterparty)
      let status: string = forced ?? 'UNMATCHED'
      let clientId: string | null = null
      let paymentId: string | null = null

      if (!forced && type === 'IN') {
        const c = await matchClient(rawDescription, rawCounterparty)
        if (c) {
          clientId = c.id
          matchedClient++
          paymentId = await matchPayment(c.id, amount, txDateTime)
          if (paymentId) { status = 'MATCHED'; matchedPay++ }
        }
      }
      if (forced === 'INTERNAL') internal++
      if (forced === 'NON_AR') nonAr++

      await prisma.bankTransaction.create({
        data: {
          txDateTime, type, amount,
          rawDescription, rawCounterparty, bank, txCategory,
          clientId, matchedPaymentId: paymentId,
          status, dedupKey,
        },
      })
      created++
      if (type === 'IN') totalIn += amount; else totalOut += amount
    }

    return NextResponse.json({
      success: true, type: 'bank',
      created, duplicate: dup,
      matchedClient, matchedPay, internal, nonAr,
      totalIn, totalOut,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Bank upload error:', msg)
    return NextResponse.json({ error: '처리 중 오류', detail: msg.slice(0, 300) }, { status: 500 })
  }
}
