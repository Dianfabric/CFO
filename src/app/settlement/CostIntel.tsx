'use client'

/**
 * 비용 인텔리전스 — 관리회계 원장 기반 절감 분석.
 *
 * ① 고정/변동 × 재량/비재량 매트릭스 — 재량 = 줄일 수 있는 돈
 * ② 재량 지출 상위 카테고리 (절감 풀)
 * ③ 구독료 트래커 — AI·SW 구독 월 추이·증감, 해지 후보 검토
 */
import { useCallback, useEffect, useState } from 'react'
import { PiggyBank, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

const box: React.CSSProperties = { border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }

interface SubRow {
  vendor: string
  current: number
  previous: number
  delta: number
  series: number[]
}
interface IntelData {
  months: string[]
  month: string
  quad: { fixed_nondisc: number; fixed_disc: number; var_nondisc: number; var_disc: number; unclassified: number }
  total: number
  discTop: { category: string; amount: number }[]
  subs: SubRow[]
  subTotal: number
  subPrevTotal: number
  subMonths: string[]
  tableMissing?: boolean
  error?: string
}

export default function CostIntel() {
  const [month, setMonth] = useState<string | null>(null)
  const [data, setData] = useState<IntelData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (m?: string | null) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/cost-intel${m ? `?month=${m}` : ''}`)
      const j = (await r.json()) as IntelData
      setData(j)
      if (!m && j.month) setMonth(j.month)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(month) }, [month, load])

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 flex-wrap">
        <PiggyBank className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h2 className="text-base font-semibold text-slate-900">비용 인텔리전스</h2>
        <span className="text-xs text-slate-400">
          · 관리회계 파일 기반 · 재량 = 줄일 수 있는 돈 · 구독료 추적
        </span>
        {data && data.months.length > 0 && (
          <select
            className="ml-auto h-8 px-2 text-[12px] border rounded outline-none bg-white"
            value={data.month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {data.months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="bg-white p-5 text-center text-[12px] text-slate-400" style={box}>
          <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
          집계 중...
        </div>
      ) : !data || data.months.length === 0 ? (
        <div className="bg-white p-4 text-[12px] text-slate-500" style={box}>
          {data?.error ?? '데이터가 없습니다.'}{' '}
          <span className="text-slate-400">
            — 공문/자료 페이지에서 &lsquo;디안 관리 회계&rsquo; 엑셀을 업로드하면 여기에 채워집니다.
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* ① 매트릭스 4분면 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <QuadCard label="고정 × 비재량" sub="구조 비용 (임대료·급여 등)" amount={data.quad.fixed_nondisc} total={data.total} tone="slate" />
            <QuadCard label="고정 × 재량" sub="계약 재검토 대상 (렌트·구독)" amount={data.quad.fixed_disc} total={data.total} tone="amber" />
            <QuadCard label="변동 × 비재량" sub="사업 필수 (운임 등)" amount={data.quad.var_nondisc} total={data.total} tone="slate" />
            <QuadCard label="변동 × 재량" sub="즉시 절감 가능 풀" amount={data.quad.var_disc} total={data.total} tone="green" />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 items-start">
            {/* ② 재량 지출 상위 */}
            <div className="bg-white p-4" style={box}>
              <p className="mb-2 text-[12px] font-bold text-slate-800">
                재량 지출 상위 <span className="font-normal text-[11px] text-slate-400">· {data.month} · 아낄 곳 찾기</span>
              </p>
              {data.discTop.length === 0 ? (
                <p className="text-[12px] italic text-slate-400">재량 지출이 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.discTop.map((c) => {
                    const max = data.discTop[0].amount || 1
                    return (
                      <div key={c.category} className="text-[11px]">
                        <div className="flex justify-between tabular-nums">
                          <span className="font-medium text-slate-700">{c.category}</span>
                          <span className="text-slate-500">{formatKRW(c.amount)}</span>
                        </div>
                        <div className="mt-0.5 h-1.5 overflow-hidden" style={{ backgroundColor: '#f1f5f9', borderRadius: 999 }}>
                          <div className="h-full" style={{ width: `${(c.amount / max) * 100}%`, backgroundColor: '#f59e0b', borderRadius: 999 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ③ 구독료 트래커 */}
            <div className="bg-white p-4" style={box}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-bold text-slate-800">
                  구독료 트래커{' '}
                  <span className="font-normal text-[11px] text-slate-400">· AI·SW 구독 다이어트</span>
                </p>
                <span className="text-[12px] font-bold tabular-nums text-slate-900">
                  {formatKRW(data.subTotal)}/월
                  {data.subPrevTotal > 0 && (
                    <span
                      className="ml-1 text-[10px] font-normal"
                      style={{ color: data.subTotal > data.subPrevTotal ? '#dc2626' : '#4a7c00' }}
                    >
                      ({data.subTotal >= data.subPrevTotal ? '+' : ''}{formatKRW(data.subTotal - data.subPrevTotal)})
                    </span>
                  )}
                </span>
              </div>
              {data.subs.length === 0 ? (
                <p className="text-[12px] italic text-slate-400">구독 항목이 없습니다.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {data.subs.map((s) => (
                    <div key={s.vendor} className="flex items-center gap-2 text-[11px]">
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-700" title={s.vendor}>
                        {s.vendor}
                      </span>
                      {/* 6개월 미니 바 */}
                      <span className="flex items-end gap-[2px] shrink-0" style={{ height: 16 }}>
                        {s.series.map((v, i) => {
                          const max = Math.max(...s.series, 1)
                          return (
                            <span
                              key={i}
                              style={{
                                width: 4,
                                height: Math.max(v > 0 ? 3 : 1, (v / max) * 16),
                                backgroundColor: i === s.series.length - 1 ? 'var(--nv-primary, #76b900)' : '#cbd5e1',
                                borderRadius: 1,
                                display: 'inline-block',
                              }}
                            />
                          )
                        })}
                      </span>
                      <span className="w-20 shrink-0 text-right tabular-nums font-bold text-slate-900">
                        {s.current > 0 ? formatKRW(s.current) : '중단?'}
                      </span>
                      <span className="w-5 shrink-0 text-right" title={`전월 대비 ${formatKRW(s.delta)}`}>
                        {s.delta > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 inline" style={{ color: '#dc2626' }} />
                        ) : s.delta < 0 ? (
                          <TrendingDown className="w-3.5 h-3.5 inline" style={{ color: '#4a7c00' }} />
                        ) : (
                          <Minus className="w-3.5 h-3.5 inline text-slate-300" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[10px] text-slate-400">
                빨간 ↑ = 전월보다 증가 · &lsquo;중단?&rsquo; = 이번 달 결제 없음 (해지됐거나 결제일 미도래)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function QuadCard({
  label, sub, amount, total, tone,
}: {
  label: string
  sub: string
  amount: number
  total: number
  tone: 'slate' | 'amber' | 'green'
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  const color = tone === 'green' ? 'var(--nv-success-deep, #4a7c00)' : tone === 'amber' ? '#b45309' : '#334155'
  return (
    <div className="bg-white p-4" style={box}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-[20px] font-bold tabular-nums leading-none" style={{ color }}>
        {formatKRW(amount)}
      </p>
      <p className="mt-1 text-[10px] text-slate-400">
        {sub} · {pct.toFixed(0)}%
      </p>
    </div>
  )
}
