'use client'

/**
 * 출고·마감 인사이트 — 마감(출고) 데이터의 영업·마케팅 활용.
 *
 * ① 직군/제품/가공·기능/재료별 매출 — 무엇이 팔리고 안 팔리는지
 * ② 메타 미표기 — 담당자별, 표기 완료까지 계속 표시
 * ③ 출고 완료 + 미수금 — 미수금 0% 도전
 * (출고 알림 메시지·송장·수령 사인은 거래 관리 페이지 연동 예정)
 */
import { useCallback, useEffect, useState } from 'react'
import { Truck, Loader2, AlertTriangle, Tags } from 'lucide-react'
import Link from 'next/link'
import { formatKRW } from '@/lib/formatters'

const box: React.CSSProperties = { border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }

interface AggRow { name: string; amount: number; count: number }
interface Insights {
  days: number
  byIndustry: AggRow[]
  byProduct: AggRow[]
  byProcess: AggRow[]
  byMaterial: AggRow[]
  untagged: {
    total: number
    byPerson: { person: string; count: number; amount: number }[]
    samples: { date: string; client: string; product: string; person: string; amount: number }[]
  }
  shippedUnpaid: {
    count: number
    sum: number
    top: { id: string; date: string; client: string; person: string; remaining: number }[]
  }
  error?: string
}

const DAY_OPTIONS = [30, 90, 180] as const

export default function MagamInsights() {
  const [days, setDays] = useState<number>(90)
  const [data, setData] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (d: number) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/magam-insights?days=${d}`)
      setData(await r.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(days) }, [days, load])

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 flex-wrap">
        <Truck className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h2 className="text-base font-semibold text-slate-900">출고·마감 인사이트</h2>
        <span className="text-xs text-slate-400">
          · 직군·제품·가공·재료 = 영업·마케팅 자료 · 출고 알림/수령 사인은 거래 관리 연동 예정
        </span>
        <div className="ml-auto inline-flex overflow-hidden rounded-sm border border-slate-200">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className="h-8 px-3 text-[12px] font-bold transition-colors"
              style={{
                backgroundColor: days === d ? 'var(--nv-primary, #76b900)' : 'white',
                color: days === d ? '#000' : '#64748b',
              }}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-5 text-center text-[12px] text-slate-400" style={box}>
          <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
          집계 중...
        </div>
      ) : !data || data.error ? (
        <div className="bg-white p-4 text-[12px] text-rose-600" style={box}>
          ⚠ 조회 실패{data?.error ? `: ${data.error}` : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {/* 미표기 배너 — 표기 완료까지 계속 표시 */}
          {data.untagged.total > 0 && (
            <div className="px-3 py-2.5" style={{ ...box, backgroundColor: '#fff7ed' }}>
              <p className="text-[12px] font-bold" style={{ color: '#c2410c' }}>
                <Tags className="w-3.5 h-3.5 inline mr-1" />
                메타 미표기 {data.untagged.total}건 — 담당자별 표기 필요 (완료까지 계속 표시됩니다)
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {data.untagged.byPerson.map((p) => (
                  <span
                    key={p.person}
                    className="px-2 py-0.5 text-[11px] font-bold bg-white"
                    style={{ ...box, color: '#c2410c' }}
                    title={`미표기 금액 ${formatKRW(p.amount)}`}
                  >
                    {p.person} · {p.count}건
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[10px]" style={{ color: '#9a3412' }}>
                디안 마감 엑셀의 직군·제품·가공·기능·재료 칸을 채워 다시 업로드하면 반영됩니다.
              </p>
            </div>
          )}

          {/* 4분류 집계 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AggCard title="직군별" rows={data.byIndustry} />
            <AggCard title="제품별" rows={data.byProduct} />
            <AggCard title="가공·기능별" rows={data.byProcess} />
            <AggCard title="재료별" rows={data.byMaterial} />
          </div>

          {/* 출고 완료 + 미수 — 미수금 0% 도전 */}
          <div className="bg-white p-4" style={box}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[12px] font-bold text-slate-800">
                {data.shippedUnpaid.count > 0 && (
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
                )}
                출고 완료 + 미수금{' '}
                <span className="font-normal text-[11px] text-slate-400">
                  · {data.shippedUnpaid.count}건 · 미수금 0% 도전
                </span>
              </p>
              {data.shippedUnpaid.count > 0 && (
                <span className="text-[12px] font-bold tabular-nums" style={{ color: '#c2410c' }}>
                  {formatKRW(data.shippedUnpaid.sum)}
                </span>
              )}
            </div>
            {data.shippedUnpaid.count === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>
                출고 완료 거래 중 미수금이 없습니다 — 0% 달성 🎉
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  {data.shippedUnpaid.top.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-[12px]">
                      <span className="w-14 shrink-0 tabular-nums text-slate-400">{t.date.slice(5)}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-700">{t.client}</span>
                      <span
                        className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: '2px' }}
                      >
                        {t.person}
                      </span>
                      <span className="shrink-0 tabular-nums font-bold" style={{ color: '#c2410c' }}>
                        {formatKRW(t.remaining)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  잔액 큰 순 상위 {data.shippedUnpaid.top.length}건 · 전체는{' '}
                  <Link href="/receivables" className="underline">미수금 관리</Link>에서
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AggCard({ title, rows }: { title: string; rows: AggRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.amount))
  const tagged = rows.filter((r) => r.name !== '미표기')
  const untagged = rows.find((r) => r.name === '미표기')
  return (
    <div className="bg-white p-4" style={box}>
      <p className="mb-2 text-[12px] font-bold text-slate-800">{title}</p>
      {tagged.length === 0 ? (
        <p className="text-[11px] italic text-slate-400">표기된 데이터가 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {tagged.slice(0, 5).map((r) => (
            <div key={r.name} className="text-[11px]">
              <div className="flex justify-between tabular-nums">
                <span className="font-medium text-slate-700 truncate mr-2">{r.name}</span>
                <span className="shrink-0 text-slate-500">{formatKRW(r.amount)}</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden" style={{ backgroundColor: '#f1f5f9', borderRadius: 999 }}>
                <div
                  className="h-full"
                  style={{ width: `${(r.amount / max) * 100}%`, backgroundColor: 'var(--nv-primary, #76b900)', borderRadius: 999 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {untagged && untagged.amount > 0 && (
        <p className="mt-2 text-[10px]" style={{ color: '#c2410c' }}>
          미표기 {formatKRW(untagged.amount)} ({untagged.count}건)
        </p>
      )}
    </div>
  )
}
