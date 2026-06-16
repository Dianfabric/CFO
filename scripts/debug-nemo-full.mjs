// 네모팽이 — DB 전체 데이터 vs 경영박사 전체 데이터 1:1 비교
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const prisma = new PrismaClient()

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = parseFloat(String(v).replace(/,/g, '').trim())
  return isNaN(n) ? 0 : n
}
function parseDate(s) {
  const m = String(s).trim().match(/^(\d{2})\.(\d{2})\.(\d{2})$/)
  if (!m) return null
  return new Date(2000 + parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
}
function fmt(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

// 경영박사 — 잔액 컬럼 그대로 따라가기 (행 단위, 누적 잔액 변화 추적)
const wb = XLSX.read(readFileSync('D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/경영박사 - 엑셀/네모팽이.xls'), { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

console.log('=== 경영박사 네모팽이 — 잔액 흐름 ===')
let prevBalance = 0
const kyEvents = []
for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const date = String(r[0] ?? '').trim()
  const account = String(r[1] ?? '').trim()
  const product = String(r[2] ?? '').trim()
  const sales = parseNum(r[6])
  const vat = parseNum(r[7])
  const deposit = parseNum(r[8])
  const balance = parseNum(r[9])
  const note = String(r[10] ?? '').trim()

  if (!date) continue
  if (date.startsWith('월계') || date.startsWith('일계') || date.startsWith('누계')) continue
  if (product === '< 전 기 이 월 >') {
    console.log(`  ${date} 전기이월 → 잔액 ${balance.toLocaleString()}`)
    prevBalance = balance
    continue
  }

  const d = parseDate(date)
  if (!d) continue
  const change = balance - prevBalance
  if (account === '외출') {
    kyEvents.push({ date: d, dateStr: fmt(d), type: 'SALE', amount: sales + vat, expectedChange: change, balance, product })
  } else if (account === '입금') {
    kyEvents.push({ date: d, dateStr: fmt(d), type: 'PAY', amount: deposit, expectedChange: -change, balance, note })
  }
  prevBalance = balance
}

// 경영박사 매출/입금 합계
const kySalesSum = kyEvents.filter(e => e.type === 'SALE').reduce((s, e) => s + e.amount, 0)
const kyPaySum = kyEvents.filter(e => e.type === 'PAY').reduce((s, e) => s + e.amount, 0)
console.log(`\n경영박사: 전체 매출 ${kySalesSum.toLocaleString()} | 전체 입금 ${kyPaySum.toLocaleString()} | 마지막 잔액 ${prevBalance.toLocaleString()}`)

// 일자별 합계
const kyByDate = new Map()
for (const e of kyEvents) {
  const key = `${e.dateStr}|${e.type}`
  if (!kyByDate.has(key)) kyByDate.set(key, { count: 0, amount: 0, items: [] })
  const v = kyByDate.get(key)
  v.count++
  v.amount += e.amount
  v.items.push(e)
}

// DB 네모팽이 — 모든 거래
const nemo = await prisma.client.findFirst({ where: { name: '주식회사 네모팽이' } })

const allDbSales = await prisma.transaction.findMany({
  where: { clientId: nemo.id, type: 'SALE' },
  include: { accountsReceivable: true },
  orderBy: { date: 'asc' },
})
const allDbPays = await prisma.arPayment.findMany({
  where: { receivable: { clientId: nemo.id } },
  orderBy: { paymentDate: 'asc' },
})

console.log('\n=== DB 네모팽이 ===')
let dbSalesSum = 0, dbPaySum = 0
for (const t of allDbSales) {
  dbSalesSum += t.totalAmount
}
for (const p of allDbPays) {
  dbPaySum += p.amount
}
console.log(`DB: 전체 매출 ${dbSalesSum.toLocaleString()} | 전체 입금 ${dbPaySum.toLocaleString()}`)

// AR/payment 단위 잔액
const ars = await prisma.accountsReceivable.findMany({
  where: { clientId: nemo.id },
  include: { payments: true },
})
let arOrigSum = 0, arPaySum = 0
for (const ar of ars) {
  arOrigSum += ar.originalAmount
  arPaySum += ar.payments.reduce((s, p) => s + p.amount, 0)
}
console.log(`AR 기준 잔액 = ${arOrigSum.toLocaleString()} - ${arPaySum.toLocaleString()} = ${(arOrigSum - arPaySum).toLocaleString()}`)

// 일자별 비교
console.log('\n=== 일자별 매출+입금 비교 ===')
const dbByDate = new Map()
for (const t of allDbSales) {
  const k = `${fmt(t.date)}|SALE`
  if (!dbByDate.has(k)) dbByDate.set(k, { count: 0, amount: 0 })
  const v = dbByDate.get(k)
  v.count++
  v.amount += t.totalAmount
}
for (const p of allDbPays) {
  const k = `${fmt(p.paymentDate)}|PAY`
  if (!dbByDate.has(k)) dbByDate.set(k, { count: 0, amount: 0 })
  const v = dbByDate.get(k)
  v.count++
  v.amount += p.amount
}

const allKeys = new Set([...kyByDate.keys(), ...dbByDate.keys()])
const sortedKeys = [...allKeys].sort()
for (const k of sortedKeys) {
  const ky = kyByDate.get(k)
  const db = dbByDate.get(k)
  const kyAmt = ky?.amount ?? 0
  const dbAmt = db?.amount ?? 0
  const diff = kyAmt - dbAmt
  const mark = Math.abs(diff) < 1 ? '✓' : '⚠'
  const [date, type] = k.split('|')
  if (mark === '✓') continue
  console.log(`  ${mark} ${date} ${type} | 경영박사 ${(ky?.count ?? 0)}건 ₩${kyAmt.toLocaleString()} | DB ${(db?.count ?? 0)}건 ₩${dbAmt.toLocaleString()} | 차이 ${diff > 0 ? '+' : ''}${diff.toLocaleString()}`)
}

await prisma.$disconnect()
