// 거래처잔액.xls vs DB 미수금 — 전체 비교
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

// 1. 파일에서 거래처별 잔액 추출
const wb = XLSX.read(readFileSync(FILE), { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

const fileClients = []
for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const name = String(r[0] ?? '').trim()
  if (!name || name === '합계' || name.startsWith('합 계')) continue
  const balance = parseNum(r[7])
  fileClients.push({ name, balance })
}
console.log(`파일 거래처: ${fileClients.length}개`)

// 2. DB 모든 거래처 잔액 계산
const dbClients = await prisma.client.findMany({
  include: {
    accountsReceivable: {
      include: { payments: { select: { amount: true } } },
    },
  },
})

const dbBalanceMap = new Map()  // normalized name → { id, name, balance }
for (const c of dbClients) {
  let totalOrig = 0
  let totalPaid = 0
  for (const ar of c.accountsReceivable) {
    totalOrig += ar.originalAmount
    totalPaid += ar.payments.reduce((s, p) => s + p.amount, 0)
  }
  const balance = totalOrig - totalPaid
  dbBalanceMap.set(normalize(c.name), { id: c.id, name: c.name, balance })
}
console.log(`DB 거래처: ${dbClients.length}개\n`)

// 3. 비교
const matched = []      // 잔액 일치
const mismatch = []     // 잔액 불일치
const onlyFile = []     // 파일에만 (DB에 없음)
const onlyDb = []       // DB에만 (파일에 없음)
const usedDb = new Set()

for (const f of fileClients) {
  const norm = normalize(f.name)
  const db = dbBalanceMap.get(norm)
  if (!db) {
    // 부분 일치 시도 (긴 쪽에 짧은 쪽 포함)
    let found = null
    for (const [k, v] of dbBalanceMap) {
      if (k === norm) { found = v; break }
      if (norm.length >= 3 && (k.includes(norm) || norm.includes(k))) {
        if (norm.length >= 4 || k.length >= 4) found = v
      }
    }
    if (found) {
      usedDb.add(found.id)
      const diff = f.balance - found.balance
      if (Math.abs(diff) < 1) matched.push({ name: f.name, dbName: found.name, balance: f.balance })
      else mismatch.push({ name: f.name, dbName: found.name, file: f.balance, db: found.balance, diff })
    } else {
      onlyFile.push(f)
    }
  } else {
    usedDb.add(db.id)
    const diff = f.balance - db.balance
    if (Math.abs(diff) < 1) matched.push({ name: f.name, dbName: db.name, balance: f.balance })
    else mismatch.push({ name: f.name, dbName: db.name, file: f.balance, db: db.balance, diff })
  }
}

for (const c of dbClients) {
  if (usedDb.has(c.id)) continue
  const bal = dbBalanceMap.get(normalize(c.name)).balance
  if (bal !== 0) onlyDb.push({ name: c.name, balance: bal })
}

// 4. 출력
console.log(`✓ 잔액 일치: ${matched.length}개`)
console.log(`⚠ 잔액 불일치: ${mismatch.length}개`)
console.log(`📁 파일에만 (DB에 없음): ${onlyFile.length}개`)
console.log(`💾 DB에만 (파일에 없음, 잔액 ≠ 0): ${onlyDb.length}개`)

mismatch.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
console.log('\n========== 잔액 불일치 (차이 큰 순) ==========')
for (const m of mismatch) {
  const arrow = m.diff > 0 ? '+' : ''
  console.log(`  ${m.name.padEnd(30)} | 파일 ${m.file.toLocaleString().padStart(15)} | DB ${m.db.toLocaleString().padStart(15)} | 차이 ${arrow}${m.diff.toLocaleString()}`)
}

const sortedFile = onlyFile.filter(f => f.balance !== 0).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
console.log('\n========== 파일에만 있음 (DB에 없는 거래처, 잔액 ≠ 0) ==========')
for (const f of sortedFile) {
  console.log(`  ${f.name.padEnd(30)} | ₩${f.balance.toLocaleString()}`)
}

const sortedDb = onlyDb.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
console.log('\n========== DB에만 있음 (파일에 없는 거래처, 잔액 ≠ 0) ==========')
for (const d of sortedDb) {
  console.log(`  ${d.name.padEnd(30)} | ₩${d.balance.toLocaleString()}`)
}

console.log('\n========== 잔액 일치 ==========')
for (const m of matched.slice(0, 50)) {
  console.log(`  ${m.name.padEnd(30)} | ₩${m.balance.toLocaleString()}`)
}
if (matched.length > 50) console.log(`  ... +${matched.length - 50}개`)

// 합계
const fileTotal = fileClients.reduce((s, x) => s + x.balance, 0)
const dbTotal = [...dbBalanceMap.values()].reduce((s, x) => s + x.balance, 0)
const mismatchDiffTotal = mismatch.reduce((s, m) => s + m.diff, 0)
console.log('\n========== 합계 ==========')
console.log(`파일 전체 잔액 합: ₩${fileTotal.toLocaleString()}`)
console.log(`DB 전체 잔액 합:   ₩${dbTotal.toLocaleString()}`)
console.log(`불일치 차이 합:    ₩${mismatchDiffTotal.toLocaleString()}`)

// JSON 백업
writeFileSync(
  'D:/CFO/scripts/backup/balance-compare-2026-06-16.json',
  JSON.stringify({ matched, mismatch, onlyFile, onlyDb, totals: { file: fileTotal, db: dbTotal, mismatchDiff: mismatchDiffTotal } }, null, 2),
)

await prisma.$disconnect()
