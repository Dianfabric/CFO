// 경영박사 8개 거래처 vs DB 거래 단위 1:1 정밀 비교
// 3월 이후만 (1-2월은 DB에 보정으로만 반영)
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

function parseLedger(path) {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
  const out = []
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const title = String(rows[0]?.[0] ?? '')
    const mm = title.match(/거 ?래 ?처 ?원 ?장\s+(.+?)\s*\[/)
    const clientName = mm ? mm[1].trim() : sn
    let finalBalance = 0
    const txs = []
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i]
      const date = String(r[0] ?? '').trim()
      const account = String(r[1] ?? '').trim()
      if (!date) continue
      if (date.startsWith('일계') || date.startsWith('월계') || date.startsWith('누계')) {
        if (r[9]) finalBalance = parseNum(r[9])
        continue
      }
      const d = parseDate(date)
      if (!d) continue
      const sales = parseNum(r[6])
      const vat = parseNum(r[7])
      const deposit = parseNum(r[8])
      const product = String(r[2] ?? '').trim()
      if (account === '외출') {
        txs.push({ date: d, type: 'SALE', amount: sales + vat, product })
      } else if (account === '입금') {
        txs.push({ date: d, type: 'PAY', amount: deposit })
      }
      if (r[9]) finalBalance = parseNum(r[9])
    }
    out.push({ clientName, finalBalance, txs, all: txs })
  }
  return out
}

