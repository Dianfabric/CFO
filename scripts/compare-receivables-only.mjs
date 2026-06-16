// 미수금 거래처만 (7.공장 매입처 제외) DB vs 파일 비교
import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const prisma = new PrismaClient()

const FILE = 'D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/거래처잔액.xls'

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = parseFloat(String(v).replace(/,/g, '').trim())
  return isNaN(n) ? 0 : n
}
function normalize(name) {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s\-_·.&/]/g, '')
    .trim()
    .toUpperCase()
}

// 카테고리 경계 (소계 라인 위치)
// 행99: 소계 1.판매처    → 행3-98: 1.판매처 (96개)
// 행106: 소계 2.미정      → 행100-105: 2.미정 (6개)
// 행132: 소계 3.말일결제  → 행107-131
// 행144: 소계 4.별도관리  → 행133-143
// 행152: 소계 5.대리점    → 행145-151
// 행164: 소계 7.공장 ⚠매입 → 행153-163 (6.X 없음, 그 자리도 매출?)
// 행203: 소계 8.악질      → 행165-202: 7.공장 (38개) ← 매입처
// 행225: 소계 9.파산      → 행204-224: 8.악질 (21개)
// 행226-: 9.파산 (0~1개)
// 행227: 총계

const CATEGORY_RANGES = {
  '1.판매처': [3, 99],
  '2.미정': [100, 106],
  '3.판매처 말일결제': [107, 132],
  '4.판매처 별도관리': [133, 144],
  '5.대리점': [145, 152],
  '6.?': [153, 164],  // 6번 없을 수도, 일단 매출로 분류
  '7.공장(매입)': [165, 203],  // ← 제외 대상
  '8.악질': [204, 225],
  '9.파산': [226, 227],
}

function getCategoryByRow(rowIdx) {
  for (const [cat, [start, end]] of Object.entries(CATEGORY_RANGES)) {
    if (rowIdx >= start && rowIdx < end) return cat
  }
  return null
}
const EXCLUDED_CATEGORY = '7.공장(매입)'

const wb = XLSX.read(readFileSync(FILE), { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

const fileClients = []
for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const name = String(r[0] ?? '').trim()
  if (!name || /^(소계|총계|합계|합 계)/.test(name) || /^소계:/.test(name) || /^총계\(/.test(name)) continue
  const balance = parseNum(r[7])
  const category = getCategoryByRow(i)
  if (category === EXCLUDED_CATEGORY) continue  // 매입처 제외
  fileClients.push({ name, balance, category })
}

console.log(`파일 거래처 (매입 제외): ${fileClients.length}개`)
console.log('\n카테고리별:')
const catCount = {}
for (const f of fileClients) catCount[f.category] = (catCount[f.category] ?? 0) + 1
for (const [k, v] of Object.entries(catCount)) console.log(`  ${k}: ${v}개`)

// 행 153-164 (6번 카테고리?) 확인
console.log('\n행 153-164 내용 확인 (카테고리 6.?):')
for (let i = 153; i < 164; i++) {
  console.log(`  행${i}: ${rows[i][0]} | 잔액 ${rows[i][7]}`)
}

// DB
const dbClients = await prisma.client.findMany({
  include: { accountsReceivable: { include: { payments: { select: { amount: true } } } } },
})
const dbBalanceMap = new Map()
for (const c of dbClients) {
  let totalOrig = 0, totalPaid = 0
  for (const ar of c.accountsReceivable) {
    totalOrig += ar.originalAmount
    totalPaid += ar.payments.reduce((s, p) => s + p.amount, 0)
  }
  dbBalanceMap.set(normalize(c.name), { id: c.id, name: c.name, balance: totalOrig - totalPaid, type: c.type })
}
console.log(`\nDB 거래처 (전체): ${dbClients.length}개`)
const dbCustomers = dbClients.filter(c => c.type === 'CUSTOMER' || c.type === 'BOTH')
console.log(`DB 거래처 (CUSTOMER/BOTH): ${dbCustomers.length}개`)

// 매칭 + 비교
const matched = []        // 잔액 일치
const mismatch = []       // 불일치
const onlyFile = []       // 파일에만
const usedDb = new Set()

for (const f of fileClients) {
  const norm = normalize(f.name)
  let db = dbBalanceMap.get(norm)
  if (!db) {
    for (const [k, v] of dbBalanceMap) {
      if (norm.length >= 3 && (k.includes(norm) || norm.includes(k))) {
        if (norm.length >= 4 || k.length >= 4) { db = v; break }
      }
    }
  }
  if (!db) {
    onlyFile.push(f)
    continue
  }
  usedDb.add(db.id)
  const diff = f.balance - db.balance
  if (Math.abs(diff) < 1) matched.push({ name: f.name, db: db.balance, file: f.balance, category: f.category })
  else mismatch.push({ name: f.name, dbName: db.name, db: db.balance, file: f.balance, diff, category: f.category })
}

const onlyDb = []
for (const c of dbClients) {
  if (usedDb.has(c.id)) continue
  const data = dbBalanceMap.get(normalize(c.name))
  if (data.balance !== 0) onlyDb.push({ name: c.name, balance: data.balance, type: c.type })
}

// 결과
console.log('\n\n══════════════════════════════════════════════════════════')
console.log('미수금 거래처 비교 (매입 7.공장 제외)')
console.log('══════════════════════════════════════════════════════════')
console.log(`✅ 잔액 일치: ${matched.length}개`)
console.log(`⚠ 잔액 불일치: ${mismatch.length}개`)
console.log(`📁 파일에만 있음 (DB에 없음): ${onlyFile.length}개`)
console.log(`💾 DB에만 있음 (파일에 없음): ${onlyDb.length}개`)
console.log(`\n파일 미수금 거래처 총: ${fileClients.length}개`)
console.log(`매칭된 거래처: ${matched.length + mismatch.length}개 (${Math.round((matched.length + mismatch.length) / fileClients.length * 100)}%)`)

// 카테고리별 불일치
console.log('\n=== 카테고리별 분포 ===')
const byCategory = {}
for (const m of matched) {
  if (!byCategory[m.category]) byCategory[m.category] = { match: 0, mismatch: 0, only: 0 }
  byCategory[m.category].match++
}
for (const m of mismatch) {
  if (!byCategory[m.category]) byCategory[m.category] = { match: 0, mismatch: 0, only: 0 }
  byCategory[m.category].mismatch++
}
for (const f of onlyFile) {
  if (!byCategory[f.category]) byCategory[f.category] = { match: 0, mismatch: 0, only: 0 }
  byCategory[f.category].only++
}
console.log('카테고리'.padEnd(25) + '일치'.padStart(8) + '불일치'.padStart(10) + 'DB없음'.padStart(10))
for (const [cat, v] of Object.entries(byCategory)) {
  console.log(cat.padEnd(25) + String(v.match).padStart(8) + String(v.mismatch).padStart(10) + String(v.only).padStart(10))
}

writeFileSync(
  'D:/CFO/scripts/backup/receivables-compare-2026-06-16.json',
  JSON.stringify({ matched, mismatch, onlyFile, onlyDb }, null, 2),
)

await prisma.$disconnect()
