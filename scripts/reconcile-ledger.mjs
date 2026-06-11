// 일계표 파일 vs DB 검수 — 일계표가 진실 소스
// 일계표에 있는데 DB에 없는 것 (= 추가 필요) + DB에 있는데 일계표에 없는 것 (= stale, 삭제 후보)
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const prisma = new PrismaClient()

const FILE = 'D:/일계표(리스트)_260611_093450.xls'

// ========= 일계표 파싱 (sales/route.ts 와 동일 로직) =========
function parseSheetDate(sheetName) {
  const m = sheetName.match(/^(\d{2})\.(\d{2})\.(\d{2})$/)
  if (!m) return null
  const [, yy, mm, dd] = m
  return new Date(2000 + parseInt(yy), parseInt(mm) - 1, parseInt(dd), 12, 0, 0)
}
function parseSigned(val) {
  if (val === null || val === undefined || val === '') return 0
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}
function parseNum(val) { return Math.abs(parseSigned(val)) }

function extractTxRows(rows) {
  const result = []
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

// ========= 시작 =========
const wb = XLSX.read(readFileSync(FILE), { type: 'buffer' })
console.log(`일계표 시트 ${wb.SheetNames.length}개\n`)

// 일계표에서 기대되는 (날짜별) 거래 모음
const expected = {
  sales: new Map(),    // key: `${date}|${client}|${totalAmount}` → count
  deposits: new Map(), // key: `${date}|${client}|${amount}` → count
  expenses: new Map(), // key: `${date}|${desc}|${amount}|${vat}` → count
  purchases: new Map(), // key: `${date}|${client}|${totalAmount}` → count
}

function bump(map, key) { map.set(key, (map.get(key) ?? 0) + 1) }

let minDate = null, maxDate = null
for (const sheetName of wb.SheetNames) {
  const txDate = parseSheetDate(sheetName)
  if (!txDate) continue
  if (!minDate || txDate < minDate) minDate = txDate
  if (!maxDate || txDate > maxDate) maxDate = txDate

  const dateStr = `${txDate.getFullYear()}-${String(txDate.getMonth()+1).padStart(2,'0')}-${String(txDate.getDate()).padStart(2,'0')}`
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const txRows = extractTxRows(rows)

  // 외출 (SALE) — voucherNo+client 그룹핑
  const saleGroups = new Map()
  txRows.filter(r => r.account === '외출').forEach(r => {
    const key = `${r.voucherNo}__${r.client}`
    if (!saleGroups.has(key)) saleGroups.set(key, [])
    saleGroups.get(key).push(r)
  })
  for (const items of saleGroups.values()) {
    if (!items[0].client) continue
    const subtotal = items.reduce((s, i) => s + i.amount, 0)
    const tax = items.reduce((s, i) => s + i.vat, 0)
    const total = subtotal + tax
    if (total === 0) continue
    bump(expected.sales, `${dateStr}|${items[0].client}|${total}`)
  }

  // 입금
  txRows.filter(r => r.account === '입금').forEach(r => {
    const amount = Math.abs(r.amount)
    if (!r.client || amount === 0) return
    bump(expected.deposits, `${dateStr}|${r.client}|${amount}`)
  })

  // 현비 (EXPENSE)
  txRows.filter(r => r.account === '현비').forEach(r => {
    const amount = parseNum(r.amount)
    if (amount === 0) return
    const desc = r.productName || r.memo || '경비'
    bump(expected.expenses, `${dateStr}|${desc}|${amount}|${r.vat}`)
  })

  // 외입 (PURCHASE) — voucherNo+client 그룹핑
  const purGroups = new Map()
  txRows.filter(r => r.account === '외입').forEach(r => {
    const key = `${r.voucherNo}__${r.client}`
    if (!purGroups.has(key)) purGroups.set(key, [])
    purGroups.get(key).push(r)
  })
  for (const items of purGroups.values()) {
    if (!items[0].client) continue
    const total = items.reduce((s, i) => s + parseNum(i.amount), 0)
    if (total === 0) continue
    bump(expected.purchases, `${dateStr}|${items[0].client}|${total}`)
  }
}

const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
console.log(`일계표 기간: ${fmtDate(minDate)} ~ ${fmtDate(maxDate)}`)
console.log(`기대 매출: ${[...expected.sales.values()].reduce((s,x)=>s+x,0)}건 / 입금: ${[...expected.deposits.values()].reduce((s,x)=>s+x,0)}건 / 경비: ${[...expected.expenses.values()].reduce((s,x)=>s+x,0)}건 / 매입: ${[...expected.purchases.values()].reduce((s,x)=>s+x,0)}건\n`)

// ========= DB 조회 =========
const start = new Date(minDate); start.setHours(0,0,0,0)
const end = new Date(maxDate); end.setHours(23,59,59,999)

const [dbSales, dbExpenses, dbPurchases, dbPayments] = await Promise.all([
  prisma.transaction.findMany({
    where: { type: 'SALE', date: { gte: start, lte: end }, description: { startsWith: '일계표 매출' } },
    include: { client: { select: { name: true } } },
  }),
  prisma.transaction.findMany({
    where: { type: 'EXPENSE', date: { gte: start, lte: end } },
  }),
  prisma.transaction.findMany({
    where: { type: 'PURCHASE', date: { gte: start, lte: end }, description: { startsWith: '매입' } },
    include: { client: { select: { name: true } } },
  }),
  prisma.arPayment.findMany({
    where: { paymentDate: { gte: start, lte: end }, notes: { startsWith: '[일계표]' } },
    include: { receivable: { include: { client: { select: { name: true } } } } },
  }),
])

const actual = {
  sales: new Map(),
  deposits: new Map(),
  expenses: new Map(),
  purchases: new Map(),
}

dbSales.forEach(t => {
  bump(actual.sales, `${fmtDate(t.date)}|${t.client?.name ?? ''}|${t.totalAmount}`)
})
dbExpenses.forEach(t => {
  bump(actual.expenses, `${fmtDate(t.date)}|${t.description ?? ''}|${t.totalAmount}|${t.taxAmount}`)
})
dbPurchases.forEach(t => {
  bump(actual.purchases, `${fmtDate(t.date)}|${t.client?.name ?? ''}|${t.totalAmount}`)
})
dbPayments.forEach(p => {
  bump(actual.deposits, `${fmtDate(p.paymentDate)}|${p.receivable.client.name}|${p.amount}`)
})

console.log(`DB 매출: ${[...actual.sales.values()].reduce((s,x)=>s+x,0)}건 / 입금: ${[...actual.deposits.values()].reduce((s,x)=>s+x,0)}건 / 경비: ${[...actual.expenses.values()].reduce((s,x)=>s+x,0)}건 / 매입: ${[...actual.purchases.values()].reduce((s,x)=>s+x,0)}건\n`)

// ========= diff =========
function diff(expectedMap, actualMap) {
  const onlyExpected = []  // 일계표에 있는데 DB에 없음
  const onlyActual = []    // DB에 있는데 일계표에 없음
  for (const [k, cnt] of expectedMap) {
    const aCnt = actualMap.get(k) ?? 0
    if (cnt > aCnt) onlyExpected.push({ key: k, count: cnt - aCnt })
  }
  for (const [k, cnt] of actualMap) {
    const eCnt = expectedMap.get(k) ?? 0
    if (cnt > eCnt) onlyActual.push({ key: k, count: cnt - eCnt })
  }
  return { onlyExpected, onlyActual }
}

const dSales = diff(expected.sales, actual.sales)
const dDeposits = diff(expected.deposits, actual.deposits)
const dExpenses = diff(expected.expenses, actual.expenses)
const dPurchases = diff(expected.purchases, actual.purchases)

function printSection(title, d, parseKey) {
  console.log(`\n========== ${title} ==========`)
  if (d.onlyExpected.length === 0 && d.onlyActual.length === 0) {
    console.log('완벽히 일치 ✓')
    return
  }
  if (d.onlyExpected.length > 0) {
    let total = 0
    console.log(`\n🆕 일계표에 있는데 DB에 없음 (= 재업로드 시 추가될 것): ${d.onlyExpected.length}건`)
    for (const item of d.onlyExpected.slice(0, 30)) {
      const p = parseKey(item.key)
      const cnt = item.count > 1 ? ` ×${item.count}` : ''
      console.log(`  ${p}${cnt}`)
      total += (p.amount ?? 0) * item.count
    }
    if (d.onlyExpected.length > 30) console.log(`  ... +${d.onlyExpected.length - 30}건 더`)
    console.log(`  소계: ₩${total.toLocaleString()}`)
  }
  if (d.onlyActual.length > 0) {
    let total = 0
    console.log(`\n🗑 DB에만 있음 (= 일계표에서 사라진 stale 데이터): ${d.onlyActual.length}건`)
    for (const item of d.onlyActual.slice(0, 30)) {
      const p = parseKey(item.key)
      const cnt = item.count > 1 ? ` ×${item.count}` : ''
      console.log(`  ${p}${cnt}`)
      total += (p.amount ?? 0) * item.count
    }
    if (d.onlyActual.length > 30) console.log(`  ... +${d.onlyActual.length - 30}건 더`)
    console.log(`  소계: ₩${total.toLocaleString()}`)
  }
}

const fmtSale = (k) => {
  const [date, client, total] = k.split('|')
  return `${date} | ${client} | ₩${parseInt(total).toLocaleString()} | amount: ${parseInt(total)}`
}
const fmtDep = (k) => {
  const [date, client, amount] = k.split('|')
  return `${date} | ${client} | ₩${parseInt(amount).toLocaleString()}`
}
const fmtExp = (k) => {
  const [date, desc, amount, vat] = k.split('|')
  return `${date} | ${desc} | ₩${parseInt(amount).toLocaleString()} (VAT ${vat})`
}

// amount 파싱 추가
function parseKeyAmount(k, idx) {
  const parts = k.split('|')
  return { ...k, amount: parseInt(parts[idx]) || 0, _str: parts.join(' | ') }
}

printSection('매출 (외출 = SALE)', dSales, (k) => {
  const [date, client, total] = k.split('|')
  const obj = { toString: () => `${date} | ${client} | ₩${parseInt(total).toLocaleString()}`, amount: parseInt(total) }
  obj[Symbol.toPrimitive] = () => obj.toString()
  return obj
})

printSection('입금', dDeposits, (k) => {
  const [date, client, amount] = k.split('|')
  const obj = { toString: () => `${date} | ${client} | ₩${parseInt(amount).toLocaleString()}`, amount: parseInt(amount) }
  obj[Symbol.toPrimitive] = () => obj.toString()
  return obj
})

printSection('경비 (현비 = EXPENSE)', dExpenses, (k) => {
  const [date, desc, amount, vat] = k.split('|')
  const obj = { toString: () => `${date} | ${desc} | ₩${parseInt(amount).toLocaleString()} (VAT ${vat})`, amount: parseInt(amount) }
  obj[Symbol.toPrimitive] = () => obj.toString()
  return obj
})

printSection('매입 (외입 = PURCHASE)', dPurchases, (k) => {
  const [date, client, total] = k.split('|')
  const obj = { toString: () => `${date} | ${client} | ₩${parseInt(total).toLocaleString()}`, amount: parseInt(total) }
  obj[Symbol.toPrimitive] = () => obj.toString()
  return obj
})

// 전체 요약
console.log('\n\n========== 전체 요약 ==========')
const addCount = dSales.onlyExpected.length + dDeposits.onlyExpected.length + dExpenses.onlyExpected.length + dPurchases.onlyExpected.length
const delCount = dSales.onlyActual.length + dDeposits.onlyActual.length + dExpenses.onlyActual.length + dPurchases.onlyActual.length
console.log(`재업로드 시 추가될 항목: ${addCount}건`)
console.log(`stale (삭제 후보) 항목:  ${delCount}건`)

// JSON 백업
import fs from 'fs'
const report = {
  generatedAt: new Date().toISOString(),
  file: FILE,
  range: { from: fmtDate(minDate), to: fmtDate(maxDate) },
  diff: {
    sales: dSales,
    deposits: dDeposits,
    expenses: dExpenses,
    purchases: dPurchases,
  },
}
fs.mkdirSync('D:/CFO/scripts/backup', { recursive: true })
fs.writeFileSync('D:/CFO/scripts/backup/reconcile-report.json', JSON.stringify(report, null, 2), 'utf-8')
console.log('\n전체 리포트는 scripts/backup/reconcile-report.json 에 저장됨')

await prisma.$disconnect()
