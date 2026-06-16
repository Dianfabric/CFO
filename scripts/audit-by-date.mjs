// 경영박사 vs DB — 일자별 합계 비교 (그룹화 차이 제거)
import { readFileSync, readdirSync } from 'fs'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const prisma = new PrismaClient()

const DIR = 'D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/경영박사 - 엑셀/'
const CUTOFF = new Date('2026-03-01')

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = parseFloat(String(v).replace(/,/g, '').trim())
  return isNaN(n) ? 0 : n
}
function parseDate(s) {
  const m = String(s).trim().match(/^(\d{2})\.(\d{2})\.(\d{2})$/)
  if (!m) return null
  return new Date(2000 + parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
}
function fmt(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

function parseLedger(path) {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
  const out = []
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const title = String(rows[0]?.[0] ?? '')
    const mm = title.match(/거 ?래 ?처 ?원 ?장\s+(.+?)\s*\[/)
    const clientName = mm ? mm[1].trim() : sn
    const txs = []
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i]
      const date = String(r[0] ?? '').trim()
      const account = String(r[1] ?? '').trim()
      if (!date || date.startsWith('일계') || date.startsWith('월계') || date.startsWith('누계')) continue
      const d = parseDate(date)
      if (!d) continue
      const sales = parseNum(r[6])
      const vat = parseNum(r[7])
      const deposit = parseNum(r[8])
      if (account === '외출') {
        txs.push({ date: d, type: 'SALE', amount: sales + vat })
      } else if (account === '입금') {
        txs.push({ date: d, type: 'PAY', amount: deposit })
      }
    }
    out.push({ clientName, txs })
  }
  return out
}

const files = readdirSync(DIR).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'))
const seen = new Set()
const allClients = []
for (const f of files) {
  const parsed = parseLedger(DIR + f)
  for (const p of parsed) {
    if (seen.has(p.clientName)) continue
    seen.add(p.clientName)
    allClients.push(p)
  }
}

for (const ky of allClients) {
  const client = await prisma.client.findFirst({ where: { name: ky.clientName } })
  if (!client) continue

  // 경영박사 일자별 합계
  const kyByDate = new Map()
  for (const t of ky.txs) {
    if (t.date < CUTOFF) continue
    const key = `${fmt(t.date)}|${t.type}`
    kyByDate.set(key, (kyByDate.get(key) ?? 0) + t.amount)
  }

  // DB 일자별 합계 (일계표 출처만)
  const dbSales = await prisma.transaction.findMany({
    where: { clientId: client.id, type: 'SALE', date: { gte: CUTOFF }, description: { startsWith: '일계표 매출' } },
  })
  const dbPays = await prisma.arPayment.findMany({
    where: { receivable: { clientId: client.id }, paymentDate: { gte: CUTOFF }, notes: { startsWith: '[일계표]' } },
  })

  const dbByDate = new Map()
  for (const t of dbSales) {
    const key = `${fmt(t.date)}|SALE`
    dbByDate.set(key, (dbByDate.get(key) ?? 0) + t.totalAmount)
  }
  for (const p of dbPays) {
    const key = `${fmt(p.paymentDate)}|PAY`
    dbByDate.set(key, (dbByDate.get(key) ?? 0) + p.amount)
  }

  // diff
  const allKeys = new Set([...kyByDate.keys(), ...dbByDate.keys()])
  const diffs = []
  for (const k of allKeys) {
    const ky = kyByDate.get(k) ?? 0
    const db = dbByDate.get(k) ?? 0
    if (Math.abs(ky - db) >= 100) {
      const [date, type] = k.split('|')
      diffs.push({ date, type, ky, db, diff: ky - db })
    }
  }
  diffs.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type))

  if (diffs.length === 0) {
    console.log(`✓ ${ky.clientName} — 일자별 합계 완벽 일치 (3월~)`)
    continue
  }

  console.log(`\n📋 ${ky.clientName} — ${diffs.length}건 차이`)
  let totalDiff = 0
  for (const d of diffs) {
    const arrow = d.diff > 0 ? '🆕경영박사+' : '🗑DB+'
    console.log(`  ${d.date} ${d.type} | 경영박사 ₩${d.ky.toLocaleString().padStart(15)} | DB ₩${d.db.toLocaleString().padStart(15)} | 차이 ${d.diff > 0 ? '+' : ''}${d.diff.toLocaleString()}`)
    totalDiff += d.diff
  }
  console.log(`  합계 차이: ${totalDiff > 0 ? '+' : ''}${totalDiff.toLocaleString()} (경영박사 - DB)`)
}

await prisma.$disconnect()
