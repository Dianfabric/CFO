import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function normName(name) {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
}

// 엑셀 잔액
const wb = XLSX.read(readFileSync('D:/Dropbox/거래처별 현재 미수금 현황.xls'), { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
const excelMap = new Map()
for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const name = String(r[0] ?? '').trim()
  if (!name) continue
  const balance = parseFloat(String(r[7] ?? 0).replace(/,/g, '')) || 0
  excelMap.set(normName(name), { name, balance })
}

// DB 잔액 = sum(orig) - sum(payments) per client
const ars = await prisma.accountsReceivable.findMany({
  include: {
    client: { select: { id: true, name: true } },
    payments: { select: { amount: true } },
  },
})
const dbMap = new Map()
for (const ar of ars) {
  const k = normName(ar.client.name)
  if (!dbMap.has(k)) dbMap.set(k, { name: ar.client.name, totalOrig: 0, totalPaid: 0 })
  const e = dbMap.get(k)
  e.totalOrig += ar.originalAmount
  e.totalPaid += ar.payments.reduce((s, p) => s + p.amount, 0)
}

const THRESH = 100_000
const diffs = []
for (const [k, db] of dbMap) {
  const dbBal = db.totalOrig - db.totalPaid  // 음수 가능
  const excel = excelMap.get(k)
  const exBal = excel ? excel.balance : 0
  const diff = exBal - dbBal
  if (Math.abs(diff) >= THRESH) {
    diffs.push({ name: db.name, dbBal, exBal, diff, inExcel: !!excel })
  }
}
diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

console.log(`10만원 이상 차이 거래처: ${diffs.length}곳\n`)
console.log(`${'거래처'.padEnd(30)} ${'DB잔액'.padStart(14)} ${'엑셀잔액'.padStart(14)} ${'차이'.padStart(14)}  타입`)
console.log('─'.repeat(95))
for (const d of diffs) {
  const type = !d.inExcel ? '엑셀에없음' : d.diff > 0 ? '엑셀>DB' : 'DB>엑셀'
  const df = (d.diff > 0 ? '+' : '') + d.diff.toLocaleString()
  console.log(
    `${d.name.padEnd(30)} ${d.dbBal.toLocaleString().padStart(14)} ${d.exBal.toLocaleString().padStart(14)} ${df.padStart(14)}  ${type}`,
  )
}

const pos = diffs.filter(d => d.diff > 0).reduce((s, d) => s + d.diff, 0)
const neg = diffs.filter(d => d.diff < 0).reduce((s, d) => s + d.diff, 0)
console.log(`\n+합계(엑셀이 큼): ₩${pos.toLocaleString()}`)
console.log(`-합계(DB가 큼):  ₩${neg.toLocaleString()}`)

await prisma.$disconnect()
