// 꾸밈방 잔액 -45072 원인 파악
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const prisma = new PrismaClient()

// 1. DB의 꾸밈방
console.log('=== DB의 꾸밈방 ===')
const c = await prisma.client.findFirst({ where: { name: '꾸밈방' } })
if (!c) {
  // fuzzy
  const all = await prisma.client.findMany({ where: { name: { contains: '꾸밈' } } })
  console.log('"꾸밈" 포함 거래처:', all.map(x => x.name))
  process.exit(0)
}
console.log(`거래처: ${c.name} (${c.id}) | type: ${c.type}`)

// 2. 모든 SALE
console.log('\n=== 모든 SALE ===')
const sales = await prisma.transaction.findMany({
  where: { clientId: c.id, type: 'SALE' },
  include: { accountsReceivable: { include: { payments: true } } },
  orderBy: { date: 'asc' },
})
let salesSum = 0
for (const t of sales) {
  console.log(`  ${t.date.toISOString().slice(0,10)} | ₩${t.totalAmount.toLocaleString().padStart(12)} | desc: "${t.description}"`)
  salesSum += t.totalAmount
}
console.log(`  매출 합: ₩${salesSum.toLocaleString()}`)

// 3. 모든 ArPayment
console.log('\n=== 모든 ArPayment ===')
const pays = await prisma.arPayment.findMany({
  where: { receivable: { clientId: c.id } },
  include: { receivable: { select: { transactionId: true } } },
  orderBy: { paymentDate: 'asc' },
})
let paySum = 0
for (const p of pays) {
  console.log(`  ${p.paymentDate.toISOString().slice(0,10)} | ₩${p.amount.toLocaleString().padStart(12)} | notes: "${p.notes ?? ''}"`)
  paySum += p.amount
}
console.log(`  입금 합: ₩${paySum.toLocaleString()}`)

console.log(`\n계산된 잔액 = ${salesSum.toLocaleString()} - ${paySum.toLocaleString()} = ${(salesSum - paySum).toLocaleString()}`)

// 4. 거래처잔액.xls의 꾸밈방
console.log('\n=== 거래처잔액.xls의 꾸밈방 ===')
const wb = XLSX.read(readFileSync('D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/거래처잔액.xls'), { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
for (let i = 0; i < rows.length; i++) {
  const r = rows[i]
  const name = String(r[0] ?? '').trim()
  if (name.includes('꾸밈')) {
    console.log(`  행${i}: "${name}" | 전기이월 ${r[2]} | 매출 ${r[3]} | 수금 ${r[4]} | 잔액 ${r[7]}`)
  }
}

// 5. 일계표에서 꾸밈방 거래
console.log('\n=== 일계표에서 꾸밈방 거래 ===')
const ledger = XLSX.read(readFileSync('D:/일계표(리스트)_260611_093450.xls'), { type: 'buffer' })
for (const sn of ledger.SheetNames) {
  const ws = ledger.Sheets[sn]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  for (const r of rows) {
    const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
    if (!Number.isFinite(no) || no <= 0) continue
    const client = String(r[2] ?? '').trim()
    if (!client.includes('꾸밈')) continue
    const account = String(r[1] ?? '').trim()
    const product = String(r[3] ?? '').trim()
    const amount = parseFloat(String(r[8] ?? '').replace(/,/g, '')) || 0
    const vat = parseFloat(String(r[9] ?? '').replace(/,/g, '')) || 0
    console.log(`  ${sn} | ${account} | ${client} | ${product} | 금액 ${amount.toLocaleString()} VAT ${vat.toLocaleString()}`)
  }
}

await prisma.$disconnect()
