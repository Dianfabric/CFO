'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatKRW, formatPercent, getUnitName } from '@/lib/formatters'
import {
  Compass, TrendingUp, TrendingDown,
  Banknote, AlertTriangle, ChevronLeft, ChevronRight, Minus,
} from 'lucide-react'
import DianOverview from './DianOverview'
import IntegratedSections from './IntegratedSections'
import ReconCenter from './ReconCenter'
import BankInbox from './BankInbox'
import TaxPrep from './TaxPrep'
import MagamInsights from './MagamInsights'
import UpcomingSections from './UpcomingSections'

type PeriodType = 'day' | 'week' | 'month' | 'custom'

interface SettlementData {
  date: string; dateLabel: string
  periodDays?: number; isSingleDay?: boolean
  totalSales: number; totalExpenses: number; totalPurchases: number
  salesCount: number; expenseCount: number
  totalVariableCost: number; totalContributionMargin: number; contributionMarginRate: number
  monthlyShippingCost: number; dailyShippingCost: number
  variableCostBreakdown?: {
    fabricCost: { label: string; amount: number; details: { description: string; amount: number; clientName: string | null }[] }
    expenses: { label: string; amount: number; details: { description: string; amount: number; clientName: string | null }[] }
  }
  productCM: {
    productId: string; productName: string; category: string; unit: string
    revenue: number; variableCost: number; quantity: number; shippingAllocation: number
    contributionMargin: number; contributionMarginRate: number
    brand: string
  }[]
  monthlyFixedCost: number; dailyFixedCost: number
  dailyOperatingProfit: number; dailyBEPRate: number
  monthCumulativeCM: number; monthlyBEPRate: number
  fixedCostBreakdown: { category: string; type: string; description: string; monthlyAmount: number; dailyAmount: number }[]
  cashIn: number; cashOut: number; netCashFlow: number
  newReceivables: { clientName: string; amount: number }[]
  newARTotal: number
  comparison: {
    yesterday: { sales: number; count: number; contributionMargin: number }
    lastWeek: { sales: number; count: number }
  }
  transactions: {
    id: string; type: string; totalAmount: number; paymentMethod: string
    paymentStatus: string; clientName: string; channel: string; description: string | null
    items: { name: string; quantity: number; amount: number }[]
  }[]
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getPeriodDates(anchorDate: string, periodType: PeriodType, customEnd?: string): { startDate: string; endDate: string } {
  const [y, m, d] = anchorDate.split('-').map(Number)
  const anchor = new Date(y, m - 1, d)

  if (periodType === 'day') {
    return { startDate: anchorDate, endDate: anchorDate }
  } else if (periodType === 'week') {
    const dow = anchor.getDay() // 0=Sun
    const monday = new Date(anchor)
    monday.setDate(anchor.getDate() - (dow === 0 ? 6 : dow - 1))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { startDate: toDateStr(monday), endDate: toDateStr(sunday) }
  } else if (periodType === 'month') {
    const firstDay = new Date(y, m - 1, 1)
    const lastDay = new Date(y, m, 0)
    return { startDate: toDateStr(firstDay), endDate: toDateStr(lastDay) }
  } else {
    // custom
    return { startDate: anchorDate, endDate: customEnd ?? anchorDate }
  }
}

const TrendIcon = ({ current, previous }: { current: number; previous: number }) => {
  if (current > previous) return <TrendingUp className="w-4 h-4 text-green-500" />
  if (current < previous) return <TrendingDown className="w-4 h-4 text-red-500" />
  return <Minus className="w-4 h-4 text-slate-400" />
}

const changeRate = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const rate = ((current - previous) / previous) * 100
  return `${rate >= 0 ? '+' : ''}${rate.toFixed(1)}%`
}

const PERIOD_LABELS: Record<PeriodType, { unit: string; fixed: string; bep: string; ar: string; cmp: string; prev: string }> = {
  day:    { unit: '일',  fixed: '일일 고정비',   bep: '일일 BEP 달성률', ar: '오늘 발생 미수금',   cmp: '전일/전주 비교', prev: '전일 대비' },
  week:   { unit: '주',  fixed: '주간 고정비',   bep: '주간 BEP 달성률', ar: '주간 발생 미수금',   cmp: '전주 비교',     prev: '전주 대비' },
  month:  { unit: '월',  fixed: '월간 고정비',   bep: '월간 BEP 달성률', ar: '월간 발생 미수금',   cmp: '전월 비교',     prev: '전월 대비' },
  custom: { unit: '기간', fixed: '기간 고정비', bep: '기간 BEP 달성률', ar: '기간 발생 미수금', cmp: '전 기간 비교',  prev: '전 기간 대비' },
}

