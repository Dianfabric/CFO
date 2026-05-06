'use client'

import { useEffect, useState } from 'react'
import KPICards from '@/components/dashboard/KPICards'
import SalesChart from '@/components/dashboard/SalesChart'
import ProductChart from '@/components/dashboard/ProductChart'
import ARSummaryChart from '@/components/dashboard/ARSummaryChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatKRW, formatDate, getTransactionTypeName, getPaymentMethodName, getPaymentStatusName } from '@/lib/formatters'
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

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      const json = await res.json()
      setData(json)
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
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        데이터를 불러올 수 없습니다.
      </div>
    )
  }

  const paymentStatusVariant = (status: string) => {
    if (status === 'PAID') return 'secondary' as const
    if (status === 'PARTIAL') return 'outline' as const
    return 'destructive' as const
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">경영 대시보드</h1>
          <p className="text-sm text-slate-500">실시간 경영 현황을 한눈에 확인하세요</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-1">
          <RefreshCw className="w-4 h-4" />
          새로고침
        </Button>
      </div>

      {/* KPI 카드 */}
      <KPICards data={data.kpi} />

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChart data={data.dailySales} title="최근 7일 매출 추이" />
        <ProductChart data={data.productData} />
      </div>

      {/* 미수금 + AI 인사이트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ARSummaryChart
          data={data.arAging}
          totalAR={data.kpi.totalReceivable}
        />
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              AI CFO 인사이트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 leading-relaxed">
              {data.kpi.monthSales === 0 ? (
                '아직 거래 데이터가 없습니다. 첫 거래를 입력하면 AI가 경영 인사이트를 제공합니다.'
              ) : data.kpi.totalReceivable > data.kpi.monthSales * 0.5 ? (
                '⚠️ 미수금이 월 매출의 50%를 초과하고 있습니다. 현금흐름 관리에 주의가 필요합니다. AI CFO 자문 메뉴에서 상세 분석을 받아보세요.'
              ) : data.kpi.monthMarginRate < 15 ? (
                '📊 이익률이 15% 미만입니다. 가격 전략 재검토가 필요할 수 있습니다. 분석/시뮬레이션 메뉴에서 가격 시뮬레이션을 해보세요.'
              ) : (
                `✅ 이번 달 이익률 ${data.kpi.monthMarginRate.toFixed(1)}%로 양호합니다. AI CFO 자문에서 더 자세한 전략 분석을 받아보세요.`
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 최근 거래 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 거래 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentTransactions.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              거래 내역이 없습니다. &quot;새 거래&quot; 버튼을 눌러 첫 거래를 입력하세요.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-2 font-medium">날짜</th>
                    <th className="pb-2 font-medium">구분</th>
                    <th className="pb-2 font-medium">거래처</th>
                    <th className="pb-2 font-medium text-right">금액</th>
                    <th className="pb-2 font-medium">결제</th>
                    <th className="pb-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTransactions.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-2.5">{formatDate(t.date)}</td>
                      <td>
                        <Badge variant={t.type === 'SALE' ? 'default' : 'secondary'}>
                          {getTransactionTypeName(t.type)}
                        </Badge>
                      </td>
                      <td className="text-slate-700">{t.clientName}</td>
                      <td className="text-right font-medium">{formatKRW(t.totalAmount)}</td>
                      <td className="text-slate-600">{getPaymentMethodName(t.paymentMethod)}</td>
                      <td>
                        <Badge variant={paymentStatusVariant(t.paymentStatus)}>
                          {getPaymentStatusName(t.paymentStatus)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
