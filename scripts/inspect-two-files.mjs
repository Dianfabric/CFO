import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

function inspect(path) {
  console.log(`\n========== ${path} ==========`)
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
  console.log('시트:', wb.SheetNames)
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' })
    console.log(`\n[${sn}] 총 ${rows.length}행`)
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const r = rows[i].map((c, idx) => c !== '' ? `[${idx}]${String(c).slice(0, 25)}` : '').filter(Boolean)
      if (r.length > 0) console.log(`  행${i}: ${r.join(' | ')}`)
    }
  }
}

inspect('D:/Dropbox/매출 세금계산서.xls')
inspect('D:/Dropbox/통장내역 조회.xlsx')
