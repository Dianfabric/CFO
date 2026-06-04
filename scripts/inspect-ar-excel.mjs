import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const path = 'D:/Dropbox/거래처별 현재 미수금 현황.xls'
const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })

// 헤더 행 찾기 + 데이터 샘플 출력
for (let i = 0; i < Math.min(10, rows.length); i++) {
  const r = rows[i]
  // 빈 셀 제외하고 출력
  const cells = r.map((c, idx) => c ? `[${idx}]${String(c).slice(0, 30)}` : '').filter(Boolean)
  if (cells.length > 0) console.log(`행${i}: ${cells.join(' | ')}`)
}

console.log('\n--- 데이터 행 샘플 (15~25) ---')
for (let i = 5; i < Math.min(25, rows.length); i++) {
  const r = rows[i]
  const cells = r.map((c, idx) => c !== '' ? `[${idx}]${String(c).slice(0, 25)}` : '').filter(Boolean)
  if (cells.length > 0) console.log(`행${i}: ${cells.join(' | ')}`)
}
