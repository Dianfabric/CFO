// 6/19 마감 엑셀 컬럼 구조 + DB의 6/19 SALE 거래 + 매칭 결과 확인
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const prisma = new PrismaClient()

// 1. 마감 엑셀 파싱
console.log('=== 마감 엑셀 6/19 구조 ===')
const wb = XLSX.read(readFileSync('D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.06/디안_마감_2026.06.19.xlsx'), { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

console.log(`총 ${rows.length}행`)
console.log('\n헤더 (행0):')
console.log(rows[0].slice(0, 22))

console.log('\n=== 각 행 컬럼별 값 (인덱스 표시) ===')
for (let i = 1; i < Math.min(rows.length, 8); i++) {
  console.log(`\n행${i}: NO=${rows[i][1]} 업체=${rows[i][2]}`)
  for (let c = 12; c < 20; c++) {
    const val = rows[i][c]
    const colLetter = String.fromCharCode(65 + c)
    if (val !== '' && val !== undefined) {
      console.log(`  ${colLetter}(${c}): "${val}"`)
    } else {
      console.log(`  ${colLetter}(${c}): (empty)`)
    }
  }
}

// 2. DB의 6/19 SALE 거래
console.log('\n\n=== DB의 6/19 SALE 거래 ===')
const sales = await prisma.transaction.findMany({
  where: {
    type: 'SALE',
    date: { gte: new Date('2026-06-19'), lte: new Date('2026-06-19T23:59:59') },
    description: { startsWith: '일계표 매출' },
  },
  include: { client: { select: { name: true } }, items: true },
  orderBy: { id: 'asc' },
})
console.log(`6/19 일계표 매출 ${sales.length}건`)
for (const t of sales) {
  console.log(`  ${t.client?.name ?? '-'} | ₩${t.totalAmount.toLocaleString().padStart(12)} | salesPerson: ${t.salesPerson ?? '(미지정)'}`)
  for (const it of t.items) {
    console.log(`    - ${it.productName} | 수량 ${it.quantity} | 단가 ${it.unitPrice} | industry=${it.industry ?? '-'} prodCat=${it.productCategory ?? '-'} proc=${it.processFunction ?? '-'} mat=${it.material ?? '-'}`)
  }
}

await prisma.$disconnect()
