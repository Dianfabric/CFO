'use client'
/**
 * 가격 시뮬레이션 (Phase 6 #4 ⑦)
 * 가격·원가·수량·탄력성 입력 → 매출·이익·ROI 계산.
 */
import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sparkles, ChevronLeft, Calculator, TrendingUp, TrendingDown } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export default function SimulatorPage() {
  const [unitCost, setUnitCost] = useState('15000')
  const [currentPrice, setCurrentPrice] = useState('25000')
  const [currentQty, setCurrentQty] = useState('100')
  const [newPrice, setNewPrice] = useState('30000')
  const [elasticity, setElasticity] = useState('-1.5') // 가격 탄력성 -1.5 = 가격 10% 인상 시 수량 15% 감소

  const calc = useMemo(() => {
    const cost = Number(unitCost) || 0
    const cur = Number(currentPrice) || 0
    const qty = Number(currentQty) || 0
    const next = Number(newPrice) || 0
    const e = Number(elasticity) || 0

    const priceChangePct = cur > 0 ? (next - cur) / cur : 0
    const newQty = qty * (1 + priceChangePct * e)

    const currentRevenue = cur * qty
    const newRevenue = next * newQty
    const currentMargin = (cur - cost) * qty
    const newMargin = (next - cost) * newQty
    const currentMarginRate = cur > 0 ? ((cur - cost) / cur) * 100 : 0
    const newMarginRate = next > 0 ? ((next - cost) / next) * 100 : 0
    const breakeven = (cur - cost) * qty // baseline absolute margin
    // breakeven qty for new price: amount needed to maintain current margin
    const breakevenQty =
      next > cost ? (cur - cost) * qty / (next - cost) : Infinity

    return {
      priceChangePct,
      newQty,
      currentRevenue,
      newRevenue,
      currentMargin,
      newMargin,
      currentMarginRate,
      newMarginRate,
      breakeven,
      breakevenQty,
      revenueDelta: newRevenue - currentRevenue,
      marginDelta: newMargin - currentMargin,
    }
  }, [unitCost, currentPrice, currentQty, newPrice, elasticity])

  return (
    <div className="space-y-6">
      <Link
        href="/finance/pricing"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        가격 결정 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #4 ⑦ 가격 시뮬레이션
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">가격 시뮬레이터</h1>
        <p className="mt-1 text-sm text-slate-500">
          가격·원가·수량·탄력성 입력 → 매출·이익·손익분기 자동 계산
        </p>
      </div>

      {/* 입력 + 결과 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 입력 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calculator className="h-4 w-4 text-blue-500" />
              가정 입력
            </CardTitle>
            <CardDescription>현재 상태 + 새 가격 + 가격 탄력성</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>단위 원가 (원)</Label>
                <Input
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>현재 가격 (원)</Label>
                <Input
                  type="number"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>현재 수량 (월)</Label>
                <Input
                  type="number"
                  value={currentQty}
                  onChange={(e) => setCurrentQty(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>새 가격 (원)</Label>
                <Input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="border-blue-300"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>가격 탄력성 (e)</Label>
              <Input
                type="number"
                step="0.1"
                value={elasticity}
                onChange={(e) => setElasticity(e.target.value)}
              />
              <p className="text-[11px] text-slate-500">
                <strong>-1.5</strong> = 가격 10% 인상 → 수량 15% 감소 (전형적 디안 인테리어 디자이너).
                <br />
                <strong>-0.5</strong> = 비탄력적 (필수재 / 럭셔리 / 충성 고객).
                <br />
                <strong>-3.0</strong> = 매우 탄력적 (가격 민감 거래처).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 핵심 결과 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">시뮬레이션 결과</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ResultRow
              label="가격 변화율"
              value={`${(calc.priceChangePct * 100).toFixed(1)}%`}
              tone={calc.priceChangePct > 0 ? 'warn' : 'good'}
            />
            <ResultRow
              label="예상 수량 변화"
              value={`${Number(currentQty)} → ${calc.newQty.toFixed(0)}`}
              tone={calc.newQty < Number(currentQty) ? 'warn' : 'good'}
            />
            <div className="my-2 border-t" />
            <ResultRow
              label="기존 매출"
              value={formatKRW(calc.currentRevenue)}
              tone="neutral"
            />
            <ResultRow
              label="새 매출"
              value={formatKRW(calc.newRevenue)}
              tone={calc.newRevenue >= calc.currentRevenue ? 'good' : 'warn'}
              delta={
                calc.currentRevenue > 0
                  ? ((calc.newRevenue - calc.currentRevenue) / calc.currentRevenue) * 100
                  : null
              }
            />
            <div className="my-2 border-t" />
            <ResultRow
              label="기존 공헌이익"
              value={formatKRW(calc.currentMargin)}
              tone="neutral"
            />
            <ResultRow
              label="새 공헌이익"
              value={formatKRW(calc.newMargin)}
              tone={calc.newMargin >= calc.currentMargin ? 'good' : 'warn'}
              delta={
                calc.currentMargin > 0
                  ? ((calc.newMargin - calc.currentMargin) / calc.currentMargin) * 100
                  : null
              }
            />
            <ResultRow
              label="마진율 변화"
              value={`${calc.currentMarginRate.toFixed(1)}% → ${calc.newMarginRate.toFixed(1)}%`}
              tone={calc.newMarginRate >= calc.currentMarginRate ? 'good' : 'warn'}
            />
            <div className="my-2 border-t" />
            <ResultRow
              label="손익분기 수량 (이익 유지)"
              value={
                Number.isFinite(calc.breakevenQty)
                  ? `${calc.breakevenQty.toFixed(0)}개`
                  : '계산 불가'
              }
              tone="neutral"
            />
            <p className="text-[11px] text-slate-500">
              새 가격으로 기존 이익 ({formatKRW(calc.breakeven)})을 유지하려면 최소
              <strong className="mx-1 text-slate-700">
                {Number.isFinite(calc.breakevenQty) ? calc.breakevenQty.toFixed(0) : '∞'}개
              </strong>
              팔아야 합니다.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 권장사항 */}
      <Card
        className={cn(
          'border',
          calc.marginDelta > 0
            ? 'border-emerald-200 bg-emerald-50/30'
            : calc.marginDelta < 0
            ? 'border-rose-200 bg-rose-50/30'
            : 'border-slate-200 bg-slate-50/30',
        )}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            {calc.marginDelta >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-rose-600" />
            )}
            권장사항
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calc.marginDelta > 0 ? (
            <p className="text-sm text-emerald-800">
              ✓ 이 가격 변경은 <strong>이익이 {formatKRW(calc.marginDelta)} 증가</strong>합니다.
              실행 후 90일 검증으로 실제 결과를 확인하세요.
            </p>
          ) : calc.marginDelta < 0 ? (
            <p className="text-sm text-rose-800">
              ⚠ 이 가격 변경은 <strong>이익이 {formatKRW(Math.abs(calc.marginDelta))} 감소</strong>
              할 가능성이 큽니다. 시급한 사정이 없다면 재검토 권장.
            </p>
          ) : (
            <p className="text-sm text-slate-700">
              가격 변경의 이익 영향이 미미합니다. 다른 카테고리(시장 점유율·이미지)에 미칠 영향도
              검토하세요.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 시뮬레이터 활용 (PRD #4 ⑦)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>탄력성 가정</strong>이 핵심 — 인테리어 원단은 보통 -1.0 ~ -2.0
            </li>
            <li>
              <strong>4단계 워크플로우 Step 3</strong>에서 후보 가격 비교 시 이 시뮬레이터 활용
            </li>
            <li>
              <strong>수량 가정 검증</strong>: 거래처별 인터뷰·과거 매출 데이터로 보정
            </li>
            <li>
              결과는 <strong>가정 기반 추정</strong>일 뿐. 실제 실행 후 90일 검증이 핵심
            </li>
            <li>
              <strong>마진율 vs 절대 이익</strong>: 마진율은 좋아도 절대 이익이 줄면 회사 위험
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function ResultRow({
  label,
  value,
  tone = 'neutral',
  delta,
}: {
  label: string
  value: string
  tone?: 'good' | 'neutral' | 'warn'
  delta?: number | null
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-sm font-bold tabular-nums',
            tone === 'good'
              ? 'text-emerald-700'
              : tone === 'warn'
              ? 'text-rose-700'
              : 'text-slate-800',
          )}
        >
          {value}
        </span>
        {delta != null && (
          <span
            className={cn(
              'text-[10px] font-semibold',
              delta >= 0 ? 'text-emerald-600' : 'text-rose-600',
            )}
          >
            ({delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}%)
          </span>
        )}
      </div>
    </div>
  )
}