export default function SettlementView() {
  const today = toDateStr(new Date())
  const [data, setData] = useState<SettlementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(today)
  const [periodType, setPeriodType] = useState<PeriodType>('day')
  const [customEnd, setCustomEnd] = useState(today)
  // 입력 전용 상태 — 이것만 바꿔도 fetch 안 함
  const [pendingDate, setPendingDate] = useState(today)
  const [pendingEnd, setPendingEnd] = useState(today)

  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

  const fetchData = async (anchorDate: string, pt: PeriodType, cEnd?: string) => {
    setLoading(true)
    setData(null)
    try {
      const { startDate, endDate } = getPeriodDates(anchorDate, pt, cEnd)
      const url = startDate === endDate
        ? `/api/settlement/daily?date=${startDate}`
        : `/api/settlement/daily?startDate=${startDate}&endDate=${endDate}`
      const res = await fetch(url)
      const json = await res.json()
      if (res.ok) setData(json)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // selectedDate / periodType / customEnd 가 확정될 때만 fetch
  useEffect(() => { fetchData(selectedDate, periodType, customEnd) }, [selectedDate, periodType, customEnd])

  // 입력 완료(blur / Enter) 시 확정 → fetch 트리거
  const commitDates = () => {
    const d = isValidDate(pendingDate) ? pendingDate : selectedDate
    const e = isValidDate(pendingEnd) ? pendingEnd : customEnd
    // pending이 달라야 실제로 state 업데이트 (불필요한 fetch 방지)
    if (d !== selectedDate) setSelectedDate(d)
    if (periodType === 'custom' && e !== customEnd) setCustomEnd(e)
    // pending을 확정값으로 맞춤
    setPendingDate(d)
    setPendingEnd(e)
  }

  // 화살표 — 즉시 조회 (pending도 함께 동기화)
  const moveDate = (direction: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    let newEnd: string | undefined
    if (periodType === 'day') {
      date.setDate(date.getDate() + direction)
    } else if (periodType === 'week') {
      date.setDate(date.getDate() + direction * 7)
    } else if (periodType === 'month') {
      date.setMonth(date.getMonth() + direction)
    } else {
      const [ey, em, ed] = customEnd.split('-').map(Number)
      const endDate = new Date(ey, em - 1, ed)
      const rangeDays = Math.round((endDate.getTime() - date.getTime()) / 86400000)
      date.setDate(date.getDate() + direction * (rangeDays + 1))
      endDate.setDate(endDate.getDate() + direction * (rangeDays + 1))
      newEnd = toDateStr(endDate)
      setCustomEnd(newEnd)
      setPendingEnd(newEnd)
    }
    const newDate = toDateStr(date)
    setSelectedDate(newDate)
    setPendingDate(newDate)
  }

  // 기간 버튼 — pending 미완성 입력이 있으면 먼저 확정
  const changePeriodType = (pt: PeriodType) => {
    const d = isValidDate(pendingDate) ? pendingDate : selectedDate
    const e = isValidDate(pendingEnd) ? pendingEnd : customEnd
    setPendingDate(d)
    setPendingEnd(e)
    setSelectedDate(d)
    setCustomEnd(e)
    setPeriodType(pt)
  }

  // 오늘 버튼 — 즉시 조회
  const goToday = () => {
    setSelectedDate(today)
    setPendingDate(today)
    if (periodType === 'custom') { setCustomEnd(today); setPendingEnd(today) }
  }

  const lbl = PERIOD_LABELS[periodType]

  // data가 있을 때만 의미 있는 값들 (null-safe)
  const comparison = data?.comparison ?? { yesterday: { sales: 0, count: 0, contributionMargin: 0 }, lastWeek: { sales: 0, count: 0 } }
  const isSingleDay = data?.isSingleDay ?? true
  return (
    <div className="space-y-6">
      {/* 일일 마감 업로드는 공문/자료 페이지로 이동 (기능 동일) */}

      {/* 헤더 */}
      <div className="max-w-2xl">
          <div className="mb-1 flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
              Dian Compass
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            경영 계기판 — 지금 어디에, 어디로.
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            흔들리는 것은 방향을 몰라서가 아니라, 지금 어디에 있는지 모르기 때문입니다.
            매출·이익·현금의 흐름으로 디안의 현재 위치를 확인하고 나아갈 방향을 짚는
            나침반입니다.
          </p>
          <p className="mt-2 border-l-2 border-slate-200 pl-2.5 text-xs italic text-slate-400">
            “측정할 수 없으면, 관리할 수 없다.” — 피터 드러커
          </p>
      </div>

      {/* ① 디안 전체 경영지표 + DIAN PULSE — 본체+색동 통합 (엔에이아이디 연동 예정) */}
      <DianOverview />

      {/* ② 디안 매출 — 일일 결산 (기간 선택) */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <h2 className="text-base font-semibold text-slate-900">디안 매출 — 결산 상세</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 기간 선택 */}
          <div className="flex rounded-md overflow-hidden border border-slate-200">
            {(['day', 'week', 'month', 'custom'] as PeriodType[]).map(pt => (
              <button
                key={pt}
                onClick={() => changePeriodType(pt)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  periodType === pt
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {pt === 'day' ? '일별' : pt === 'week' ? '주간' : pt === 'month' ? '월간' : '직접설정'}
              </button>
            ))}
          </div>
          {/* 날짜 내비게이션 */}
          <Button variant="outline" size="icon" onClick={() => moveDate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          {periodType === 'custom' ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={pendingDate}
                onChange={e => setPendingDate(e.target.value)}
                onBlur={commitDates}
                onKeyDown={e => e.key === 'Enter' && commitDates()}
                className="w-36"
              />
              <span className="text-slate-400 text-sm">~</span>
              <Input
                type="date"
                value={pendingEnd}
                min={pendingDate}
                onChange={e => setPendingEnd(e.target.value)}
                onBlur={commitDates}
                onKeyDown={e => e.key === 'Enter' && commitDates()}
                className="w-36"
              />
              <Button
                size="sm"
                className="bg-blue-600 text-white hover:bg-blue-700 px-3"
                onClick={commitDates}
              >
                조회
              </Button>
            </div>
          ) : (
            <Input
              type="date"
              value={pendingDate}
              onChange={e => setPendingDate(e.target.value)}
              onBlur={commitDates}
              onKeyDown={e => e.key === 'Enter' && commitDates()}
              className="w-36"
            />
          )}
          <Button variant="outline" size="icon" onClick={() => moveDate(1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={goToday}>오늘</Button>
        </div>
      </div>

      {/* 로딩 / 에러 / 데이터 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-slate-500">데이터를 불러올 수 없습니다</div>
      ) : (<>

      {/* 제품별 공헌이익 */}
      <Card>
        <CardHeader><CardTitle className="text-base">제품별 공헌이익 분석</CardTitle></CardHeader>
        <CardContent>
          {(data.productCM ?? []).length === 0 ? (
            <p className="text-center text-slate-400 py-8">기간 내 매출 데이터가 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500 bg-slate-50">
                    <th className="p-2 font-medium">제품명</th>
                    <th className="p-2 font-medium">브랜드</th>
                    <th className="p-2 font-medium text-right">수량</th>
                    <th className="p-2 font-medium text-right">매출</th>
                    <th className="p-2 font-medium text-right">원가(변동비)</th>
                    <th className="p-2 font-medium text-right">해외운송비(변동비)</th>
                    <th className="p-2 font-medium text-right">공헌이익</th>
                    <th className="p-2 font-medium text-right">공헌이익률</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.productCM ?? []).map((p, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="p-2 font-medium">{p.productName}</td>
                      <td className="p-2">
                        {p.brand
                          ? <Badge variant="outline" className="text-xs">{p.brand}</Badge>
                          : <span className="text-slate-300 text-xs">-</span>}
                      </td>
                      <td className="p-2 text-right">{p.quantity} {getUnitName(p.unit)}</td>
                      <td className="p-2 text-right">{formatKRW(p.revenue)}</td>
                      <td className="p-2 text-right text-red-600">
                        {p.variableCost > 0 ? formatKRW(p.variableCost) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="p-2 text-right text-orange-500 text-xs">
                        {p.shippingAllocation > 0 ? formatKRW(p.shippingAllocation) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="p-2 text-right font-bold text-green-700">{formatKRW(p.contributionMargin)}</td>
                      <td className="p-2 text-right">
                        <span className={p.contributionMarginRate >= 40 ? 'text-green-600 font-bold' : p.contributionMarginRate >= 20 ? 'text-yellow-600' : 'text-red-600'}>
                          {formatPercent(p.contributionMarginRate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td className="p-2" colSpan={3}>합계</td>
                    <td className="p-2 text-right">{formatKRW(data.totalSales)}</td>
                    <td className="p-2 text-right text-red-600">{formatKRW(data.totalVariableCost)}</td>
                    <td className="p-2 text-right text-orange-500">{formatKRW(data.dailyShippingCost)}</td>
                    <td className="p-2 text-right text-green-700">{formatKRW(data.totalContributionMargin)}</td>
                    <td className="p-2 text-right">{formatPercent(data.contributionMarginRate)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 현금흐름 + 미수금 + 비교 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 현금흐름 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Banknote className="w-4 h-4 text-green-600" />현금흐름</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-600">입금 (현금 매출)</span><span className="font-bold text-green-600">+{formatKRW(data.cashIn)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-600">출금 (비용+매입)</span><span className="font-bold text-red-600">-{formatKRW(data.cashOut)}</span></div>
            <div className="flex justify-between text-sm font-bold border-t pt-2">
              <span>순현금흐름</span>
              <span className={data.netCashFlow >= 0 ? 'text-green-700' : 'text-red-600'}>{formatKRW(data.netCashFlow)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 미수금 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" />{lbl.ar}</CardTitle></CardHeader>
          <CardContent>
            {(data.newReceivables ?? []).length === 0 ? (
              <p className="text-sm text-green-600 font-medium">기간 내 신규 미수금 없음</p>
            ) : (
              <div className="space-y-1">
                {(data.newReceivables ?? []).map((ar, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{ar.clientName}</span>
                    <span className="font-medium text-red-600">{formatKRW(ar.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t pt-1">
                  <span>합계</span><span className="text-red-600">{formatKRW(data.newARTotal)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 비교 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{lbl.cmp}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">{lbl.prev}</p>
              <div className="flex items-center gap-2">
                <TrendIcon current={data.totalSales} previous={comparison.yesterday.sales} />
                <span className="text-sm">매출 {changeRate(data.totalSales, comparison.yesterday.sales)}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendIcon current={data.totalContributionMargin} previous={comparison.yesterday.contributionMargin} />
                <span className="text-sm">공헌이익 {changeRate(data.totalContributionMargin, comparison.yesterday.contributionMargin)}</span>
              </div>
            </div>
            {isSingleDay && (
              <div>
                <p className="text-xs text-slate-400 mb-1">vs 전주 동요일</p>
                <div className="flex items-center gap-2">
                  <TrendIcon current={data.totalSales} previous={comparison.lastWeek.sales} />
                  <span className="text-sm">매출 {changeRate(data.totalSales, comparison.lastWeek.sales)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </>)} {/* data content end */}

      {/* ③ 비용 구조 · 입금·발행 확인 · 재고 — 본체+색동 통합 */}
      <IntegratedSections />

      {/* ④ 대사 센터 — 퍼지 매칭 제안 (매출↔세금계산서 · 통장입금↔미수) */}
      <ReconCenter />

      {/* 통장 미처리 인박스 — 남은 입출금 수동 처리 (거래처 연결 / 사유 분류) */}
      <BankInbox />

      {/* 세금 준비 — 분기 부가세 예상 + 미발행/미수취 파악 */}
      <TaxPrep />

      {/* 출고·마감 인사이트 — 메타 분석 + 미표기 추적 + 출고&미수 (거래 관리 연동 예정) */}
      <MagamInsights />

      {/* ⑤ 연동 예정 (엔에이아이디) */}
      <UpcomingSections />
    </div>
  )
}
