import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// DB 거래처
const clients = await prisma.client.findMany({
  where: { OR: [{ name: { contains: '씨오브이' } }, { name: { contains: '코브' } }, { name: { contains: 'COV' } }] },
})
console.log(`=== DB 거래처 ===`)
for (const c of clients) {
  const arsAgg = await prisma.accountsReceivable.aggregate({
    where: { clientId: c.id },
    _sum: { originalAmount: true, remainingAmount: true },
    _count: true,
  })
  const payAgg = await prisma.arPayment.aggregate({
    where: { receivable: { clientId: c.id } },
    _sum: { amount: true },
    _count: true,
  })
  console.log(`  [${c.id}] ${c.name}`)
  console.log(`    AR ${arsAgg._count}건 / 원금 ₩${(arsAgg._sum.originalAmount ?? 0).toLocaleString()} / 잔액 ₩${(arsAgg._sum.remainingAmount ?? 0).toLocaleString()}`)
  console.log(`    Payment ${payAgg._count}건 / ₩${(payAgg._sum.amount ?? 0).toLocaleString()}`)
}

// 일계표에서 검색
const FILES = [
  'D:/Dropbox/일계표(리스트)_3월.xls',
  'D:/Dropbox/일계표.xls',
  'D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.04/일계표(리스트)_260604_101810.xls',
  'D:/Dropbox/일계표 06.02.xls',
]
console.log(`\n=== 일계표 검색 ===`)
const seen = new Set()
for (const path of FILES) {
  try {
    const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
    for (const sn of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' })
      for (const r of rows) {
        const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
        if (!Number.isFinite(no) || no <= 0) continue
        const client = String(r[2] ?? '').trim()
        if (!/씨오브이|코브|COV/i.test(client)) continue
        const k = `${sn}__${r[1]}__${client}__${r[8]}`
        if (seen.has(k)) continue
        seen.add(k)
        console.log(`  [${sn}] ${r[1]} | ${client} | "${r[3]}" 메모="${r[5]}" | ${r[8]} (vat ${r[9]})`)
      }
    }
  } catch {}
}

await prisma.$disconnect()
