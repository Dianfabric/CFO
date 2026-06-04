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
  if (balance > 0) excelMap.set(normName(name), { name, balance })
}

// DB AR 잔액 0인 거래처 (모든 AR PAID 또는 sum(orig) == sum(paid))
const ars = await prisma.accountsReceivable.findMany({
  include: {
    client: { select: { id: true, name: true } },
    payments: { select: { amount: true } },
  },
})
const dbByClient = new Map()
for (const ar of ars) {
  const cid = ar.clientId
  if (!dbByClient.has(cid)) dbByClient.set(cid, { name: ar.client.name, totalOrig: 0, totalPaid: 0 })
  const e = dbByClient.get(cid)
  e.totalOrig += ar.originalAmount
  e.totalPaid += ar.payments.reduce((s, p) => s + p.amount, 0)
}

// DB 잔액 0인 거래처
const zero = []
for (const [, v] of dbByClient) {
  const balance = v.totalOrig - v.totalPaid
  if (balance <= 0) zero.push({ ...v, balance })
}
console.log(`DB 잔액 ≤ 0 거래처: ${zero.length}곳`)

// 그 중 엑셀에는 미수금 있는 것
const hits = []
for (const z of zero) {
  const ex = excelMap.get(normName(z.name))
  if (ex) hits.push({ db: z, excel: ex })
}

console.log(`\n=== DB 잔액 0인데 엑셀에는 미수금 있는 거래처: ${hits.length}곳 ===`)
hits.sort((a, b) => b.excel.balance - a.excel.balance)
console.log(`${'거래처(DB)'.padEnd(30)} ${'DB원금'.padStart(14)} ${'DB입금'.padStart(14)} ${'DB잔액'.padStart(12)} ${'엑셀잔액'.padStart(14)}`)
console.log('─'.repeat(95))
for (const h of hits) {
  console.log(
    `${h.db.name.padEnd(30)} ${h.db.totalOrig.toLocaleString().padStart(14)} ${h.db.totalPaid.toLocaleString().padStart(14)} ${h.db.balance.toLocaleString().padStart(12)} ${h.excel.balance.toLocaleString().padStart(14)}`,
  )
}
const sum = hits.reduce((s, h) => s + h.excel.balance, 0)
console.log(`\n엑셀 미수금 합계: ₩${sum.toLocaleString()}`)

await prisma.$disconnect()
