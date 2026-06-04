import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const wb = XLSX.read(readFileSync('D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.06/디안_마감_2026.06.02.xlsx'), { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })

console.log('=== 디안 마감 06.02 전체 행 ===')
console.log('헤더:', JSON.stringify(rows[0]))
console.log()
let last = ''
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]
  let company = String(r[2] ?? '').trim()
  if (company === '"' || company === '') company = last
  else last = company
  const product = String(r[3] ?? '').trim()
  const color = String(r[4] ?? '').trim()
  const qty = String(r[5] ?? '').trim()
  const person = String(r[13] ?? '').trim()
  const role = String(r[14] ?? '').trim()
  console.log(`[${String(i).padStart(2)}] 업체="${company}" 원단="${product}" 색="${color}" 수량=${qty} 담당자="${person}" 직군="${role}"`)
}

// 담당자 코드 집합
const persons = new Set()
for (let i = 1; i < rows.length; i++) {
  const p = String(rows[i][13] ?? '').trim()
  if (p) persons.add(p.toUpperCase())
}
console.log(`\n=== 등장한 담당자 코드 ===`)
for (const p of persons) console.log(`  ${p}`)
