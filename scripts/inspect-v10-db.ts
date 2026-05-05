/**
 * v1.0 SQLite DB 인스펙션 (마이그레이션 계획용)
 * 실행: npx tsx scripts/inspect-v10-db.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const counts: Record<string, number> = {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    transactions: await prisma.transaction.count(),
    transactionItems: await prisma.transactionItem.count(),
    accountsReceivable: await prisma.accountsReceivable.count(),
    arPayments: await prisma.arPayment.count(),
    costCategories: await prisma.costCategory.count(),
    recurringCosts: await prisma.recurringCost.count(),
    monthlyCosts: await prisma.monthlyCost.count(),
    aiConversations: await prisma.aiConversation.count(),
    aiMessages: await prisma.aiMessage.count(),
    excelImports: await prisma.excelImport.count(),
    companyProfile: await prisma.companyProfile.count(),
    officialDocuments: await prisma.officialDocument.count(),
  };
  console.log('=== Row counts ===');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(22)}: ${v}`);
  }

  if (counts.transactions > 0) {
    const range = await prisma.transaction.aggregate({
      _min: { date: true },
      _max: { date: true },
    });
    console.log('\n=== Transactions date range ===');
    console.log(`  ${range._min.date?.toISOString().slice(0, 10)} ~ ${range._max.date?.toISOString().slice(0, 10)}`);

    const byType = await prisma.transaction.groupBy({
      by: ['type'],
      _count: true,
      _sum: { totalAmount: true },
    });
    console.log('\n=== Transactions by type ===');
    byType.forEach((t) =>
      console.log(`  ${t.type.padEnd(12)} n=${t._count} sum=${t._sum.totalAmount}`),
    );

    const byChannel = await prisma.transaction.groupBy({
      by: ['channel'],
      _count: true,
    });
    console.log('\n=== Transactions by channel ===');
    byChannel.forEach((c) => console.log(`  ${c.channel.padEnd(15)} n=${c._count}`));
  }

  if (counts.products > 0) {
    const cats = await prisma.product.groupBy({
      by: ['category'],
      _count: true,
    });
    console.log('\n=== Products by category ===');
    cats.forEach((c) => console.log(`  ${(c.category || '(null)').padEnd(20)} n=${c._count}`));
  }

  if (counts.costCategories > 0) {
    const types = await prisma.costCategory.groupBy({
      by: ['type'],
      _count: true,
    });
    console.log('\n=== CostCategories by type ===');
    types.forEach((c) => console.log(`  ${c.type.padEnd(20)} n=${c._count}`));
  }

  if (counts.users > 0) {
    const users = await prisma.user.findMany({
      select: { email: true, name: true, role: true },
    });
    console.log('\n=== Users ===');
    users.forEach((u) => console.log(`  ${u.email.padEnd(30)} ${u.name.padEnd(15)} ${u.role}`));
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERROR:', e);
  await prisma.$disconnect();
  process.exit(1);
});
