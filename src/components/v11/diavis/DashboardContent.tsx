'use client'

/**
 * v1.0 경영 대시보드 콘텐츠 (KPI / 차트 / 미수금 / AI 인사이트 / 최근 거래)
 *
 * `/page.tsx` (DIAVIS 홈) 와 `/dashboard/page.tsx` 양쪽에서 재사용.
 * NVIDIA 톤 적용된 상태 (Card 토큰이 자동 매핑).
 */
import { useEffect, useState } from 'react'
import KPICards from '@/components/dashboard/KPICards'
import SalesChart from '@/components/dashboard/SalesChart'
import ProductChart from '@/components/dashboard/ProductChart'
import ARSummaryChart from '@/components/dashboard/ARSummaryChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  formatKRW,
  formatDate,
  getTransactionTypeName,
  getPaymentMethodName,
  getPaymentStatusName,
} from '@/lib/formatters'
import { Bot, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardData {
  kpi: {
    todaySales: number
    monthSales: number
    monthExpenses: number
    monthProfit: number
    monthMarginRate: number
    totalReceivable: number
    salesCount: number
    previousMonthSales: number
  }
  dailySales: { label: string; sales: number; expenses: number; profit: number }[]
  arAging: { period: string; amount: number; count: number }[]
  productData: { name: string; revenue: number; margin: number; grade: string }[]
  recentTransactions: {
    id: string
    date: string
    type: string
    clientName: string
    totalAmount: number
    paymentMethod: string
    paymentStatus: string
    channel: string
    description: string
  }[]
}

interface Props {
  /** 새로고침 버튼 표시 여부 — DIAVIS 메인에선 hero 가 별개라 false 권장 */
  showRefresh?: boolean
}

export default function DashboardContent({ showRefresh = false }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) {
        setData(null)
        return
      }
      const text = await res.text()
      if (!text) {
        setData(null)
        return
      }
      try {
        const json = JSON.parse(text)
        setData(json)
      } catch {
        setData(null)
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin h-6 w-6 border-2 border-t-transparent"
          style={{ borderColor: 'var(--nv-primary)', borderTopColor: 'transparent', borderRadius: '50%' }}
        />
      </div>
    )
  }

  if (!data || !data.kpi) {
    const apiError = (data as unknown as { error?: string } | null)?.error
    return (
      <div className="space-y-4 py-12 text-center">
        <h2 className="text-[16px] font-bold text-[#1a1a1a]">
          대시보드 데이터를 불러오지 못했습니다
        </h2>
        <p className="text-[14px] text-[#757575]">
          데이터베이스 연결 또는 환경변수 설정을 확인해주세요.
        </p>
        {apiError && (
          <pre className="mx-auto inline-block bg-[#f7f7f7] border border-[#cccccc] px-3 py-2 text-xs text-[#1a1a1a]" style={{ borderRadius: '2px' }}>
            {apiError}
          </pre>
        )}
        <div>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            다시 시도
          </Button>
        </div>
      </div>
    )
  }

  const paymentStatusVariant = (status: string) => {
    if (status === 'PAID') return 'secondary' as const
    if (status === 'PARTIAL') return 'outline' as const
    return 'destructive' as const
  }

  return (
    <div className="space-y-8">
      {showRefresh && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            새로고침
          </Button>
        </div>
      )}

      {/* KPI 카드 */}
      <KPICards data={data.kpi} />

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChart data={data.dailySales} title="최근 7일 매출 추이" />
        <ProductChart data={data.productData} />
      </div>

      {/* 미수금 + AI 인사이트 */}
      {/* 미수금 */}
      <ARSummaryChart data={data.arAging} totalAR={data.kpi.totalReceivable} />
    </div>
  )
}
