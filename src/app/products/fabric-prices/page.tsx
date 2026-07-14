'use client'

import FabricPriceManager from '@/components/products/FabricPriceManager'

// 직접 라우트(/products/fabric-prices)는 유지. 사이드바에는 별도 메뉴 없음.
// 주 진입점은 /products 페이지의 '원단 단가 관리' 탭.
export default function FabricPricesPage() {
  return <FabricPriceManager />
}
