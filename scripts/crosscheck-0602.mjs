import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

// 거래처명 정규화 (강화)
function normalize(name) {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
}

// 부분일치 (3자 이상)
function fuzzyMatch(a, b) {
  if (a === b) return true
  if (a.length >= 3 && b.includes(a)) return true
  if (b.length >= 3 && a.includes(b)) return true
  return false
}

// 담당자 코드 → 이름
const PERSON_MAP = {
  HTW: '한태원', HTJ: '한태종', CHJ: '최현진', YDH: '유대현', JSR: '전새로미',
}
function mapPerson(code) {
  const upper = String(code ?? '').trim().toUpperCase()
  if (!upper) return ''
  return PERSON_MAP[upper] ?? upper // 모르는 코드는 그대로
}

// ── 1) 일계표 06.02 (외출 SALE 추출) ──
const ilWB = XLSX.read(readFileSync('D:/Dropbox/일계표 06.02.xls'), { type: 'buffer' })
const ilSheet = ilWB.SheetNames[0]
console.log(`일계표 시트: ${ilSheet}`)
const ilRows = XLSX.utils.sheet_to_json(ilWB.Sheets[ilSheet], { header: 1, defval: '' })

// 외출 거래 행 추출 (No 컬럼이 숫자인 행만)
const saleRows = []
for (const r of ilRows) {
  const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
  if (!Number.isFinite(no) || no <= 0) continue
  const account = String(r[1] ?? '').trim()
  if (account !== '외출') continue
  saleRows.push({
    no,
    client: String(r[2] ?? '').trim(),
    productName: String(r[3] ?? '').trim(),
    spec: String(r[4] ?? '').trim(),
    memo: String(r[5] ?? '').trim(),
    qty: parseFloat(String(r[6] ?? '').replace(/,/g, '')) || 0,
    unitPrice: parseFloat(String(r[7] ?? '').replace(/,/g, '')) || 0,
    amount: parseFloat(String(r[8] ?? '').replace(/,/g, '')) || 0,
    vat: parseFloat(String(r[9] ?? '').replace(/,/g, '')) || 0,
    voucherNo: String(r[11] ?? '').trim(),
  })
}
console.log(`일계표 외출(SALE) ${saleRows.length}건`)

// ── 2) 디안 마감 06.02 (담당자 매핑) ──
const mgWB = XLSX.read(readFileSync('D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.06/디안_마감_2026.06.02.xlsx'), { type: 'buffer' })
const mgRows = XLSX.utils.sheet_to_json(mgWB.Sheets[mgWB.SheetNames[0]], { header: 1, defval: '' })

// 업체별 담당자 (가장 마지막 채워진 값으로) — 같은 업체는 같은 담당자 가정
let lastCompany = ''
const companyToPerson = new Map() // 정규화 업체명 → 담당자 이름
for (let i = 1; i < mgRows.length; i++) {
  const r = mgRows[i]
  let company = String(r[2] ?? '').trim()
  // " 표시는 위 셀과 동일
  if (company === '"' || company === '') {
    company = lastCompany
  } else {
    lastCompany = company
  }
  if (!company) continue
  const person = mapPerson(r[13])
  if (person && !companyToPerson.has(normalize(company))) {
    companyToPerson.set(normalize(company), { person, original: company })
  } else if (!companyToPerson.has(normalize(company))) {
    companyToPerson.set(normalize(company), { person: '', original: company })
  }
}
console.log(`디안 마감 업체 ${companyToPerson.size}개\n`)

// ── 3) 교차 매칭 ──
function findPerson(client) {
  const n = normalize(client)
  // 완전일치
  if (companyToPerson.has(n)) return companyToPerson.get(n)
  // 부분일치
  for (const [k, v] of companyToPerson) {
    if (fuzzyMatch(n, k)) return v
  }
  return null
}

// 전표 그룹핑 (voucherNo + client)
const groups = new Map()
for (const r of saleRows) {
  const key = `${r.voucherNo}__${r.client}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(r)
}

console.log('=== 교차검증 결과 (외출 거래 × 담당자) ===\n')
console.log('전표No   | 거래처                          | 합계금액         | 담당자       | 매칭업체')
console.log('-'.repeat(110))

const result = []
let matched = 0, unmatched = 0
let totalSales = 0

for (const [key, items] of groups) {
  const client = items[0].client
  const total = items.reduce((s, i) => s + i.amount, 0)
  totalSales += total
  const found = findPerson(client)
  const person = found?.person || '(미매칭)'
  const matchedCo = found?.original || ''
  if (found?.person) matched++
  else if (found) matched++  // 매칭은 됐지만 담당자 빈값
  else unmatched++

  console.log(
    `${String(items[0].voucherNo).padEnd(8)} | ${client.padEnd(30)} | ₩${String(total.toLocaleString()).padStart(13)} | ${person.padEnd(10)} | ${matchedCo}`
  )
  result.push({ voucherNo: items[0].voucherNo, client, total, person, matchedCo, items })
}

console.log('-'.repeat(110))
console.log(`거래 ${groups.size}건 / 매출합계 ₩${totalSales.toLocaleString()}`)
console.log(`매칭 ${matched}건 / 미매칭 ${unmatched}건`)

// ── 4) 담당자별 매출 집계 ──
console.log('\n=== 담당자별 매출 ===')
const byPerson = {}
for (const r of result) {
  const k = r.person
  if (!byPerson[k]) byPerson[k] = { count: 0, total: 0 }
  byPerson[k].count++
  byPerson[k].total += r.total
}
const sorted = Object.entries(byPerson).sort((a, b) => b[1].total - a[1].total)
for (const [p, v] of sorted) {
  console.log(`  ${p.padEnd(10)} ${String(v.count).padStart(3)}건 ₩${v.total.toLocaleString().padStart(13)}`)
}

// ── 5) 미매칭 디테일 ──
console.log('\n=== 미매칭 거래 상세 ===')
const unmatchedRes = result.filter(r => r.person === '(미매칭)')
for (const r of unmatchedRes) {
  console.log(`  ${r.client} (₩${r.total.toLocaleString()})`)
  for (const i of r.items) {
    console.log(`    - ${i.productName}${i.spec ? ` [${i.spec}]` : ''} ${i.qty}개 × ${i.unitPrice.toLocaleString()} = ${i.amount.toLocaleString()}`)
  }
}
