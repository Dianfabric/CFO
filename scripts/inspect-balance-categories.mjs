// 거래처잔액.xls의 카테고리 구조 파악 (소계 라인 기반)
import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const FILE = 'D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/거래처잔액.xls'
const wb = XLSX.read(readFileSync(FILE), { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

console.log('=== 모든 소계/총계 라인 위치 ===')
for (let i = 0; i < rows.length; i++) {
  const name = String(rows[i][0] ?? '').trim()
  if (/^(소계|총계|합계|합 계)/.test(name) || /^소계:/.test(name) || /^총계\(/.test(name)) {
    console.log(`  행${i}: ${name}`)
  }
}

console.log(`\n총 ${rows.length}행`)
