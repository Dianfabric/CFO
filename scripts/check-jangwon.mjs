import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const FILES = [
  'D:/Dropbox/일계표(리스트)_3월.xls',
  'D:/Dropbox/일계표.xls',
  'D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.04/일계표(리스트)_260604_101810.xls',
  'D:/Dropbox/일계표 06.02.xls',
]

console.log('=== 일계표에서 장원가구 입금/매출 ===\n')
for (const path of FILES) {
  try {
    const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
    for (const sn of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' })
      for (const r of rows) {
        const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
        if (!Number.isFinite(no) || no <= 0) continue
        const client = String(r[2] ?? '').trim()
        if (!client.includes('장원')) continue
        const account = String(r[1] ?? '').trim()
        console.log(`  [${sn}] ${account} | ${client} | 품명="${r[3]}" 메모="${r[5]}" | 금액=${r[8]} 부가세=${r[9]}`)
      }
    }
  } catch (e) {
    console.error(`${path}: ${e.message}`)
  }
}
