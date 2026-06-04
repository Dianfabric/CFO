import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const path = 'D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.04/디안_마감_2026.04.01~2026.06.02.xlsx'
const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
console.log('시트:', wb.SheetNames)
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
console.log('헤더:', rows[0])
console.log(`총 ${rows.length}행\n`)

// 날짜 분포
const dates = {}
for (let i = 1; i < rows.length; i++) {
  let d = String(rows[i][0] ?? '').trim()
  if (!d) continue
  dates[d] = (dates[d] ?? 0) + 1
}
const sorted = Object.entries(dates).sort()
console.log(`날짜 ${sorted.length}개:`)
console.log(`  최초: ${sorted[0]?.[0]}, 마지막: ${sorted[sorted.length-1]?.[0]}`)
console.log(`  처음 5: ${sorted.slice(0,5).map(([d,c])=>`${d}(${c}행)`).join(' ')}`)
console.log(`  마지막 5: ${sorted.slice(-5).map(([d,c])=>`${d}(${c}행)`).join(' ')}`)

// 담당자 분포
const persons = {}
let lastP = ''
for (let i = 1; i < rows.length; i++) {
  const p = String(rows[i][13] ?? '').trim()
  if (p) { persons[p] = (persons[p] ?? 0) + 1; lastP = p }
}
console.log(`\n담당자 분포:`)
for (const [p, c] of Object.entries(persons).sort((a,b) => b[1]-a[1])) console.log(`  ${p}: ${c}행`)

// 샘플 2행
console.log('\n첫 데이터 행:')
console.log('  ', rows[1])
console.log('마지막 데이터 행:')
console.log('  ', rows[rows.length-1])
