import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const path = 'D:/Dropbox/일계표(리스트)_3월.xls'
const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
console.log(`시트:`, wb.SheetNames.join(', '))

for (const sn of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' })
  const hits = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const account = String(r[1] ?? '').trim()
    const client = String(r[2] ?? '').trim()
    if (account === '입금' && client.includes('유진디자인')) {
      hits.push({
        row: i + 1,
        client,
        memo: String(r[3] ?? ''),
        spec: String(r[4] ?? ''),
        qty: r[6],
        unit: r[7],
        amount: r[8],
        vat: r[9],
      })
    }
  }
  if (hits.length > 0) {
    console.log(`\n[${sn}] 유진디자인 입금:`)
    for (const h of hits) {
      console.log(`  행${h.row}: ${h.client} | 메모=${h.memo} | 규격=${h.spec} | 수량=${h.qty} | 단가=${h.unit} | 금액=${h.amount} | 부가세=${h.vat}`)
    }
  }
}

// 3/31 시트만 전체 입금 다 보기
const sn = wb.SheetNames.find(s => s.endsWith('03.31'))
if (sn) {
  console.log(`\n\n=== ${sn} 시트 입금 전체 ===`)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' })
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (String(r[1] ?? '').trim() === '입금') {
      console.log(`  행${i+1}: ${r[2]} | ${r[3]} | ₩${Number(r[8]).toLocaleString()}`)
    }
  }
}
