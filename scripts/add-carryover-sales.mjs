// 악질/파산 제외 + DB에 없는 판매 거래처 11곳에 이월 매출 등록
// 날짜: 2026-02-28 (3월 이전)
// 백업: 생성된 ID들 JSON 저장

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
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
const ENTRY_DATE = new Date('2026-02-28T12:00:00')
const BACKUP_FILE = 'D:/CFO/scripts/backup/carryover-sales-2026-02-28.json'

// 엑셀 파싱
const wb = XLSX.read(readFileSync('D:/Dropbox/거래처별 현재 미수금 현황.xls'), { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
const excelList = []
let buffer = []
for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const name = String(r[0] ?? '').trim()
  if (!name) continue
  const catMatch = name.match(/소계[:\s]+\d+\.\s*(.+)/)
  if (catMatch) {
    const cat = catMatch[1].trim()
    for (const e of buffer) { e.category = cat; excelList.push(e) }
    buffer = []
    continue
  }
  if (/^(총계|합계|구분)/.test(name)) { buffer = []; continue }
  const balance = parseFloat(String(r[7] ?? 0).replace(/,/g, '')) || 0
  buffer.push({ name, balance, category: '' })
}

// DB 거래처
const dbClients = await prisma.client.findMany({
  where: { accountsReceivable: { some: {} } },
  select: { name: true },
})
const dbSet = new Set(dbClients.map(c => normName(c.name)))

// 대상: 악질/파산 제외 + DB 없음 + 잔액 > 0
const targets = excelList.filter(e =>
  !EXCLUDED_CATEGORIES.some(x => (e.category ?? '').includes(x))
  && !dbSet.has(normName(e.name))
  && e.balance > 0,
)
console.log(`이월 매출 등록 대상: ${targets.length}곳`)
for (const t of targets) console.log(`  ${t.name}  ₩${t.balance.toLocaleString()}`)

const backup = { appliedAt: new Date().toISOString(), entryDate: '2026-02-28', createdClientIds: [], createdTransactionIds: [], createdReceivableIds: [] }

for (const t of targets) {
  // Client 찾기/생성 (이름 정확 일치 우선, 없으면 새로 생성)
  let client = await prisma.client.findFirst({ where: { name: t.name } })
  if (!client) {
    client = await prisma.client.create({ data: { name: t.name, type: 'CUSTOMER' } })
    backup.createdClientIds.push(client.id)
  }
  const tx = await prisma.transaction.create({
    data: {
      date: ENTRY_DATE,
      type: 'SALE',
      clientId: client.id,
      description: `이월 매출 - ${t.name}`,
      totalAmount: t.balance,
      taxAmount: 0,
      paymentMethod: 'CREDIT',
      paymentStatus: 'UNPAID',
      channel: 'B2B',
    },
  })
  backup.createdTransactionIds.push(tx.id)
  const ar = await prisma.accountsReceivable.create({
    data: {
      clientId: client.id,
      transactionId: tx.id,
      originalAmount: t.balance,
      remainingAmount: t.balance,
      status: 'OUTSTANDING',
      notes: `[이월] 2026-02-28 엑셀 잔액 추가`,
    },
  })
  backup.createdReceivableIds.push(ar.id)
  console.log(`  ✓ ${t.name}`)
}

if (!existsSync('D:/CFO/scripts/backup')) mkdirSync('D:/CFO/scripts/backup', { recursive: true })
writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2), 'utf8')
console.log(`\n백업: ${BACKUP_FILE}`)
console.log(`생성: Client ${backup.createdClientIds.length} / Tx ${backup.createdTransactionIds.length} / AR ${backup.createdReceivableIds.length}`)

await prisma.$disconnect()
