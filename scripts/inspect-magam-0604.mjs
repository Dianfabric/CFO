import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const path = 'D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.06/디안_마감_2026.06.04.xlsx'
const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
console.log('시트:', wb.SheetNames)
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
console.log(`총 ${rows.length}행\n`)
console.log('헤더(행0):', rows[0])
console.log()
for (let i = 1; i < Math.min(8, rows.length); i++) {
  console.log(`행${i}:`, rows[i])
}
