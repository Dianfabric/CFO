import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const prisma = new PrismaClient()

// 5/18 매출 2,333,025 찾기
const tx = await prisma.transaction.findMany({
  where: {
    type: 'SALE',
    date: { gte: new Date('2026-05-18'), lte: new Date('2026-05-18T23:59:59') },
    totalAmount: 2333025,
  },
  include: { client: { select: { name: true } }, items: true, accountsReceivable: { include: { payments: true } } },
})

for (const t of tx) {
  console.log(`=== ${t.client?.name} | ₩${t.totalAmount.toLocaleString()} ===`)
  console.log(`  taxAmount: ${t.taxAmount.toLocaleString()}`)
  console.log(`  description: ${t.description}`)
  console.log(`  items 합계 검증:`)
  let amountSum = 0
  for (const it of t.items) {
    console.log(`    - ${it.productName} | 수량 ${it.quantity} | 단가 ${it.unitPrice.toLocaleString()} | 금액 ${it.amount.toLocaleString()}`)
    amountSum += it.amount
  }
  console.log(`  items.amount 합계: ${amountSum.toLocaleString()}`)
  console.log(`  items.amount + taxAmount: ${(amountSum + t.taxAmount).toLocaleString()}`)
}

// 일계표 5/18 시트 확인
console.log('\n\n=== 일계표 5/18 시트 ===')
const wb = XLSX.read(readFileSync('D:/일계표(리스트)_260611_093450.xls'), { type: 'buffer' })
const ws = wb.Sheets['26.05.18']
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

// 외출 행만 출력
console.log('No | 계정 | 거래처 | 품명 | 규격 | 적요 | 수량 | 단가 | 금액 | VAT | 전표')
for (const r of rows) {
  const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
  if (!Number.isFinite(no) || no <= 0) continue
  const account = String(r[1] ?? '').trim()
  if (account !== '외출') continue
  console.log(`${no} | ${account} | ${r[2]} | ${r[3]} | ${r[4]} | ${r[5]} | ${r[6]} | ${r[7]} | ${r[8]} | ${r[9]} | ${r[11]}`)
}

await prisma.$disconnect()
