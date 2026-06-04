import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

// 거래처명 정규화: (주), 괄호 안 부가설명, 공백 제거
function normalize(name) {
  return String(name ?? '')
    .replace(/\(주\)|㈜/g, '')
    .replace(/\([^)]*\)/g, '')  // 괄호 안 내용 제거
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
}

// 1) 일계표 26.04.01 시트의 SALE(외출) 거래처 추출
const ilgyepyo = XLSX.read(readFileSync('D:/Dropbox/일계표.xls'), { type: 'buffer' })
const ws = ilgyepyo.Sheets['26.04.01']
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

const saleClients = new Set()
const allAccounts = {}
for (const r of rows) {
  const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
  if (!Number.isFinite(no) || no <= 0) continue
  const account = String(r[1] ?? '').trim()
  const client = String(r[2] ?? '').trim()
  allAccounts[account] = (allAccounts[account] ?? 0) + 1
  if (account === '외출' && client) saleClients.add(client)
}
console.log('=== 일계표 26.04.01 account별 행수 ===')
console.log(allAccounts)
console.log(`\n=== 일계표 외출(SALE) 거래처 ${saleClients.size}개 ===`)
for (const c of saleClients) console.log(`  "${c}" → 정규화: "${normalize(c)}"`)

// 2) 디안_마감 2026.04.01 시트1의 업체 추출
const magam = XLSX.read(readFileSync('D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.04/디안_마감_2026.04.01.xlsx'), { type: 'buffer' })
const mws = magam.Sheets['시트1']
const mrows = XLSX.utils.sheet_to_json(mws, { header: 1, defval: '' })

const magamCompanies = new Map() // 업체명 → [담당자, ...]
for (let i = 1; i < mrows.length; i++) {
  const r = mrows[i]
  const company = String(r[2] ?? '').trim()
  const person = String(r[13] ?? '').trim()
  if (!company || company === '"') continue
  if (!magamCompanies.has(company)) magamCompanies.set(company, new Set())
  if (person) magamCompanies.get(company).add(person)
}
console.log(`\n=== 디안 마감 업체 ${magamCompanies.size}개 ===`)
for (const [c, ppl] of magamCompanies) {
  console.log(`  "${c}" → 정규화: "${normalize(c)}" → 담당자: ${[...ppl].join(', ') || '(없음)'}`)
}

// 3) 매칭 확인
const magamNorm = new Map()
for (const [c, ppl] of magamCompanies) magamNorm.set(normalize(c), { orig: c, ppl })

console.log('\n=== 매칭 결과 (일계표 SALE 거래처 기준) ===')
let matched = 0, unmatched = 0
for (const c of saleClients) {
  const n = normalize(c)
  const m = magamNorm.get(n)
  if (m) {
    matched++
    console.log(`  ✓ "${c}" → 마감 "${m.orig}" 담당자=${[...m.ppl].join(',')}`)
  } else {
    unmatched++
    console.log(`  ✗ "${c}" (마감에 없음)`)
  }
}
console.log(`\n일계표 SALE 거래처 중 매칭: ${matched} / 미매칭: ${unmatched}`)

// 4) 반대: 마감에만 있고 일계표에 없는 업체
const saleClientsNorm = new Set([...saleClients].map(normalize))
console.log('\n=== 마감에만 있고 일계표 SALE에 없는 업체 ===')
for (const [c, ppl] of magamCompanies) {
  if (!saleClientsNorm.has(normalize(c))) {
    console.log(`  "${c}" 담당자=${[...ppl].join(',') || '(없음)'}`)
  }
}
