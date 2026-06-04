// 일계표에서 생성된 데이터만 삭제 (PDF 데이터는 보존)
// 대상:
//  - SALE: description LIKE '일계표 매출 -%'
//  - PURCHASE: description LIKE '원단 매입원가 -%' (매출 자동 원가)
//  - PURCHASE: description LIKE '매입 -%' (외입 — 단, '관세' 등 일부 제외)
//  - EXPENSE: 일계표 현비에서 생성된 것 (paymentMethod=CASH, 단순 비용)
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 1) SALE 본체 + AR + items
const salesIds = (await prisma.transaction.findMany({
  where: { type: 'SALE', description: { startsWith: '일계표 매출' } },
  select: { id: true, totalAmount: true },
}))
const saleAmount = salesIds.reduce((s, t) => s + t.totalAmount, 0)

// 2) 원단 매입원가 PURCHASE (매출 자동 원가)
const costIds = (await prisma.transaction.findMany({
  where: { type: 'PURCHASE', description: { startsWith: '원단 매입원가' } },
  select: { id: true, totalAmount: true },
}))
const costAmount = costIds.reduce((s, t) => s + t.totalAmount, 0)

// 3) 외입 매입 PURCHASE: description LIKE '매입 -%' (단, 해외/관세/통관 등 PDF 출처는 제외)
const purchaseIds = (await prisma.transaction.findMany({
  where: {
    type: 'PURCHASE',
    description: { startsWith: '매입 -' },
    AND: [
      { NOT: { description: { contains: '관세' } } },
      { NOT: { description: { contains: '해외' } } },
      { NOT: { description: { contains: '시노' } } },
      { NOT: { description: { contains: '엔에스' } } },
    ],
  },
  select: { id: true, totalAmount: true, description: true },
}))
const purAmount = purchaseIds.reduce((s, t) => s + t.totalAmount, 0)

// 4) 현비 EXPENSE: 일계표 EXPENSE는 paymentMethod=CASH로 생성됨
//    하지만 PDF 관세도 EXPENSE라서 description에 '관세'/'통관' 들어가면 제외
const expenseIds = (await prisma.transaction.findMany({
  where: {
    type: 'EXPENSE',
    paymentMethod: 'CASH',
    AND: [
      { NOT: { description: { contains: '관세' } } },
      { NOT: { description: { contains: '통관' } } },
      { NOT: { description: { contains: '국제운송' } } },
      { NOT: { description: { contains: '로드썬' } } },
    ],
  },
  select: { id: true, totalAmount: true, description: true },
}))
const expAmount = expenseIds.reduce((s, t) => s + t.totalAmount, 0)

const allIds = [
  ...salesIds.map(t => t.id),
  ...costIds.map(t => t.id),
  ...purchaseIds.map(t => t.id),
  ...expenseIds.map(t => t.id),
]

console.log('=== 삭제 대상 요약 ===')
console.log(`SALE   (일계표 매출):       ${salesIds.length}건  ₩${saleAmount.toLocaleString()}`)
console.log(`PURCHASE (원단 매입원가):    ${costIds.length}건  ₩${costAmount.toLocaleString()}`)
console.log(`PURCHASE (매입 - XXX 외입): ${purchaseIds.length}건  ₩${purAmount.toLocaleString()}`)
console.log(`EXPENSE  (일계표 현비):     ${expenseIds.length}건  ₩${expAmount.toLocaleString()}`)
console.log(`─────────────────────────────────────────`)
console.log(`총 삭제: ${allIds.length}건  ₩${(saleAmount+costAmount+purAmount+expAmount).toLocaleString()}`)

const arCount = await prisma.accountsReceivable.count({ where: { transactionId: { in: allIds } } })
const itemCount = await prisma.transactionItem.count({ where: { transactionId: { in: allIds } } })
console.log(`연결 AR ${arCount}건 / Item ${itemCount}건 같이 삭제\n`)

// DRY-RUN 여부 확인
const DRY = process.argv.includes('--dry')
if (DRY) {
  console.log('🔍 DRY-RUN 모드 — 실제 삭제 안 함')
  // 샘플 description 확인
  console.log('\n=== 매입 - XXX 외입 샘플 (10건) ===')
  for (const t of purchaseIds.slice(0, 10)) console.log(`  ${t.description} ₩${t.totalAmount.toLocaleString()}`)
  console.log('\n=== EXPENSE 현비 샘플 (10건) ===')
  for (const t of expenseIds.slice(0, 10)) console.log(`  ${t.description} ₩${t.totalAmount.toLocaleString()}`)
  await prisma.$disconnect()
  process.exit(0)
}

console.log('>>> 삭제 실행 중...')
await prisma.accountsReceivable.deleteMany({ where: { transactionId: { in: allIds } } })
console.log(`  AR ${arCount}건 삭제 완료`)
await prisma.transactionItem.deleteMany({ where: { transactionId: { in: allIds } } })
console.log(`  Item ${itemCount}건 삭제 완료`)
await prisma.transaction.deleteMany({ where: { id: { in: allIds } } })
console.log(`  Transaction ${allIds.length}건 삭제 완료`)

// 남은 거래 요약
const remainSale = await prisma.transaction.count({ where: { type: 'SALE' } })
const remainPur = await prisma.transaction.count({ where: { type: 'PURCHASE' } })
const remainExp = await prisma.transaction.count({ where: { type: 'EXPENSE' } })
console.log(`\n=== 삭제 후 남은 거래 ===`)
console.log(`SALE: ${remainSale}건  PURCHASE: ${remainPur}건  EXPENSE: ${remainExp}건`)

await prisma.$disconnect()
console.log('\n완료. 일계표 새로 업로드 가능 상태입니다.')
