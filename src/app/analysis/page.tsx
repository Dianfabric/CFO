'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatKRW, formatPercent } from '@/lib/formatters'
import { simulatePriceChange } from '@/lib/calculations'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'

interface ProductAnalysis {
  id: string; name: string; category: string; revenue: number; cost: number; profit: number
  margin: number; volume: number; share: number; grade: string
}

const GRADE_COLORS: Record<string, string> = { A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#ef4444' }
const GRADE_LABELS: Record<string, string> = { A: '효자상품', B: '육성상품', C: '관리상품', D: '정리검토' }
const CHANNEL_COLORS = ['#3b82f6', '#22c55e', '#f59e0b']

export default function AnalysisPage() {
  const [data, setData] = useState<{
    monthlyTrend: { month: string; label: string; sales: number; expenses: number; profit: number; count: number }[]
    productAnalysis: ProductAnalysis[]
    channelSales: { channel: string; amount: number; count: number }[]
    monthlyFixedCost: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'simulation'>('overview')

  // 시뮬레이션 상태
  const [simProduct, setSimProduct] = useState<ProductAnalysis | null>(null)
  const [priceChange, setPriceChange] = useState(0)
  const [volumeChange, setVolumeChange] = useState(0)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/analysis?months=3')
        setData(await res.json())
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    })()
  }, [])

  const simResult = simProduct ? simulatePriceChange(
    simProduct.revenue / (simProduct.volume || 1),
    simProduct.volume,
    simProduct.cost / (simProduct.volume || 1),
    data?.monthlyFixedCost || 0,
    priceChange, volumeChange
  ) : null

  const channelLabel = (ch: string) => ch === 'B2B' ? 'B2B' : ch === 'B2C_OFFLINE' ? 'B2C 오프라인' : 'B2C 온라인'

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">분석 / 시뮬레이션</h1>
          <p className="text-sm text-slate-500">매출·제품·채널 분석과 가격 시뮬레이션</p>
        </div>
        <div className="flex gap-1">
          <Button variant={tab === 'overview' ? 'default' : 'outline'} size="sm" onClick={() => setTab('overview')}>분석</Button>
          <Button variant={tab === 'simulation' ? 'default' : 'outline'} size="sm" onClick={() => setTab('simulation')}>시뮬레이션</Button>
        </div>
      </div>

      {tab === 'overview' ? (
        <>
          {/* 월별 추이 */}
          <Card>
            <CardHeader><CardTitle className="text-base">월별 매출/비용/이익 추이</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.monthlyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} />
                    <Tooltip formatter={(v: unknown) => formatKRW(v as number)} />
                    <Legend />
                    <Bar dataKey="sales" name="매출" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="비용" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="이익" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 제품별 수익성 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">제품별 수익성 (마진율)</CardTitle>
                <div className="flex gap-2 mt-1">{Object.entries(GRADE_LABELS).map(([g, l]) => (
                  <span key={g} className="flex items-center gap-1 text-xs"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: GRADE_COLORS[g] }} />{l}</span>
                ))}</div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data?.productAnalysis.map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: GRADE_COLORS[p.grade] }} />
                      <span className="text-sm flex-1 truncate">{p.name}</span>
                      <div className="w-24 bg-slate-100 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${Math.min(p.margin, 100)}%`, backgroundColor: GRADE_COLORS[p.grade] }} />
                      </div>
                      <span className="text-sm font-bold w-14 text-right">{formatPercent(p.margin)}</span>
                      <Badge variant="secondary" className="text-xs">{GRADE_LABELS[p.grade]}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 채널별 매출 */}
            <Card>
              <CardHeader><CardTitle className="text-base">채널별 매출 비중</CardTitle></CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data?.channelSales.map(cs => ({ name: channelLabel(cs.channel), value: cs.amount })) || []}
                        cx="50%" cy="50%" outerRadius={80} dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {(data?.channelSales || []).map((_, i) => <Cell key={i} fill={CHANNEL_COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: unknown) => formatKRW(v as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        /* 시뮬레이션 탭 */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">가격/판매량 시뮬레이션</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">제품을 선택하고 가격·판매량 변동에 따른 이익 변화를 시뮬레이션합니다.</p>
              <div>
                <Label>제품 선택</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={simProduct?.id || ''} onChange={e => {
                    const p = data?.productAnalysis.find(pa => pa.id === e.target.value)
                    setSimProduct(p || null); setPriceChange(0); setVolumeChange(0)
                  }}>
                  <option value="">제품을 선택하세요</option>
                  {data?.productAnalysis.map(p => <option key={p.id} value={p.id}>{p.name} (마진 {formatPercent(p.margin)})</option>)}
                </select>
              </div>
              {simProduct && (
                <>
                  <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-1">
                    <p>현재 매출: <strong>{formatKRW(simProduct.revenue)}</strong></p>
                    <p>현재 이익: <strong>{formatKRW(simProduct.profit)}</strong> (마진 {formatPercent(simProduct.margin)})</p>
                    <p>판매량: <strong>{simProduct.volume}</strong>단위</p>
                  </div>
                  <div>
                    <Label>가격 변동: <strong className={priceChange >= 0 ? 'text-green-600' : 'text-red-600'}>{priceChange > 0 ? '+' : ''}{priceChange}%</strong></Label>
                    <input type="range" min="-30" max="30" step="1" value={priceChange}
                      onChange={e => setPriceChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg cursor-pointer" />
                    <div className="flex justify-between text-xs text-slate-400"><span>-30%</span><span>0</span><span>+30%</span></div>
                  </div>
                  <div>
                    <Label>판매량 변동: <strong className={volumeChange >= 0 ? 'text-green-600' : 'text-red-600'}>{volumeChange > 0 ? '+' : ''}{volumeChange}%</strong></Label>
                    <input type="range" min="-50" max="50" step="1" value={volumeChange}
                      onChange={e => setVolumeChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg cursor-pointer" />
                    <div className="flex justify-between text-xs text-slate-400"><span>-50%</span><span>0</span><span>+50%</span></div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">시뮬레이션 결과</CardTitle></CardHeader>
            <CardContent>
              {!simProduct || !simResult ? (
                <p className="text-center text-slate-400 py-16">좌측에서 제품을 선택하세요</p>
              ) : (
                <div className="space-y-4">
                  <div className="text-center p-4 rounded-lg bg-slate-50">
                    <p className="text-sm text-slate-500">시나리오</p>
                    <p className="font-bold text-lg">{simResult.scenario}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 border rounded-lg text-center">
                      <p className="text-xs text-slate-500">예상 매출</p>
                      <p className="text-lg font-bold">{formatKRW(simResult.revenue)}</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <p className="text-xs text-slate-500">예상 이익</p>
                      <p className="text-lg font-bold">{formatKRW(simResult.profit)}</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <p className="text-xs text-slate-500">이익 변동</p>
                      <p className={`text-lg font-bold ${simResult.profitChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {simResult.profitChange >= 0 ? '+' : ''}{formatKRW(simResult.profitChange)}
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <p className="text-xs text-slate-500">이익률</p>
                      <p className="text-lg font-bold">{formatPercent(simResult.marginRate)}</p>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg text-sm ${simResult.profitChange >= 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {simResult.profitChange >= 0
                      ? `이익이 ${formatPercent(simResult.profitChangeRate)} 증가합니다. 가격 인상이 매출 감소보다 이익에 더 큰 영향을 줍니다.`
                      : `이익이 ${formatPercent(Math.abs(simResult.profitChangeRate))} 감소합니다. 이 시나리오는 수익성을 악화시킵니다.`
                    }
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
