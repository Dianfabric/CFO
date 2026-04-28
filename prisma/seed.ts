import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 제품 등록
  const products = [
    { name: '벨벳 소파원단 A', category: 'SOFA_FABRIC', unit: 'METER', purchasePrice: 15000, sellingPrice: 28000, description: '고급 벨벳, 다크그레이' },
    { name: '벨벳 소파원단 B', category: 'SOFA_FABRIC', unit: 'METER', purchasePrice: 12000, sellingPrice: 22000, description: '벨벳, 베이지' },
    { name: '린넨 커튼원단', category: 'CURTAIN_FABRIC', unit: 'METER', purchasePrice: 8000, sellingPrice: 18000, description: '내추럴 린넨' },
    { name: '암막 커튼원단', category: 'CURTAIN_FABRIC', unit: 'METER', purchasePrice: 10000, sellingPrice: 20000, description: '3중 암막' },
    { name: '실크 벽원단', category: 'WALL_FABRIC', unit: 'METER', purchasePrice: 25000, sellingPrice: 45000, description: '프리미엄 실크' },
    { name: '면 벽원단', category: 'WALL_FABRIC', unit: 'METER', purchasePrice: 6000, sellingPrice: 14000, description: '면 혼방' },
    { name: '맞춤 커튼 (소형)', category: 'CURTAIN', unit: 'PIECE', purchasePrice: 80000, sellingPrice: 180000, description: '소형 창문용 맞춤 제작' },
    { name: '맞춤 커튼 (대형)', category: 'CURTAIN', unit: 'PIECE', purchasePrice: 150000, sellingPrice: 350000, description: '대형 거실 맞춤 제작' },
    { name: '2인 소파 (기본)', category: 'SOFA', unit: 'PIECE', purchasePrice: 400000, sellingPrice: 850000, description: '2인용 기본 소파' },
    { name: '3인 소파 (프리미엄)', category: 'SOFA', unit: 'PIECE', purchasePrice: 700000, sellingPrice: 1500000, description: '3인용 프리미엄 소파' },
  ]
  for (const p of products) {
    await prisma.product.create({ data: p })
  }
  console.log('제품 10개 등록 완료')

  // 거래처 등록
  const clientsData = [
    { name: '(주)하나인테리어', businessNumber: '123-45-67890', type: 'CUSTOMER', phone: '02-1234-5678', contactName: '김대표' },
    { name: '모던홈 디자인', businessNumber: '234-56-78901', type: 'CUSTOMER', phone: '031-234-5678', contactName: '이과장' },
    { name: '럭셔리리빙', businessNumber: '345-67-89012', type: 'CUSTOMER', phone: '02-345-6789', contactName: '박팀장' },
    { name: '소파킹 가구', businessNumber: '456-78-90123', type: 'CUSTOMER', phone: '051-456-7890', contactName: '최사장' },
    { name: '예쁜집 인테리어', businessNumber: '567-89-01234', type: 'CUSTOMER', phone: '032-567-8901', contactName: '정실장' },
    { name: '그린홈 커튼', businessNumber: '678-90-12345', type: 'CUSTOMER', phone: '041-678-9012', contactName: '한대리' },
    { name: '원단나라 (공급)', businessNumber: '789-01-23456', type: 'SUPPLIER', phone: '02-789-0123', contactName: '강부장' },
    { name: '텍스타일코리아 (공급)', businessNumber: '890-12-34567', type: 'SUPPLIER', phone: '031-890-1234', contactName: '오과장' },
  ]
  for (const c of clientsData) {
    await prisma.client.create({ data: c })
  }
  console.log('거래처 8개 등록 완료')

  // 비용 카테고리 + 고정비용
  const rentCat = await prisma.costCategory.create({ data: { name: '사무실/공장 임대', type: 'RENT' } })
  const laborCat = await prisma.costCategory.create({ data: { name: '인건비', type: 'LABOR' } })
  const logCat = await prisma.costCategory.create({ data: { name: '물류/배송', type: 'LOGISTICS' } })
  const utilCat = await prisma.costCategory.create({ data: { name: '공과금/통신', type: 'UTILITIES' } })

  await prisma.recurringCost.createMany({
    data: [
      { costCategoryId: rentCat.id, description: '공장 월 임대료', amount: 2000000, frequency: 'MONTHLY' },
      { costCategoryId: rentCat.id, description: '사무실 월 임대료', amount: 800000, frequency: 'MONTHLY' },
      { costCategoryId: laborCat.id, description: '직원 급여 (3명)', amount: 9000000, frequency: 'MONTHLY' },
      { costCategoryId: logCat.id, description: '택배 계약비', amount: 500000, frequency: 'MONTHLY' },
      { costCategoryId: utilCat.id, description: '전기/수도/가스', amount: 300000, frequency: 'MONTHLY' },
      { costCategoryId: utilCat.id, description: '인터넷/전화', amount: 100000, frequency: 'MONTHLY' },
    ],
  })
  console.log('비용 카테고리 4개 + 고정비용 6개 등록 완료')

  // 샘플 거래 데이터 (최근 30일)
  const allProducts = await prisma.product.findMany()
  const allClients = await prisma.client.findMany({ where: { type: 'CUSTOMER' } })
  const suppliers = await prisma.client.findMany({ where: { type: 'SUPPLIER' } })
  const expenseNames = ['사무용품 구매', '차량 유지비', '식대', '광고비', '소모품']

  const now = new Date()
  for (let day = 30; day >= 0; day--) {
    const date = new Date(now)
    date.setDate(date.getDate() - day)
    date.setHours(9, 0, 0, 0)

    // 하루 2~5건 매출
    const salesCount = 2 + Math.floor(Math.random() * 4)
    for (let s = 0; s < salesCount; s++) {
      const product = allProducts[Math.floor(Math.random() * allProducts.length)]
      const client = allClients[Math.floor(Math.random() * allClients.length)]
      const qty = product.unit === 'METER' ? (5 + Math.floor(Math.random() * 20)) : (1 + Math.floor(Math.random() * 3))
      const amount = qty * product.sellingPrice
      const isCredit = Math.random() < 0.3
      const channel = Math.random() < 0.6 ? 'B2B' : (Math.random() < 0.5 ? 'B2C_OFFLINE' : 'B2C_ONLINE')

      const tx = await prisma.transaction.create({
        data: {
          date,
          type: 'SALE',
          clientId: channel === 'B2B' ? client.id : null,
          totalAmount: amount,
          taxAmount: Math.round(amount * 0.1),
          paymentMethod: isCredit ? 'CREDIT' : (Math.random() < 0.5 ? 'TRANSFER' : 'CARD'),
          paymentStatus: isCredit ? 'UNPAID' : 'PAID',
          channel,
          items: {
            create: [{
              productId: product.id,
              productName: product.name,
              quantity: qty,
              unitPrice: product.sellingPrice,
              amount,
            }],
          },
        },
      })

      if (isCredit && channel === 'B2B') {
        await prisma.accountsReceivable.create({
          data: {
            clientId: client.id,
            transactionId: tx.id,
            originalAmount: amount,
            remainingAmount: amount,
            status: day > 15 ? 'OVERDUE' : 'OUTSTANDING',
          },
        })
      }
    }

    // 하루 0~1건 비용
    if (Math.random() < 0.4) {
      const expenseAmount = 50000 + Math.floor(Math.random() * 200000)
      await prisma.transaction.create({
        data: {
          date,
          type: 'EXPENSE',
          totalAmount: expenseAmount,
          taxAmount: Math.round(expenseAmount * 0.1),
          paymentMethod: 'TRANSFER',
          paymentStatus: 'PAID',
          channel: 'B2B',
          description: expenseNames[Math.floor(Math.random() * expenseNames.length)],
          items: { create: [{ productName: '비용', quantity: 1, unitPrice: expenseAmount, amount: expenseAmount }] },
        },
      })
    }

    // 주 1회 원자재 매입
    if (date.getDay() === 1) {
      const supplier = suppliers[Math.floor(Math.random() * suppliers.length)]
      const fabricProducts = allProducts.filter(p => p.category.includes('FABRIC'))
      const rawProduct = fabricProducts[Math.floor(Math.random() * fabricProducts.length)]
      if (rawProduct) {
        const purchaseQty = 50 + Math.floor(Math.random() * 100)
        const purchaseAmount = purchaseQty * rawProduct.purchasePrice
        await prisma.transaction.create({
          data: {
            date,
            type: 'PURCHASE',
            clientId: supplier.id,
            totalAmount: purchaseAmount,
            taxAmount: Math.round(purchaseAmount * 0.1),
            paymentMethod: 'TRANSFER',
            paymentStatus: 'PAID',
            channel: 'B2B',
            items: { create: [{ productId: rawProduct.id, productName: rawProduct.name, quantity: purchaseQty, unitPrice: rawProduct.purchasePrice, amount: purchaseAmount }] },
          },
        })
      }
    }
  }

  console.log('샘플 거래 데이터 생성 완료 (약 30일분)')
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
