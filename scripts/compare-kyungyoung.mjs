// 경영박사 거래처원장 vs DB 미수금 비교
import { readFileSync, readdirSync } from 'fs'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const prisma = new PrismaClient()

const DIR = 'D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/경영박사 - 엑셀/'

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

// 거래처원장에서 거래처명, 최종 잔액, 거래 내역 추출
function parseLedger(path) {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
  const results = []
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // 거래처명 추출: 행0의 첫 셀에 '거 래 처 원 장 {이름} [...]' 패턴
    const title = String(rows[0]?.[0] ?? '')
    const m = title.match(/거 ?래 ?처 ?원 ?장\s+(.+?)\s*\[/)
    const clientName = m ? m[1].trim() : sn

    // 마지막 잔액 = 가장 마지막 데이터 행의 잔액 컬럼 (인덱스 9)
    // 잔액 컬럼이 있는 마지막 유효 행
    let finalBalance = 0
    const transactions = []
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i]
      const date = String(r[0] ?? '').trim()
      const account = String(r[1] ?? '').trim()
      if (!date) continue

      // 일계/월계/전기이월/누계 제외
      if (date.startsWith('일계') || date.startsWith('월계') || date.startsWith('누계')) {
        const bal = parseNum(r[9])
        if (bal !== 0 || r[9]) finalBalance = bal
        continue
      }

      const sales = parseNum(r[6])
      const vat = parseNum(r[7])
      const deposit = parseNum(r[8])
      const bal = parseNum(r[9])
      const note = String(r[10] ?? '').trim()
      const product = String(r[2] ?? '').trim()

      if (account === '외출') {
        transactions.push({ date, type: 'SALE', amount: sales + vat, product, note })
      } else if (account === '입금') {
        transactions.push({ date, type: 'PAY', amount: deposit, product: '', note })
      }
      // bal 의 마지막 값 추적
      if (bal !== 0 || r[9]) finalBalance = bal
    }

    results.push({ clientName, finalBalance, transactions, sheetName: sn })
  }
  return results
}

// === 1) 경영박사 데이터 수집 ===
const files = readdirSync(DIR).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'))
const kyData = []  // { clientName, finalBalance, transactions }
for (const f of files) {
  const parsed = parseLedger(DIR + f)
  for (const p of parsed) kyData.push(p)
}

console.log(`경영박사 거래처 ${kyData.length}건:`)
for (const k of kyData) {
  console.log(`  ${k.clientName} | 최종잔액 ₩${k.finalBalance.toLocaleString()} | 거래 ${k.transactions.length}건`)
}

// === 2) DB에서 매칭 + 잔액 조회 ===
console.log('\n\n=== DB 매칭 + 잔액 비교 ===')

async function findClient(name) {
  const exact = await prisma.client.findFirst({ where: { name } })
  if (exact) return { client: exact, matchType: 'exact' }
  const alias = await prisma.clientAlias.findUnique({ where: { alias: name } })
  if (alias) {
    const c = await prisma.client.findUnique({ where: { id: alias.clientId } })
    if (c) return { client: c, matchType: 'alias' }
  }
  const norm = normalize(name)
  if (norm.length >= 2) {
    const all = await prisma.client.findMany({ select: { id: true, name: true } })
    for (const c of all) {
      if (normalize(c.name) === norm) return { client: c, matchType: 'fuzzy' }
    }
  }
  return { client: null, matchType: 'none' }
}

for (const k of kyData) {
  const { client, matchType } = await findClient(k.clientName)
  if (!client) {
    console.log(`\n❌ ${k.clientName} → DB 매칭 실패`)
    continue
  }

  // DB 잔액 계산 (모든 AR의 originalAmount 합 - 모든 ArPayment 합)
  const ars = await prisma.accountsReceivable.findMany({
    where: { clientId: client.id },
    include: { payments: true, transaction: { select: { description: true, date: true, totalAmount: true } } },
  })
  let totalOrig = 0
  let totalPaid = 0
  for (const ar of ars) {
    totalOrig += ar.originalAmount
    totalPaid += ar.payments.reduce((s, p) => s + p.amount, 0)
  }
  const dbBalance = totalOrig - totalPaid

  const diff = k.finalBalance - dbBalance
  const marker = Math.abs(diff) < 100 ? '✓' : '⚠'

  console.log(`\n${marker} ${k.clientName} → DB ${client.name} (${matchType})`)
  console.log(`   경영박사 잔액: ₩${k.finalBalance.toLocaleString()}`)
  console.log(`   DB 잔액:       ₩${dbBalance.toLocaleString()}`)
  console.log(`   차이:          ₩${diff.toLocaleString()}`)

  if (Math.abs(diff) >= 100) {
    // 매출/입금 합계 비교
    const kySales = k.transactions.filter(t => t.type === 'SALE').reduce((s, t) => s + t.amount, 0)
    const kyPays = k.transactions.filter(t => t.type === 'PAY').reduce((s, t) => s + t.amount, 0)
    const dbSales = ars.reduce((s, ar) => s + ar.originalAmount, 0)
    const dbPays = totalPaid
    console.log(`   매출 합계: 경영박사 ₩${kySales.toLocaleString()} | DB ₩${dbSales.toLocaleString()} | 차이 ₩${(kySales - dbSales).toLocaleString()}`)
    console.log(`   입금 합계: 경영박사 ₩${kyPays.toLocaleString()} | DB ₩${dbPays.toLocaleString()} | 차이 ₩${(kyPays - dbPays).toLocaleString()}`)
  }
}

await prisma.$disconnect()
