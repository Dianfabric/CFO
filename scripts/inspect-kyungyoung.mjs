// 경영박사 엑셀 파일들 구조 파악
import { readFileSync, readdirSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const DIR = 'D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/경영박사 - 엑셀/'
const files = readdirSync(DIR).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'))

for (const f of files) {
  console.log(`\n========== ${f} ==========`)
  const wb = XLSX.read(readFileSync(DIR + f), { type: 'buffer' })
  console.log(`시트: ${wb.SheetNames.join(' / ')}`)
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    console.log(`\n--- 시트 "${sn}" (총 ${rows.length}행) ---`)
    // 첫 15행만
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const row = rows[i].slice(0, 20)
      console.log(`행${i}:`, row)
    }
  }
}
