import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { findOrCreateClient, ensureClientAr } from '@/lib/client-matcher'

// 일계표 → DB 양방향 동기화
// 핵심 원칙:
//  1. 시트가 있는 날짜만 sync (시트 없는 날짜는 건드리지 않음)
//  2. 일계표 출처 데이터만 sync (수동 입력/이월 보정/선수금 placeholder 보호)
//  3. 매출 + 입금만 완전 sync (경비/매입은 추가만 — 사용자가 별도 등록 가능)
//  4. mode='preview': 변경사항 계산만, DB 변경 없음
//  5. mode='apply': 실제 적용

export const runtime = 'nodejs'

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
function parseNum(val: unknown): number { return Math.abs(parseSigned(val)) }

interface TxRow {
  no: number; account: string; client: string
  productName: string; spec: string; memo: string
  qty: number; unitPrice: number; amount: number; vat: number
  voucherNo: string
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

// 일계표 → 일자별 expected 거래 추출
interface SheetExpected {
  date: Date
  dateStr: string
  sales: { client: string; totalAmount: number; items: TxRow[] }[]
  deposits: { client: string; amount: number }[]
  expenses: { description: string; amount: number; vat: number }[]
  purchases: { client: string; totalAmount: number; items: TxRow[] }[]
}

function parseLedger(buffer: Buffer): { sheets: SheetExpected[]; dateRange: { from: Date; to: Date } | null } {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheets: SheetExpected[] = []
  let minDate: Date | null = null, maxDate: Date | null = null

  for (const sheetName of wb.SheetNames) {
    const txDate = parseSheetDate(sheetName)
    if (!txDate) continue
    if (!minDate || txDate < minDate) minDate = txDate
    if (!maxDate || txDate > maxDate) maxDate = txDate

    const dateStr = `${txDate.getFullYear()}-${String(txDate.getMonth()+1).padStart(2,'0')}-${String(txDate.getDate()).padStart(2,'0')}`
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
    const txRows = extractTxRows(rows)

    // 외출 (SALE) — voucherNo+client 그룹핑
    const saleMap = new Map<string, TxRow[]>()
    txRows.filter(r => r.account === '외출').forEach(r => {
      const key = `${r.voucherNo}__${r.client}`
      if (!saleMap.has(key)) saleMap.set(key, [])
      saleMap.get(key)!.push(r)
    })
    const sales: SheetExpected['sales'] = []
    for (const items of saleMap.values()) {
      if (!items[0].client) continue
      const subtotal = items.reduce((s, i) => s + i.amount, 0)
      const tax = items.reduce((s, i) => s + i.vat, 0)
      const total = subtotal + tax
      if (total === 0) continue
      sales.push({ client: items[0].client, totalAmount: total, items })
    }

    // 입금
    const deposits = txRows
      .filter(r => r.account === '입금' && r.client && Math.abs(r.amount) > 0)
      .map(r => ({ client: r.client, amount: Math.abs(r.amount) }))

    // 현비 (EXPENSE)
    const expenses = txRows
      .filter(r => r.account === '현비' && parseNum(r.amount) > 0)
      .map(r => ({
        description: r.productName || r.memo || '경비',
        amount: parseNum(r.amount),
        vat: r.vat,
      }))

    // 외입 (PURCHASE) — voucherNo+client 그룹핑
    const purMap = new Map<string, TxRow[]>()
    txRows.filter(r => r.account === '외입').forEach(r => {
      const key = `${r.voucherNo}__${r.client}`
      if (!purMap.has(key)) purMap.set(key, [])
      purMap.get(key)!.push(r)
    })
    const purchases: SheetExpected['purchases'] = []
    for (const items of purMap.values()) {
      if (!items[0].client) continue
      const total = items.reduce((s, i) => s + parseNum(i.amount), 0)
      if (total === 0) continue
      purchases.push({ client: items[0].client, totalAmount: total, items })
    }

    sheets.push({ date: txDate, dateStr, sales, deposits, expenses, purchases })
  }

  return {
    sheets,
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
  }
}

// 일자별 DB 일계표 출처 데이터 조회
async function fetchDayActual(dateStr: string) {
  const dayStart = new Date(dateStr + 'T00:00:00')
  const dayEnd = new Date(dateStr + 'T23:59:59')

  const [sales, payments, expenses, purchases] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: 'SALE', date: { gte: dayStart, lte: dayEnd }, description: { startsWith: '일계표 매출' } },
      include: { client: { select: { name: true } }, accountsReceivable: { include: { payments: true } } },
    }),
    prisma.arPayment.findMany({
      where: { paymentDate: { gte: dayStart, lte: dayEnd }, notes: { startsWith: '[일계표]' } },
      include: { receivable: { include: { client: { select: { id: true, name: true } } } } },
    }),
    prisma.transaction.findMany({
      where: { type: 'EXPENSE', date: { gte: dayStart, lte: dayEnd } },
    }),
    prisma.transaction.findMany({
      where: { type: 'PURCHASE', date: { gte: dayStart, lte: dayEnd }, description: { startsWith: '매입' } },
      include: { client: { select: { name: true } } },
    }),
  ])

  return { sales, payments, expenses, purchases }
}

