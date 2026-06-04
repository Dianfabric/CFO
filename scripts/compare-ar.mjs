// 엑셀(거래처별 현재 미수금 현황) vs DB AR 비교
// 일계표에 들어있는 거래처만 (DB AR 있는 것만) 비교, 차이 있는 것만 출력
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

const wb = XLSX.read(readFileSync('D:/Dropbox/거래처별 현재 미수금 현황.xls'), { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })

// 헤더: [0]상호명 [2]전기이월 [3]매출액 [4]수금액 [5]매입액 [6]지급액 [7]잔액
const excelMap = new Map()  // normName → { name, balance }
for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const name = String(r[0] ?? '').trim()
  if (!name) continue
  const balance = parseFloat(String(r[7] ?? 0).replace(/,/g, '')) || 0
  excelMap.set(normName(name), { name, balance })
}
console.log(`엑셀: ${excelMap.size}개 거래처`)

// DB: 거래처별 AR 잔액
const ars = await prisma.accountsReceivable.findMany({
  where: { status: { in: ['OUTSTANDING', 'PARTIAL', 'OVERDUE'] } },
  include: { client: { select: { name: true } } },
})
const dbMap = new Map()  // normName → { name, balance, count }
for (const ar of ars) {
  const k = normName(ar.client.name)
  if (!dbMap.has(k)) dbMap.set(k, { name: ar.client.name, balance: 0, count: 0 })
  const e = dbMap.get(k)
  e.balance += ar.remainingAmount
  e.count++
}
console.log(`DB: ${dbMap.size}개 거래처 (미수금 ${ars.length}건)\n`)

// 비교 — DB에 있는 거래처만 (일계표 매출 있는 것)
const diffs = []
for (const [k, db] of dbMap) {
  const excel = excelMap.get(k)
  if (!excel) {
    diffs.push({ name: db.name, excel: null, db: db.balance, diff: -db.balance, type: '엑셀에 없음' })
    continue
  }
  // 엑셀 잔액은 음수일 수도 있음 (선수금 등) — 양수만 비교
  const ex = Math.max(0, excel.balance)
  const d = ex - db.balance
  if (d !== 0) {
    diffs.push({ name: db.name, excel: ex, db: db.balance, diff: d, type: d > 0 ? '엑셀 > DB' : 'DB > 엑셀' })
  }
}

diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

console.log(`차이 있는 거래처: ${diffs.length}건\n`)
console.log(`${'거래처'.padEnd(30)} ${'엑셀잔액'.padStart(14)} ${'DB잔액'.padStart(14)} ${'차이'.padStart(14)}  타입`)
console.log('─'.repeat(95))
for (const d of diffs) {
  const ex = d.excel === null ? '-'.padStart(14) : d.excel.toLocaleString().padStart(14)
  const db = d.db.toLocaleString().padStart(14)
  const df = (d.diff > 0 ? '+' : '') + d.diff.toLocaleString()
  console.log(`${d.name.padEnd(30)} ${ex} ${db} ${df.padStart(14)}  ${d.type}`)
}

await prisma.$disconnect()
