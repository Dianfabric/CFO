// 허용된 담당자 외 값을 null로 정리
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const ALLOWED = ['유대현', '전새로미', '최현진', '한태원', '한태종']

// 현재 분포
const all = await prisma.transaction.groupBy({
  by: ['salesPerson'],
  where: { salesPerson: { not: null } },
  _count: true,
})
console.log('현재 담당자 분포:')
for (const r of all.sort((a, b) => b._count - a._count)) {
  const tag = ALLOWED.includes(r.salesPerson ?? '') ? '✓' : '✗'
  console.log(`  ${tag} ${JSON.stringify(r.salesPerson)}: ${r._count}건`)
}

// 허용 외 값 null로
const result = await prisma.transaction.updateMany({
  where: { salesPerson: { notIn: ALLOWED, not: null } },
  data: { salesPerson: null },
})
console.log(`\n정리: ${result.count}건 → null`)

await prisma.$disconnect()