interface DiffResult {
  date: string
  toAdd: {
    sales: { client: string; totalAmount: number; items: TxRow[] }[]
    deposits: { client: string; amount: number }[]
    expenses: { description: string; amount: number; vat: number }[]
    purchases: { client: string; totalAmount: number; items: TxRow[] }[]
  }
  toDelete: {
    sales: { id: string; client: string; totalAmount: number }[]
    deposits: { id: string; client: string; amount: number }[]
  }
  toKeep: {
    sales: number
    deposits: number
    expenses: number
    purchases: number
  }
}

// 시트별 diff 계산 (count 기준)
async function computeDiff(sheet: SheetExpected): Promise<DiffResult> {
  const actual = await fetchDayActual(sheet.dateStr)

  // === 매출 diff ===
  const expSales = new Map<string, { item: SheetExpected['sales'][number]; count: number }[]>()
  for (const s of sheet.sales) {
    const key = `${s.client}|${s.totalAmount}`
    if (!expSales.has(key)) expSales.set(key, [])
    expSales.get(key)!.push({ item: s, count: 1 })
  }
  const actSales = new Map<string, typeof actual.sales>()
  for (const tx of actual.sales) {
    const key = `${tx.client?.name ?? ''}|${tx.totalAmount}`
    if (!actSales.has(key)) actSales.set(key, [])
    actSales.get(key)!.push(tx)
  }

  const salesToAdd: SheetExpected['sales'] = []
  const salesToDelete: { id: string; client: string; totalAmount: number }[] = []
  let salesToKeep = 0

  // expected 기준 — 부족하면 추가
  for (const [key, expList] of expSales) {
    const actList = actSales.get(key) ?? []
    const matched = Math.min(expList.length, actList.length)
    salesToKeep += matched
    for (let i = matched; i < expList.length; i++) salesToAdd.push(expList[i].item)
  }
  // actual 기준 — 일계표보다 많으면 삭제
  for (const [key, actList] of actSales) {
    const expList = expSales.get(key) ?? []
    for (let i = expList.length; i < actList.length; i++) {
      const tx = actList[i]
      salesToDelete.push({ id: tx.id, client: tx.client?.name ?? '', totalAmount: tx.totalAmount })
    }
  }

  // === 입금 diff ===
  const expDep = new Map<string, number>()
  for (const d of sheet.deposits) {
    const key = `${d.client}|${d.amount}`
    expDep.set(key, (expDep.get(key) ?? 0) + 1)
  }
  const actDep = new Map<string, typeof actual.payments>()
  for (const p of actual.payments) {
    const key = `${p.receivable.client.name}|${p.amount}`
    if (!actDep.has(key)) actDep.set(key, [])
    actDep.get(key)!.push(p)
  }

  const depToAdd: SheetExpected['deposits'] = []
  const depToDelete: { id: string; client: string; amount: number }[] = []
  let depToKeep = 0
  for (const d of sheet.deposits) {
    const key = `${d.client}|${d.amount}`
    const actList = actDep.get(key) ?? []
    if (actList.length > 0) {
      actList.shift()  // consume one
      depToKeep++
    } else {
      depToAdd.push(d)
    }
  }
  for (const [, leftover] of actDep) {
    for (const p of leftover) {
      depToDelete.push({ id: p.id, client: p.receivable.client.name, amount: p.amount })
    }
  }

  // === 경비 diff (추가만) ===
  const expExp = new Map<string, number>()
  for (const e of sheet.expenses) {
    const key = `${e.description}|${e.amount}|${e.vat}`
    expExp.set(key, (expExp.get(key) ?? 0) + 1)
  }
  const actExp = new Map<string, number>()
  for (const tx of actual.expenses) {
    const key = `${tx.description ?? ''}|${tx.totalAmount}|${tx.taxAmount}`
    actExp.set(key, (actExp.get(key) ?? 0) + 1)
  }
  const expensesToAdd: SheetExpected['expenses'] = []
  let expensesToKeep = 0
  for (const e of sheet.expenses) {
    const key = `${e.description}|${e.amount}|${e.vat}`
    const actCount = actExp.get(key) ?? 0
    if (actCount > 0) {
      actExp.set(key, actCount - 1)
      expensesToKeep++
    } else {
      expensesToAdd.push(e)
    }
  }

  // === 매입 diff (추가만) ===
  const actPur = new Map<string, number>()
  for (const tx of actual.purchases) {
    const key = `${tx.client?.name ?? ''}|${tx.totalAmount}`
    actPur.set(key, (actPur.get(key) ?? 0) + 1)
  }
  const purchasesToAdd: SheetExpected['purchases'] = []
  let purchasesToKeep = 0
  for (const p of sheet.purchases) {
    const key = `${p.client}|${p.totalAmount}`
    const actCount = actPur.get(key) ?? 0
    if (actCount > 0) {
      actPur.set(key, actCount - 1)
      purchasesToKeep++
    } else {
      purchasesToAdd.push(p)
    }
  }

  return {
    date: sheet.dateStr,
    toAdd: {
      sales: salesToAdd,
      deposits: depToAdd,
      expenses: expensesToAdd,
      purchases: purchasesToAdd,
    },
    toDelete: {
      sales: salesToDelete,
      deposits: depToDelete,
    },
    toKeep: {
      sales: salesToKeep,
      deposits: depToKeep,
      expenses: expensesToKeep,
      purchases: purchasesToKeep,
    },
  }
}

