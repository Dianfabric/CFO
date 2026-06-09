// TransactionItem 의 메타 4종 (industry/productCategory/processFunction/material) 을 모두 NULL 로 초기화
// 컬럼 인덱스가 한 칸씩 어긋난 상태로 들어간 데이터를 깨끗이 비운 뒤, 마감 엑셀 재업로드로 다시 채울 수 있게 함
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 현재 어떤 값이 들어있는지 한 번 보기
const before = await prisma.transactionItem.count({
  where: {
    OR: [
      { industry: { not: null } },
      { productCategory: { not: null } },
      { processFunction: { not: null } },
      { material: { not: null } },
    ],
  },
})
console.log(`초기화 전 — 메타가 채워진 TransactionItem: ${before}건`)

const result = await prisma.transactionItem.updateMany({
  where: {
    OR: [
      { industry: { not: null } },
      { productCategory: { not: null } },
      { processFunction: { not: null } },
      { material: { not: null } },
    ],
  },
  data: {
    industry: null,
    productCategory: null,
    processFunction: null,
    material: null,
  },
})
console.log(`초기화 완료: ${result.count}건`)

await prisma.$disconnect()
