// 일계표(리스트) 파일 구조 파악
import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const path = 'D:/일계표(리스트)_260611_093450.xls'
const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
console.log('=== 시트 목록 ===')
console.log(wb.SheetNames)
console.log()

// 첫 시트 헤더 + 샘플
const firstSheet = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' })
console.log(`=== "${wb.SheetNames[0]}" 시트 총 ${rows.length}행 ===\n`)
console.log('헤더 (행 0):')
console.log(rows[0])
console.log()
console.log('샘플 (행 1~10):')
for (let i = 1; i <= Math.min(10, rows.length - 1); i++) {
  console.log(`행${i}:`, rows[i])
}
