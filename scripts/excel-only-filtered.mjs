// 엑셀(거래처별 현재 미수금 현황) 카테고리별 파싱
// 악질/파산 업체 카테고리는 제외하고, DB에 없는 거래처 잔액 리스트
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

const EXCLUDED_CATEGORIES = ['악질', '파산']

const wb = XLSX.read(readFileSync('D:/Dropbox/거래처별 현재 미수금 현황.xls'), { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })

// 엑셀 구조: 거래처들 ... → "소계: N.카테고리" (그 위 거래처들의 카테고리)
const excelList = []
const categoryStats = new Map()
let buffer = []  // 직전 카테고리 라벨링 대기 중인 거래처들

for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const name = String(r[0] ?? '').trim()
  if (!name) continue

  const catMatch = name.match(/소계[:\s]+\d+\.\s*(.+)/)
  if (catMatch) {
    const cat = catMatch[1].trim()
    for (const e of buffer) { e.category = cat; excelList.push(e) }
    if (!categoryStats.has(cat)) categoryStats.set(cat, { count: 0, sum: 0 })
    const cs = categoryStats.get(cat)
    for (const e of buffer) { cs.count++; cs.sum += e.balance }
    buffer = []
    continue
  }
  if (/^(총계|합계|구분)/.test(name)) { buffer = []; continue }

  const balance = parseFloat(String(r[7] ?? 0).replace(/,/g, '')) || 0
  buffer.push({ name, balance, category: '' })
}
// 마지막에 소계 없이 남은 buffer (= 카테고리 미정) 처리
for (const e of buffer) { e.category = '(미분류)'; excelList.push(e) }

console.log('=== 엑셀 카테고리 분포 ===')
for (const [cat, st] of categoryStats) {
  const tag = EXCLUDED_CATEGORIES.some(x => cat.includes(x)) ? ' ← 제외' : ''
  console.log(`  ${cat.padEnd(20)} ${st.count}곳 ₩${st.sum.toLocaleString()}${tag}`)
}

const dbClients = await prisma.client.findMany({
  where: { accountsReceivable: { some: {} } },
  select: { name: true },
})
const dbSet = new Set(dbClients.map(c => normName(c.name)))

const filtered = excelList.filter(e => !EXCLUDED_CATEGORIES.some(x => (e.category ?? '').includes(x)))
const onlyInExcel = filtered.filter(e => !dbSet.has(normName(e.name)))
const positive = onlyInExcel.filter(e => e.balance > 0).sort((a, b) => b.balance - a.balance)

console.log(`\n=== 악질/파산 제외 + DB에 없음 + 잔액 > 0 : ${positive.length}곳 ===`)
console.log(`${'카테고리'.padEnd(14)} ${'거래처'.padEnd(30)} ${'잔액'.padStart(14)}`)
console.log('─'.repeat(65))
let sum = 0
for (const e of positive) {
  sum += e.balance
  console.log(`${(e.category ?? '').padEnd(14)} ${e.name.padEnd(30)} ${e.balance.toLocaleString().padStart(14)}`)
}
console.log('─'.repeat(65))
console.log(`${'합계'.padEnd(45)} ${sum.toLocaleString().padStart(14)}`)

await prisma.$disconnect()
