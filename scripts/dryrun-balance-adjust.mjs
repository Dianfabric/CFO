// 거래처잔액.xls → DB 잔액 보정 dry-run
// - 2/27 자 추가 보정 (기존 잔액 조정과 같은 날짜)
// - DB에 이미 있는 거래처(불일치 48개)만 수정
// - 파일에만 있는 거래처는 리스트만
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
const isAggregateLine = (name) => /^(소계|총계|합계|합 계)/.test(name) || /^소계:/.test(name) || /^총계\(/.test(name)

// 파일 파싱
const wb = XLSX.read(readFileSync(FILE), { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
const fileClients = []
for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const name = String(r[0] ?? '').trim()
  if (!name || isAggregateLine(name)) continue
  const balance = parseNum(r[7])
  fileClients.push({ name, balance })
}

// DB 잔액
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
  dbBalanceMap.set(normalize(c.name), { id: c.id, name: c.name, balance: totalOrig - totalPaid })
}

// 매칭
const toAdjust = []      // DB에 있는데 잔액 다름 (수정 대상)
const onlyFile = []      // 파일에만 있음 (리스트 정리만)

for (const f of fileClients) {
  const norm = normalize(f.name)
  let db = dbBalanceMap.get(norm)
  if (!db) {
    // fuzzy
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
  const diff = f.balance - db.balance
  if (Math.abs(diff) < 1) continue
  toAdjust.push({
    clientId: db.id,
    fileName: f.name,
    dbName: db.name,
    before: db.balance,
    after: f.balance,
    diff,
  })
}

// 1) 보정 대상 표
console.log('═'.repeat(110))
console.log('📋 보정 대상 — DB 미수금 거래처 중 잔액 다른 곳 (2/27 자 보정 추가)')
console.log('═'.repeat(110))
console.log(
  '거래처명'.padEnd(38) +
  '기존(DB)'.padStart(18) +
  '바뀐 잔액(파일)'.padStart(20) +
  '차이'.padStart(18) +
  '  처리'
)
console.log('─'.repeat(110))

toAdjust.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
let totalPlus = 0, totalMinus = 0
let plusCnt = 0, minusCnt = 0
for (const a of toAdjust) {
  const sign = a.diff > 0 ? '+' : ''
  const action = a.diff > 0 ? '🔴 SALE 추가' : '🔵 입금 추가'
  console.log(
    (a.dbName.length > 36 ? a.dbName.slice(0, 35) + '…' : a.dbName).padEnd(38) +
    a.before.toLocaleString().padStart(18) +
    a.after.toLocaleString().padStart(20) +
    `${sign}${a.diff.toLocaleString()}`.padStart(18) +
    `  ${action}`
  )
  if (a.diff > 0) { totalPlus += a.diff; plusCnt++ }
  else { totalMinus += a.diff; minusCnt++ }
}
console.log('─'.repeat(110))
console.log(`총 ${toAdjust.length}건 | SALE 추가 ${plusCnt}건 ₩${totalPlus.toLocaleString()} | 입금 추가 ${minusCnt}건 ₩${Math.abs(totalMinus).toLocaleString()}`)
console.log(`순 변동: ${(totalPlus + totalMinus) > 0 ? '+' : ''}${(totalPlus + totalMinus).toLocaleString()}`)

// 2) 파일에만 있음 (리스트만)
console.log('\n')
console.log('═'.repeat(110))
console.log('📁 파일에만 있는 거래처 (수정 안 함, 리스트만)')
console.log('═'.repeat(110))

const onlyFileNonZero = onlyFile.filter(f => f.balance !== 0).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
console.log('거래처명'.padEnd(40) + '파일 잔액'.padStart(20))
console.log('─'.repeat(110))
let posSum = 0, negSum = 0
for (const f of onlyFileNonZero) {
  console.log(
    (f.name.length > 38 ? f.name.slice(0, 37) + '…' : f.name).padEnd(40) +
    f.balance.toLocaleString().padStart(20)
  )
  if (f.balance > 0) posSum += f.balance
  else negSum += f.balance
}
console.log('─'.repeat(110))
console.log(`총 ${onlyFileNonZero.length}건 | 양수 ${posSum.toLocaleString()} | 음수 ${negSum.toLocaleString()}`)

// JSON 백업 (apply 시 사용)
writeFileSync(
  'D:/CFO/scripts/backup/balance-adjust-plan-2026-02-27.json',
  JSON.stringify({ adjustments: toAdjust, onlyFile: onlyFileNonZero, adjustDate: '2026-02-27' }, null, 2),
)
console.log('\n💾 적용 계획 백업: scripts/backup/balance-adjust-plan-2026-02-27.json')

await prisma.$disconnect()
