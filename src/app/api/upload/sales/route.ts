import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { getFabricPrices, findFabricCost, getUSDtoKRW } from '@/lib/googleSheets'

// 일계표(리스트) 형식 업로드
// 계정: 외출=매출, 현비=경비, 외입=매입, 입금/출금=스킵

const SKIP_COST_ITEMS = ['할인', '화물', '택배', '방염', '배송', '운송', '해외운송']

function parseSheetDate(sheetName: string): Date | null {
  const m = sheetName.match(/^(\d{2})\.(\d{2})\.(\d{2})$/)
  if (!m) return null
  const [, yy, mm, dd] = m
  return new Date(2000 + parseInt(yy), parseInt(mm) - 1, parseInt(dd), 12, 0, 0)
}

function parseSigned(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

function parseNum(val: unknown): number {
  const n = parseSigned(val)
  return Math.abs(n)
}

interface TxRow {
  no: number; account: string; client: string
  productName: string; spec: string; memo: string
  qty: number; unitPrice: number; amount: number; vat: number
  voucherNo: string
}

// 거래처 단위 AR 잔액 재계산
// 각 AR의 remainingAmount = max(0, originalAmount - 자기 AR의 payments 합)
// 단순 1:1 매칭이라 overpaid 잔여는 거래처 단위 합산 시 자동 반영됨
async function recalcClientArBalances(clientId: string) {
  const ars = await prisma.accountsReceivable.findMany({
    where: { clientId },
    include: { payments: { select: { amount: true } } },
  })
  for (const ar of ars) {
    const paid = ar.payments.reduce((s, p) => s + p.amount, 0)
    const rem = Math.max(0, ar.originalAmount - paid)
    const status = rem === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OUTSTANDING'
    if (rem !== ar.remainingAmount || status !== ar.status) {
      await prisma.accountsReceivable.update({
        where: { id: ar.id },
        data: { remainingAmount: rem, status },
      })
    }
  }
}

// 입금 처리: 일계표 입금 행 1건 = ArPayment 1건 (실제 입금액 그대로 기록)
// - 거래처명은 일계표 그대로 (exact 매칭, 정규화 안 함)
// - AR이 없으면 skip (선수금 처리 안 함)
// - 중복 방지: 같은 (clientId, 날짜) 에 '[일계표]' 마커 결제 이미 있으면 그 날짜 입금 skip
async function processDeposits(txRows: TxRow[], txDate: Date, dateStr: string): Promise<{ count: number; total: number }> {
  const deposits = txRows.filter(r => r.account === '입금')
  let count = 0
  let total = 0

  for (const r of deposits) {
    const amount = Math.abs(r.amount)
    if (!r.client || amount === 0) continue

    // 거래처 (exact match)
    const client = await prisma.client.findFirst({ where: { name: r.client } })
    if (!client) continue

    // 같은 날짜에 일계표 입금이 이미 적용됐는지 확인
    const dayStart = new Date(txDate); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(txDate); dayEnd.setHours(23, 59, 59, 999)
    const existed = await prisma.arPayment.findFirst({
      where: {
        paymentDate: { gte: dayStart, lte: dayEnd },
        notes: { startsWith: `[일계표] ${dateStr} | ${r.client}` },
      },
    })
    if (existed) continue // 이미 처리됨

    // 입금 전액을 거래처의 가장 오래된 AR에 한 건 기록 (실제 입금액 보존)
    // AR이 없으면 skip (선수금 처리 안 함)
    const targetAr = await prisma.accountsReceivable.findFirst({
      where: { clientId: client.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!targetAr) continue

    await prisma.arPayment.create({
      data: {
        receivableId: targetAr.id,
        amount,
        paymentDate: txDate,
        paymentMethod: '입금',
        notes: `[일계표] ${dateStr} | ${r.client}`,
      },
    })

    // 거래처 단위 잔액 재계산 (모든 AR의 original - 모든 payment 합)
    await recalcClientArBalances(client.id)

    count++
    total += amount
  }

  return { count, total }
}

function extractTxRows(rows: unknown[][]): TxRow[] {
  const result: TxRow[] = []
  for (const r of rows) {
    const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
    if (!Number.isFinite(no) || no <= 0) continue
    result.push({
      no,
      account: String(r[1] ?? '').trim(),
      client: String(r[2] ?? '').trim(),
      productName: String(r[3] ?? '').trim(),
      spec: String(r[4] ?? '').trim(),
      memo: String(r[5] ?? '').trim(),
      qty: parseSigned(r[6]),
      unitPrice: parseNum(r[7]),
      amount: parseSigned(r[8]),
      vat: parseNum(r[9]),
      voucherNo: String(r[11] ?? '').trim(),
    })
  }
  return result
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // 일계표 형식 확인 (첫 시트 첫 행에 "일계표" 포함)
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const firstRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as unknown[][]
    const titleText = String(firstRows[0]?.[0] ?? '')
    if (!titleText.includes('일계표')) {
      return NextResponse.json({ error: '일계표(리스트) 파일 형식이 아닙니다.' }, { status: 400 })
    }

    // Google Sheets 원단 단가표 + 환율
    let fabricPrices: Awaited<ReturnType<typeof getFabricPrices>> = []
    let usdRate = 1380
    let sheetsError = ''
    try {
      ;[fabricPrices, usdRate] = await Promise.all([getFabricPrices(), getUSDtoKRW()])
    } catch (e) {
      sheetsError = e instanceof Error ? e.message : '단가표 로드 실패'
    }

    const results: {
      date: string; skipped: boolean; skipReason?: string
      salesCount: number; totalSales: number
      expenseCount: number; totalExpenses: number
      purchaseCount: number; totalPurchases: number
      depositCount: number; totalDeposits: number
      salesSkipped?: number; expenseSkipped?: number; purchaseSkipped?: number
    }[] = []
    const unmatchedProducts: string[] = []

    for (const sheetName of workbook.SheetNames) {
      const txDate = parseSheetDate(sheetName)
      if (!txDate) continue

      const dateStr = txDate.toISOString().split('T')[0]
      const dayStart = new Date(txDate); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(txDate); dayEnd.setHours(23, 59, 59, 999)

      const ws = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
      const txRows = extractTxRows(rows)

      // dedup 단위: 하루 전체 → 그룹별로 변경 (SALE/EXPENSE/PURCHASE 각각)
      // 같은 (날짜+거래처+금액) 조합이 이미 있으면 그 그룹만 skip, 다른 새 매출은 정상 추가됨
      let salesCount = 0, totalSales = 0
      let expenseCount = 0, totalExpenses = 0
      let purchaseCount = 0, totalPurchases = 0
      let depositCount = 0, totalDeposits = 0
      let salesSkipped = 0, expenseSkipped = 0, purchaseSkipped = 0

      // ── 외출 (SALE): 전표No 기준 그룹핑 ──────────────────
      const saleGroups = new Map<string, TxRow[]>()
      txRows.filter(r => r.account === '외출').forEach(r => {
        const key = `${r.voucherNo}__${r.client}`
        if (!saleGroups.has(key)) saleGroups.set(key, [])
        saleGroups.get(key)!.push(r)
      })

      for (const [, items] of saleGroups) {
        const clientName = items[0].client
        if (!clientName) continue
        const subtotal = items.reduce((s, i) => s + i.amount, 0)
        const taxAmount = items.reduce((s, i) => s + i.vat, 0)
        const totalAmount = subtotal + taxAmount  // 부가세 포함 총액
        if (totalAmount === 0) continue

        let client = await prisma.client.findFirst({ where: { name: clientName } })
        if (!client) client = await prisma.client.create({ data: { name: clientName, type: 'CUSTOMER' } })

        // 그룹별 dedup — 같은 (날짜+거래처+금액) 매출이 이미 있으면 그 그룹만 skip
        const existingGroup = await prisma.transaction.findFirst({
          where: {
            date: { gte: dayStart, lte: dayEnd },
            type: 'SALE',
            clientId: client.id,
            totalAmount,
            description: { startsWith: '일계표 매출' },
          },
        })
        if (existingGroup) { salesSkipped++; continue }

        const saleTx = await prisma.transaction.create({
          data: {
            date: txDate,
            type: 'SALE',
            clientId: client.id,
            description: `일계표 매출 - ${clientName}`,
            totalAmount,
            taxAmount,
            paymentMethod: 'CREDIT',
            paymentStatus: 'UNPAID',
            channel: 'B2B',
            items: {
              create: items.map(i => ({
                productName: i.productName + (i.spec ? ` [${i.spec}]` : ''),
                quantity: i.qty,
                unitPrice: i.unitPrice,
                amount: i.amount,
                notes: i.memo || null,
              }))
            }
          }
        })

        // 음수 매출(단수정리/환불 등)도 AR 생성 — 미수금 잔액에 정확히 반영
        if (totalAmount !== 0) {
          await prisma.accountsReceivable.create({
            data: {
              clientId: client.id,
              transactionId: saleTx.id,
              originalAmount: totalAmount,
              remainingAmount: totalAmount,
              status: totalAmount > 0 ? 'OUTSTANDING' : 'PAID',  // 음수면 PAID 처리 (회수 대상 아님)
            }
          })
        }

        salesCount++
        totalSales += totalAmount

        // 원단 원가 자동 계산
        if (fabricPrices.length > 0) {
          // 반품(음수 수량)도 포함해 원가 차감 처리
          const candidateItems = items.filter(i => !SKIP_COST_ITEMS.some(s => i.productName.includes(s)) && i.qty !== 0)
          const costItems = candidateItems.map(i => {
            const fullName = i.productName + (i.spec ? ` [${i.spec}]` : '')
            const dealerPriceUSD = findFabricCost(fullName, fabricPrices)
            const dealerPriceKRW = Math.round(dealerPriceUSD * usdRate)
            return { ...i, fullName, dealerPriceUSD, dealerPriceKRW, costAmount: Math.round(dealerPriceKRW * i.qty) }
          })

          const matched = costItems.filter(i => i.dealerPriceUSD > 0)
          const unmatched = costItems.filter(i => i.dealerPriceUSD === 0).map(i => i.fullName)
          if (unmatched.length > 0) unmatchedProducts.push(...unmatched)

          if (matched.length > 0) {
            const totalCost = matched.reduce((s, i) => s + i.costAmount, 0)
            await prisma.transaction.create({
              data: {
                date: txDate,
                type: 'PURCHASE',
                clientId: client.id,
                description: `원단 매입원가 - ${clientName}`,
                totalAmount: totalCost,
                taxAmount: 0,
                paymentMethod: 'TRANSFER',
                paymentStatus: 'PAID',
                channel: 'B2B',
                notes: `일계표 원가 자동 계산 (환율: ${usdRate}원/USD)`,
                items: {
                  create: matched.map(i => ({
                    productName: i.fullName,
                    quantity: i.qty,
                    unitPrice: i.dealerPriceKRW,
                    amount: i.costAmount,
                    notes: `USD단가: $${i.dealerPriceUSD} | 환율: ${usdRate}`,
                  }))
                }
              }
            })
          }
        }
      }

      // ── 현비 (EXPENSE): 행별 처리 ──────────────────────────
      const expenseRows = txRows.filter(r => r.account === '현비')
      for (const r of expenseRows) {
        const amount = parseNum(r.amount)
        if (amount === 0) continue
        const desc = r.productName || r.memo || '경비'

        // 행별 dedup — 같은 (날짜+description+amount+taxAmount) 이미 있으면 skip
        const existingExp = await prisma.transaction.findFirst({
          where: {
            date: { gte: dayStart, lte: dayEnd },
            type: 'EXPENSE',
            description: desc,
            totalAmount: amount,
            taxAmount: r.vat,
          },
        })
        if (existingExp) { expenseSkipped++; continue }

        await prisma.transaction.create({
          data: {
            date: txDate,
            type: 'EXPENSE',
            description: desc,
            totalAmount: amount,
            taxAmount: r.vat,
            paymentMethod: 'CASH',
            paymentStatus: 'PAID',
            channel: 'B2B',
          }
        })
        expenseCount++
        totalExpenses += amount
      }

      // ── 외입 (PURCHASE): 전표No 기준 그룹핑 ──────────────
      const purchaseGroups = new Map<string, TxRow[]>()
      txRows.filter(r => r.account === '외입').forEach(r => {
        const key = `${r.voucherNo}__${r.client}`
        if (!purchaseGroups.has(key)) purchaseGroups.set(key, [])
        purchaseGroups.get(key)!.push(r)
      })

      for (const [, items] of purchaseGroups) {
        const clientName = items[0].client
        const totalAmount = items.reduce((s, i) => s + parseNum(i.amount), 0)
        if (totalAmount === 0) continue

        let client = await prisma.client.findFirst({ where: { name: clientName } })
        if (!client) client = await prisma.client.create({ data: { name: clientName, type: 'SUPPLIER' } })

        // 그룹별 dedup
        const existingPur = await prisma.transaction.findFirst({
          where: {
            date: { gte: dayStart, lte: dayEnd },
            type: 'PURCHASE',
            clientId: client.id,
            totalAmount,
            description: { startsWith: '매입' },
          },
        })
        if (existingPur) { purchaseSkipped++; continue }

        await prisma.transaction.create({
          data: {
            date: txDate,
            type: 'PURCHASE',
            clientId: client.id,
            description: `매입 - ${clientName}`,
            totalAmount,
            taxAmount: items.reduce((s, i) => s + i.vat, 0),
            paymentMethod: 'CREDIT',
            paymentStatus: 'UNPAID',
            channel: 'B2B',
            items: {
              create: items.map(i => ({
                productName: i.productName + (i.spec ? ` [${i.spec}]` : ''),
                quantity: i.qty,
                unitPrice: i.unitPrice,
                amount: parseNum(i.amount),
              }))
            }
          }
        })
        purchaseCount++
        totalPurchases += totalAmount
      }

      // 입금 처리 — 거래처별 미수금에 FIFO 적용
      const dep = await processDeposits(txRows, txDate, dateStr)
      depositCount = dep.count; totalDeposits = dep.total

      // 출금은 사용하지 않음 (사용자 요청)

      results.push({
        date: dateStr, skipped: false,
        salesCount, totalSales, expenseCount, totalExpenses, purchaseCount, totalPurchases,
        depositCount, totalDeposits,
        salesSkipped, expenseSkipped, purchaseSkipped,
      })
    }

    const processed = results.filter(r => !r.skipped)
    return NextResponse.json({
      success: true,
      sheetsTotal: workbook.SheetNames.length,
      processedDays: processed.length,
      skippedDays: results.filter(r => r.skipped).length,
      totalSales: processed.reduce((s, r) => s + r.totalSales, 0),
      totalExpenses: processed.reduce((s, r) => s + r.totalExpenses, 0),
      totalPurchases: processed.reduce((s, r) => s + r.totalPurchases, 0),
      depositCount: results.reduce((s, r) => s + r.depositCount, 0),
      totalDeposits: results.reduce((s, r) => s + r.totalDeposits, 0),
      sheetsError: sheetsError || undefined,
      details: results,
      unmatchedProducts: [...new Set(unmatchedProducts)],
    })
  } catch (error) {
    console.error('Sales upload error:', error)
    return NextResponse.json({ error: '파일 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
