// 엑셀(거래처별 현재 미수금 현황)에는 있는데 DB에 매출이 없는 거래처
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

// 엑셀
const wb = XLSX.read(readFileSync('D:/Dropbox/거래처별 현재 미수금 현황.xls'), { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
const excelList = []
for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const name = String(r[0] ?? '').trim()
  if (!name) continue
  if (/^(소계|총계|합계|구분)/.test(name)) continue  // 엑셀 소계/총계 행 제외
  const balance = parseFloat(String(r[7] ?? 0).replace(/,/g, '')) || 0
  excelList.push({ name, balance })
}

// DB 거래처 (매출이 있는 거래처 = AR이 있는 거래처)
const dbClients = await prisma.client.findMany({
  where: { accountsReceivable: { some: {} } },
  select: { name: true },
})
const dbSet = new Set(dbClients.map(c => normName(c.name)))

// 엑셀에 있고 DB에는 없는 것
const onlyInExcel = excelList.filter(e => !dbSet.has(normName(e.name)))
const positive = onlyInExcel.filter(e => e.balance > 0).sort((a, b) => b.balance - a.balance)
const negative = onlyInExcel.filter(e => e.balance < 0).sort((a, b) => a.balance - b.balance)
const zero = onlyInExcel.filter(e => e.balance === 0)

console.log(`엑셀 거래처 ${excelList.length}곳 / DB 매출 있는 거래처 ${dbClients.length}곳`)
console.log(`DB에 없는 엑셀 거래처: ${onlyInExcel.length}곳 (잔액+ ${positive.length} / 잔액- ${negative.length} / 잔액0 ${zero.length})\n`)

console.log(`=== DB에 없음 + 엑셀 잔액 > 0 (미수금 보유) ${positive.length}곳 ===`)
console.log(`${'거래처'.padEnd(35)} ${'잔액'.padStart(14)}`)
console.log('─'.repeat(55))
let posSum = 0
for (const e of positive) {
  posSum += e.balance
  console.log(`${e.name.padEnd(35)} ${e.balance.toLocaleString().padStart(14)}`)
}
console.log('─'.repeat(55))
console.log(`${'합계'.padEnd(35)} ${posSum.toLocaleString().padStart(14)}`)

if (negative.length > 0) {
  console.log(`\n=== DB에 없음 + 엑셀 잔액 < 0 (선수금/과입금) ${negative.length}곳 ===`)
  console.log(`${'거래처'.padEnd(35)} ${'잔액'.padStart(14)}`)
  console.log('─'.repeat(55))
  let negSum = 0
  for (const e of negative) {
    negSum += e.balance
    console.log(`${e.name.padEnd(35)} ${e.balance.toLocaleString().padStart(14)}`)
  }
  console.log('─'.repeat(55))
  console.log(`${'합계'.padEnd(35)} ${negSum.toLocaleString().padStart(14)}`)
}

if (zero.length > 0) {
  console.log(`\n=== DB에 없음 + 엑셀 잔액 0 ${zero.length}곳 ===`)
  for (const e of zero) console.log(`  ${e.name}`)
}

await prisma.$disconnect()