// 실제 적용
async function applyDiff(diffs: DiffResult[]): Promise<{ added: number; deleted: number; errors: string[] }> {
  let added = 0
  let deleted = 0
  const errors: string[] = []
  const touchedClients = new Set<string>()

  for (const diff of diffs) {
    const txDate = new Date(diff.date + 'T12:00:00')
    const dayStart = new Date(diff.date + 'T00:00:00')
    const dayEnd = new Date(diff.date + 'T23:59:59')

    // ===== 삭제: 매출 (cascade: AR → payments) =====
    for (const s of diff.toDelete.sales) {
      try {
        const tx = await prisma.transaction.findUnique({
          where: { id: s.id },
          include: { accountsReceivable: { select: { id: true } } },
        })
        if (!tx) continue
        // AR 먼저 삭제 (payments cascade)
        for (const ar of tx.accountsReceivable) {
          await prisma.accountsReceivable.delete({ where: { id: ar.id } })
        }
        await prisma.transaction.delete({ where: { id: s.id } })
        if (tx.clientId) touchedClients.add(tx.clientId)
        deleted++
      } catch (e) {
        errors.push(`매출 삭제 실패: ${s.client} ₩${s.totalAmount} — ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ===== 삭제: 입금 =====
    for (const d of diff.toDelete.deposits) {
      try {
        const pay = await prisma.arPayment.findUnique({
          where: { id: d.id },
          include: { receivable: { select: { clientId: true } } },
        })
        if (!pay) continue
        await prisma.arPayment.delete({ where: { id: d.id } })
        touchedClients.add(pay.receivable.clientId)
        deleted++
      } catch (e) {
        errors.push(`입금 삭제 실패: ${d.client} ₩${d.amount} — ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ===== 추가: 매출 =====
    for (const s of diff.toAdd.sales) {
      try {
        const { client } = await findOrCreateClient(s.client, { autoCreate: true, clientType: 'CUSTOMER' })
        if (!client) continue
        const tax = s.items.reduce((acc, i) => acc + i.vat, 0)
        const saleTx = await prisma.transaction.create({
          data: {
            date: txDate,
            type: 'SALE',
            clientId: client.id,
            description: `일계표 매출 - ${s.client}`,
            totalAmount: s.totalAmount,
            taxAmount: tax,
            paymentMethod: 'CREDIT',
            paymentStatus: 'UNPAID',
            channel: 'B2B',
            items: {
              create: s.items.map(i => ({
                productName: i.productName + (i.spec ? ` [${i.spec}]` : ''),
                quantity: i.qty,
                unitPrice: i.unitPrice,
                amount: i.amount,
                notes: i.memo || null,
              })),
            },
          },
        })
        if (s.totalAmount !== 0) {
          await prisma.accountsReceivable.create({
            data: {
              clientId: client.id,
              transactionId: saleTx.id,
              originalAmount: s.totalAmount,
              remainingAmount: s.totalAmount,
              status: s.totalAmount > 0 ? 'OUTSTANDING' : 'PAID',
            },
          })
        }
        touchedClients.add(client.id)
        added++
      } catch (e) {
        errors.push(`매출 추가 실패: ${s.client} ₩${s.totalAmount} — ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ===== 추가: 입금 =====
    for (const d of diff.toAdd.deposits) {
      try {
        const { client } = await findOrCreateClient(d.client, { autoCreate: true, clientType: 'CUSTOMER' })
        if (!client) continue
        const ar = await ensureClientAr(client.id)
        // 중복 체크
        const existed = await prisma.arPayment.findFirst({
          where: {
            paymentDate: { gte: dayStart, lte: dayEnd },
            amount: d.amount,
            receivable: { clientId: client.id },
            notes: { startsWith: '[일계표]' },
          },
        })
        if (existed) continue
        await prisma.arPayment.create({
          data: {
            receivableId: ar.id,
            amount: d.amount,
            paymentDate: txDate,
            paymentMethod: '입금',
            notes: `[일계표] ${diff.date} | ${d.client}`,
          },
        })
        touchedClients.add(client.id)
        added++
      } catch (e) {
        errors.push(`입금 추가 실패: ${d.client} ₩${d.amount} — ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ===== 추가: 경비 (sync 안 함, 추가만) =====
    for (const e of diff.toAdd.expenses) {
      try {
        await prisma.transaction.create({
          data: {
            date: txDate,
            type: 'EXPENSE',
            description: e.description,
            totalAmount: e.amount,
            taxAmount: e.vat,
            paymentMethod: 'CASH',
            paymentStatus: 'PAID',
            channel: 'B2B',
          },
        })
        added++
      } catch (err) {
        errors.push(`경비 추가 실패: ${e.description} — ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // ===== 추가: 매입 (sync 안 함, 추가만) =====
    for (const p of diff.toAdd.purchases) {
      try {
        const { client } = await findOrCreateClient(p.client, { autoCreate: true, clientType: 'SUPPLIER' })
        if (!client) continue
        await prisma.transaction.create({
          data: {
            date: txDate,
            type: 'PURCHASE',
            clientId: client.id,
            description: `매입 - ${p.client}`,
            totalAmount: p.totalAmount,
            taxAmount: p.items.reduce((s, i) => s + i.vat, 0),
            paymentMethod: 'CREDIT',
            paymentStatus: 'UNPAID',
            channel: 'B2B',
            items: {
              create: p.items.map(i => ({
                productName: i.productName + (i.spec ? ` [${i.spec}]` : ''),
                quantity: i.qty,
                unitPrice: i.unitPrice,
                amount: Math.abs(i.amount),
              })),
            },
          },
        })
        added++
      } catch (err) {
        errors.push(`매입 추가 실패: ${p.client} — ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  // 잔액 재계산
  for (const cid of touchedClients) {
    const ars = await prisma.accountsReceivable.findMany({
      where: { clientId: cid },
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

  return { added, deleted, errors }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const mode = String(formData.get('mode') ?? 'preview')

    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // 일계표 형식 확인
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const firstSheet = wb.Sheets[wb.SheetNames[0]]
    const firstRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as unknown[][]
    const titleText = String(firstRows[0]?.[0] ?? '')
    if (!titleText.includes('일계표')) {
      return NextResponse.json({ error: '일계표(리스트) 파일 형식이 아닙니다.' }, { status: 400 })
    }

    const { sheets, dateRange } = parseLedger(buffer)
    if (sheets.length === 0) return NextResponse.json({ error: '유효한 시트가 없습니다' }, { status: 400 })

    // 각 시트별 diff 계산
    const diffs: DiffResult[] = []
    for (const sheet of sheets) {
      diffs.push(await computeDiff(sheet))
    }

    // 요약
    const summary = {
      dateRange: dateRange ? {
        from: dateRange.from.toISOString().slice(0, 10),
        to: dateRange.to.toISOString().slice(0, 10),
      } : null,
      sheetCount: sheets.length,
      sales: {
        add: diffs.reduce((s, d) => s + d.toAdd.sales.length, 0),
        delete: diffs.reduce((s, d) => s + d.toDelete.sales.length, 0),
        keep: diffs.reduce((s, d) => s + d.toKeep.sales, 0),
        addAmount: diffs.reduce((s, d) => s + d.toAdd.sales.reduce((a, x) => a + x.totalAmount, 0), 0),
        deleteAmount: diffs.reduce((s, d) => s + d.toDelete.sales.reduce((a, x) => a + x.totalAmount, 0), 0),
      },
      deposits: {
        add: diffs.reduce((s, d) => s + d.toAdd.deposits.length, 0),
        delete: diffs.reduce((s, d) => s + d.toDelete.deposits.length, 0),
        keep: diffs.reduce((s, d) => s + d.toKeep.deposits, 0),
        addAmount: diffs.reduce((s, d) => s + d.toAdd.deposits.reduce((a, x) => a + x.amount, 0), 0),
        deleteAmount: diffs.reduce((s, d) => s + d.toDelete.deposits.reduce((a, x) => a + x.amount, 0), 0),
      },
      expenses: {
        add: diffs.reduce((s, d) => s + d.toAdd.expenses.length, 0),
        keep: diffs.reduce((s, d) => s + d.toKeep.expenses, 0),
      },
      purchases: {
        add: diffs.reduce((s, d) => s + d.toAdd.purchases.length, 0),
        keep: diffs.reduce((s, d) => s + d.toKeep.purchases, 0),
      },
    }

    if (mode === 'preview') {
      // 상세 항목 일부만 (300건 제한)
      const collectAdd = <T extends { client?: string; description?: string }>(arr: { date: string; items: T[] }[]) =>
        arr.flatMap(d => d.items.map(x => ({ ...x, date: d.date })))

      const detail = {
        salesAdd: diffs.flatMap(d => d.toAdd.sales.map(x => ({ date: d.date, client: x.client, amount: x.totalAmount }))).slice(0, 300),
        salesDelete: diffs.flatMap(d => d.toDelete.sales.map(x => ({ date: d.date, client: x.client, amount: x.totalAmount }))).slice(0, 300),
        depositsAdd: diffs.flatMap(d => d.toAdd.deposits.map(x => ({ date: d.date, client: x.client, amount: x.amount }))).slice(0, 300),
        depositsDelete: diffs.flatMap(d => d.toDelete.deposits.map(x => ({ date: d.date, client: x.client, amount: x.amount }))).slice(0, 300),
        expensesAdd: diffs.flatMap(d => d.toAdd.expenses.map(x => ({ date: d.date, description: x.description, amount: x.amount }))).slice(0, 300),
        purchasesAdd: diffs.flatMap(d => d.toAdd.purchases.map(x => ({ date: d.date, client: x.client, amount: x.totalAmount }))).slice(0, 300),
      }
      return NextResponse.json({ summary, detail, mode: 'preview' })
    }

    // apply
    const result = await applyDiff(diffs)
    return NextResponse.json({ summary, result, mode: 'apply' })
  } catch (error) {
    console.error('[sales/sync]', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 })
  }
}
