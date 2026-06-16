// 네모팽이 3/10 케이스 정확히 비교
// 경영박사 ₩2,286,900 vs DB ₩2,079,000 (차이 ₩207,900)
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const prisma = new PrismaClient()

// 1) 일계표 원본
console.log('=== 일계표 3/10 시트의 네모팽이 외출 행 ===')
const wb = XLSX.read(readFileSync('D:/일계표(리스트)_260611_093450.xls'), { type: 'buffer' })
const ws = wb.Sheets['26.03.10']
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
let lSubtotal = 0, lVat = 0
for (const r of rows) {
  const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
  if (!Number.isFinite(no) || no <= 0) continue
  const account = String(r[1] ?? '').trim()
  const client = String(r[2] ?? '').trim()
  if (account !== '외출' || !client.includes('네모팽이')) continue
  const product = String(r[3] ?? '').trim()
  const spec = String(r[4] ?? '').trim()
  const qty = parseFloat(String(r[6] ?? '').replace(/,/g, '')) || 0
  const unit = parseFloat(String(r[7] ?? '').replace(/,/g, '')) || 0
  const amount = parseFloat(String(r[8] ?? '').replace(/,/g, '')) || 0
  const vat = parseFloat(String(r[9] ?? '').replace(/,/g, '')) || 0
  const vno = String(r[11] ?? '').trim()
  console.log(`  No${no} 전표${vno} | ${product} [${spec}] | 수량 ${qty} × ${unit} = ${amount.toLocaleString()} (VAT ${vat.toLocaleString()})`)
  lSubtotal += amount
  lVat += vat
}
console.log(`  → 일계표 합계: subtotal ${lSubtotal.toLocaleString()} + VAT ${lVat.toLocaleString()} = ${(lSubtotal + lVat).toLocaleString()}`)

// 2) 경영박사 원본
console.log('\n=== 경영박사 거래처원장 네모팽이 3/10 ===')
const wb2 = XLSX.read(readFileSync('D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/경영박사 - 엑셀/네모팽이.xls'), { type: 'buffer' })
const ws2 = wb2.Sheets[wb2.SheetNames[0]]
const rows2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' })
let kSales = 0, kVat = 0
for (const r of rows2) {
  const date = String(r[0] ?? '').trim()
  if (date !== '26.03.10') continue
  const account = String(r[1] ?? '').trim()
  if (account !== '외출') continue
  const product = String(r[2] ?? '').trim()
  const spec = String(r[3] ?? '').trim()
  const qty = parseFloat(String(r[4] ?? '').replace(/,/g, '')) || 0
  const unit = parseFloat(String(r[5] ?? '').replace(/,/g, '')) || 0
  const sales = parseFloat(String(r[6] ?? '').replace(/,/g, '')) || 0
  const vat = parseFloat(String(r[7] ?? '').replace(/,/g, '')) || 0
  console.log(`  ${product} [${spec}] | 수량 ${qty} × ${unit} = ${sales.toLocaleString()} (VAT ${vat.toLocaleString()})`)
  kSales += sales
  kVat += vat
}
console.log(`  → 경영박사 합계: subtotal ${kSales.toLocaleString()} + VAT ${kVat.toLocaleString()} = ${(kSales + kVat).toLocaleString()}`)

// 3) DB 매출
console.log('\n=== DB 매출 — 네모팽이 3/10 ===')
const nemo = await prisma.client.findFirst({ where: { name: '주식회사 네모팽이' } })
const txs = await prisma.transaction.findMany({
  where: {
    clientId: nemo.id,
    type: 'SALE',
    date: { gte: new Date('2026-03-10'), lte: new Date('2026-03-10T23:59:59') },
    description: { startsWith: '일계표 매출' },
  },
  include: { items: true },
})
let dbTotal = 0, dbTax = 0
for (const t of txs) {
  console.log(`  Tx ${t.id} | description "${t.description}" | totalAmount ${t.totalAmount.toLocaleString()} | tax ${t.taxAmount.toLocaleString()}`)
  for (const it of t.items) {
    console.log(`    - ${it.productName} | 수량 ${it.quantity} × ${it.unitPrice.toLocaleString()} = ${it.amount.toLocaleString()}`)
  }
  dbTotal += t.totalAmount
  dbTax += t.taxAmount
}
console.log(`  → DB 합계: totalAmount ${dbTotal.toLocaleString()} (tax ${dbTax.toLocaleString()})`)

await prisma.$disconnect()