function fmt(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

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

console.log(`=== 경영박사 거래처 ${allClients.length}개 ===\n`)

for (const ky of allClients) {
  const client = await prisma.client.findFirst({ where: { name: ky.clientName } })
  if (!client) {
    console.log(`❌ ${ky.clientName} 못찾음`)
    continue
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log(`📋 ${ky.clientName}`)
  console.log(`${'='.repeat(70)}`)

  // 3월 이후만 비교
  const kyMar = ky.txs.filter(t => t.date >= CUTOFF)
  const kySales = kyMar.filter(t => t.type === 'SALE')
  const kyPays = kyMar.filter(t => t.type === 'PAY')
  const kySalesBefore = ky.txs.filter(t => t.type === 'SALE' && t.date < CUTOFF).reduce((s,t)=>s+t.amount,0)
  const kyPaysBefore = ky.txs.filter(t => t.type === 'PAY' && t.date < CUTOFF).reduce((s,t)=>s+t.amount,0)
  const beforeBalance = kySalesBefore - kyPaysBefore

  // DB
  const dbSales = await prisma.transaction.findMany({
    where: { clientId: client.id, type: 'SALE', date: { gte: CUTOFF } },
    include: { accountsReceivable: true },
    orderBy: { date: 'asc' },
  })
  const dbPays = await prisma.arPayment.findMany({
    where: { receivable: { clientId: client.id }, paymentDate: { gte: CUTOFF } },
    orderBy: { paymentDate: 'asc' },
  })

  // 보정/placeholder 제외
  const dbSalesReal = dbSales.filter(t => !(t.description ?? '').startsWith('이월') && !(t.description ?? '').startsWith('선수금'))
  const dbSalesCorrection = dbSales.filter(t => (t.description ?? '').startsWith('이월'))
  const dbPaysReal = dbPays.filter(p => !(p.notes ?? '').startsWith('[수동 보정]') && !(p.notes ?? '').startsWith('[이월]'))
  const dbPaysCorrection = dbPays.filter(p => (p.notes ?? '').startsWith('[수동 보정]') || (p.notes ?? '').startsWith('[이월]'))

  console.log(`경영박사 (전체):`)
  console.log(`  2월말까지 매출 ${kySalesBefore.toLocaleString()}, 입금 ${kyPaysBefore.toLocaleString()}, 이월 잔액 ${beforeBalance.toLocaleString()}`)
  console.log(`  3월~ 매출 ${kySales.length}건 ₩${kySales.reduce((s,t)=>s+t.amount,0).toLocaleString()}`)
  console.log(`  3월~ 입금 ${kyPays.length}건 ₩${kyPays.reduce((s,t)=>s+t.amount,0).toLocaleString()}`)
  console.log(`  최종 잔액: ₩${ky.finalBalance.toLocaleString()}`)

  console.log(`\nDB (3월~):`)
  console.log(`  매출(일계표) ${dbSalesReal.length}건 ₩${dbSalesReal.reduce((s,t)=>s+t.totalAmount,0).toLocaleString()}`)
  console.log(`  매출(이월보정) ${dbSalesCorrection.length}건 ₩${dbSalesCorrection.reduce((s,t)=>s+t.totalAmount,0).toLocaleString()}`)
  console.log(`  입금(일계표) ${dbPaysReal.length}건 ₩${dbPaysReal.reduce((s,p)=>s+p.amount,0).toLocaleString()}`)
  console.log(`  입금(수동보정) ${dbPaysCorrection.length}건 ₩${dbPaysCorrection.reduce((s,p)=>s+p.amount,0).toLocaleString()}`)

  // 매출 1:1 매칭 (날짜 + 금액)
  const kySalesMap = new Map()
  for (const t of kySales) {
    const k = `${fmt(t.date)}|${t.amount}`
    kySalesMap.set(k, (kySalesMap.get(k) ?? 0) + 1)
  }
  const dbSalesMap = new Map()
  for (const t of dbSalesReal) {
    const k = `${fmt(t.date)}|${t.totalAmount}`
    dbSalesMap.set(k, (dbSalesMap.get(k) ?? 0) + 1)
  }
  const salesOnlyKy = []
  const salesOnlyDb = []
  for (const [k, c] of kySalesMap) {
    const d = dbSalesMap.get(k) ?? 0
    if (c > d) salesOnlyKy.push({ k, cnt: c - d })
  }
  for (const [k, c] of dbSalesMap) {
    const e = kySalesMap.get(k) ?? 0
    if (c > e) salesOnlyDb.push({ k, cnt: c - e })
  }

  if (salesOnlyKy.length || salesOnlyDb.length) {
    console.log(`\n  📊 매출 차이:`)
    if (salesOnlyKy.length) {
      console.log(`    🆕 경영박사에만 (DB 누락) ${salesOnlyKy.length}건:`)
      let sum = 0
      for (const x of salesOnlyKy.slice(0,15)) {
        const [d, a] = x.k.split('|')
        const am = parseInt(a)
        sum += am * x.cnt
        console.log(`      ${d} | ₩${am.toLocaleString()}${x.cnt>1?` ×${x.cnt}`:''}`)
      }
      console.log(`    소계 ₩${sum.toLocaleString()}`)
    }
    if (salesOnlyDb.length) {
      console.log(`    🗑 DB에만 (경영박사 없음, VAT 부풀림 또는 stale) ${salesOnlyDb.length}건:`)
      let sum = 0
      for (const x of salesOnlyDb.slice(0,15)) {
        const [d, a] = x.k.split('|')
        const am = parseInt(a)
        sum += am * x.cnt
        console.log(`      ${d} | ₩${am.toLocaleString()}${x.cnt>1?` ×${x.cnt}`:''}`)
      }
      console.log(`    소계 ₩${sum.toLocaleString()}`)
    }
  }

  // 입금 1:1 매칭
  const kyPayMap = new Map()
  for (const t of kyPays) {
    const k = `${fmt(t.date)}|${t.amount}`
    kyPayMap.set(k, (kyPayMap.get(k) ?? 0) + 1)
  }
  const dbPayMap = new Map()
  for (const p of dbPaysReal) {
    const k = `${fmt(p.paymentDate)}|${p.amount}`
    dbPayMap.set(k, (dbPayMap.get(k) ?? 0) + 1)
  }
  const payOnlyKy = []
  const payOnlyDb = []
  for (const [k, c] of kyPayMap) {
    const d = dbPayMap.get(k) ?? 0
    if (c > d) payOnlyKy.push({ k, cnt: c - d })
  }
  for (const [k, c] of dbPayMap) {
    const e = kyPayMap.get(k) ?? 0
    if (c > e) payOnlyDb.push({ k, cnt: c - e })
  }

  if (payOnlyKy.length || payOnlyDb.length) {
    console.log(`\n  💰 입금 차이:`)
    if (payOnlyKy.length) {
      console.log(`    🆕 경영박사에만 (DB 누락) ${payOnlyKy.length}건:`)
      let sum = 0
      for (const x of payOnlyKy.slice(0,15)) {
        const [d, a] = x.k.split('|')
        const am = parseInt(a)
        sum += am * x.cnt
        console.log(`      ${d} | ₩${am.toLocaleString()}${x.cnt>1?` ×${x.cnt}`:''}`)
      }
      console.log(`    소계 ₩${sum.toLocaleString()}`)
    }
    if (payOnlyDb.length) {
      console.log(`    🗑 DB에만 (경영박사 없음) ${payOnlyDb.length}건:`)
      let sum = 0
      for (const x of payOnlyDb.slice(0,15)) {
        const [d, a] = x.k.split('|')
        const am = parseInt(a)
        sum += am * x.cnt
        console.log(`      ${d} | ₩${am.toLocaleString()}${x.cnt>1?` ×${x.cnt}`:''}`)
      }
      console.log(`    소계 ₩${sum.toLocaleString()}`)
    }
  }

  if (!salesOnlyKy.length && !salesOnlyDb.length && !payOnlyKy.length && !payOnlyDb.length) {
    console.log(`\n  ✓ 모든 거래 일치 (3월~)`)
  }
}

await prisma.$disconnect()
