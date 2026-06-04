import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

function inspect(path, label) {
  console.log(`\n\n========== ${label} ==========`)
  console.log(`경로: ${path}`)
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
  console.log(`시트 ${wb.SheetNames.length}개: ${wb.SheetNames.slice(0, 5).join(', ')}${wb.SheetNames.length > 5 ? ' ...' : ''}`)

  for (const sheetName of wb.SheetNames.slice(0, 2)) {
    console.log(`\n--- 시트: "${sheetName}" ---`)
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
    console.log(`행 ${rows.length}개`)
    // 처음 15행 출력
    rows.slice(0, 15).forEach((r, i) => {
      const trimmed = r.slice(0, 15).map(c => String(c ?? '').slice(0, 25))
      console.log(`  [${String(i).padStart(2)}] ${JSON.stringify(trimmed)}`)
    })
  }
}

inspect('D:/Dropbox/일계표.xls', '일계표 (외출 기록)')
inspect('D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.04/디안_마감_2026.04.01.xlsx', '디안 마감 (담당자 매핑?)')
