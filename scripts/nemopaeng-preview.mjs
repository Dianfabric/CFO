import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const client = await prisma.client.findFirst({ where: { name: { contains: '네모팽이' } } })
console.log(`DB Client: ${client.name}`)

// DB 매출
const sales = await prisma.transaction.findMany({
  where: { type: 'SALE', clientId: client.id },
  orderBy: { date: 'asc' },
})
console.log(`\nDB 매출 ${sales.length}건:`)
for (const s of sales) {
  console.log(`  ${s.date.toISOString().slice(0,10)} | ₩${s.totalAmount.toLocaleString()}`)
}

// 세금계산서
const wb1 = XLSX.read(readFileSync('D:/Dropbox/매출 세금계산서.xls'), { type: 'buffer' })
const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1, defval: '' })
console.log(`\n세금계산서 발행:`)
for (let i = 6; i < rows1.length; i++) {
  const r = rows1[i]
  const name = String(r[11] ?? '')
  if (!name.includes('네모팽이')) continue
  const date = String(r[0] ?? '')
  const total = Number(r[14]) || 0
  const supply = Number(r[15]) || 0
  const tax = Number(r[16]) || 0
  const item = String(r[26] ?? '')
  console.log(`  ${date} | 합계 ₩${total.toLocaleString()} (공급가 ${supply.toLocaleString()} + 세 ${tax.toLocaleString()}) | ${item}`)
}

// 통장 입금
const wb2 = XLSX.read(readFileSync('D:/Dropbox/통장내역 조회.xlsx'), { type: 'buffer' })
const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1, defval: '' })
console.log(`\n통장 입금/출금 (네모팽이 키워드):`)
for (let i = 3; i < rows2.length; i++) {
  const r = rows2[i]
  const desc = String(r[5] ?? '')
  const cp = String(r[12] ?? '')
  if (!/네모팽이/.test(desc + cp)) continue
  const date = String(r[1] ?? '').slice(0, 10)
  const inAmt = Number(r[3]) || 0
  const outAmt = Number(r[2]) || 0
  const dir = inAmt > 0 ? `+₩${inAmt.toLocaleString()}` : `-₩${outAmt.toLocaleString()}`
  console.log(`  ${date} | ${dir} | 거래내용=${desc} 예금주=${cp}`)
}

await prisma.$disconnect()
