'use client'

/**
 * 거래 처리 칸반 — 거래가 쌓여도 "할 일만" 보이게 (대표 지시 2026-07-13)
 *
 * 매출 거래의 생애주기: 등록 → 세금계산서 발행 → 입금 → 완결.
 * 열 이동은 드래그가 아니라 자동 — 계산서가 매칭되면, 입금이 대사되면 알아서 옮겨진다.
 *   ① 신규(7일 이내)     : 등록됐고 계산서 미발행
 *   ② 계산서 미발행       : 7일 지났는데 아직 미발행 — 발행 챙길 것
 *   ③ 입금 대기(미수)     : 발행됐고 입금 전 — 수금 챙길 것
 *   ④ 완결               : 계산서 + 입금 완료 — 자동으로 빠져나감 (최근 것만 표시)
 * 데이터: /api/order-flow (일계표 매출 + 계산서·입금·미수 상태 통합)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, KanbanSquare } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface FlowRow {
  txId: string
  date: string
  client: string
  itemsSummary: string
  amount: number
  person: string | null
  paymentStatus: string
  taxStatus: string | null
  arRemaining: number
}

type LaneKey = 'fresh' | 'noInvoice' | 'unpaid' | 'done'

const LANES: { key: LaneKey; title: string; hint: string; color: string; bg: string }[] = [
  { key: 'fresh', title: '신규 (7일 이내)', hint: '등록됨 · 계산서 발행 전', color: '#1d4ed8', bg: '#eff6ff' },
  { key: 'noInvoice', title: '계산서 미발행', hint: '7일 경과 — 발행 챙기기', color: '#c2410c', bg: '#fff7ed' },
  { key: 'unpaid', title: '입금 대기 (미수)', hint: '발행됨 — 수금 챙기기', color: '#b91c1c', bg: '#fef2f2' },
  { key: 'done', title: '완결', hint: '계산서 + 입금 완료 · 자동 제외', color: '#15803d', bg: '#f0fdf4' },
]

function laneOf(r: FlowRow, freshCut: string): LaneKey {
  const issued = r.taxStatus === 'ISSUED' || r.taxStatus === 'COMPLETED'
  if (!issued) return r.date >= freshCut ? 'fresh' : 'noInvoice'
  if (r.arRemaining > 0 || r.paymentStatus !== 'PAID') return 'unpaid'
  return 'done'
}

export default function TransactionsKanban() {
  const [rows, setRows] = useState<FlowRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(60)

  const load = useCallback(async (d: number) => {
    setRows(null)
    setError(null)
    try {
      const r = await fetch(`/api/order-flow?days=${d}`)
      const j = await r.json()
      if (j.error) setError(j.error)
      setRows(Array.isArray(j.rows) ? j.rows : [])
    } catch {
      setError('조회 실패')
    }
  }, [])

  useEffect(() => { load(days) }, [load, days])

  const lanes = useMemo(() => {
    if (!rows) return null
    const cut = new Date()
    cut.setDate(cut.getDate() - 7)
    const freshCut = cut.toLocaleDateString('sv-SE')
    const out: Record<LaneKey, FlowRow[]> = { fresh: [], noInvoice: [], unpaid: [], done: [] }
    for (const r of rows) out[laneOf(r, freshCut)].push(r)
    // 신규는 최신순 · 미발행/미수는 오래된 것부터(급한 순) · 완결은 최신 20건만
    out.fresh.sort((a, b) => b.date.localeCompare(a.date))
    out.noInvoice.sort((a, b) => a.date.localeCompare(b.date))
    out.unpaid.sort((a, b) => a.date.localeCompare(b.date))
    out.done.sort((a, b) => b.date.localeCompare(a.date))
    return out
  }, [rows])

  const doneTotal = lanes?.done.length ?? 0

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <KanbanSquare className="w-4 h-4 text-slate-400" />
        <span className="text-[12px] text-slate-500">
          매출 거래의 처리 단계 — 계산서·입금이 확인되면 카드가 자동으로 이동합니다. 남은 카드 수 = 오늘 챙길 일.
        </span>
        <div className="ml-auto flex items-center gap-1">
          {[30, 60, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className="h-6 px-2 text-[10px] font-bold"
              style={{
                borderRadius: '2px', border: '1px solid',
                borderColor: days === d ? 'var(--nv-primary, #76b900)' : '#e2e8f0',
                backgroundColor: days === d ? 'rgba(118,185,0,0.12)' : '#fff',
                color: days === d ? 'var(--nv-success-deep, #4a7c00)' : '#64748b',
              }}
            >
              {d}일
            </button>
          ))}
          <button
            type="button"
            onClick={() => load(days)}
            className="h-6 px-2 text-[10px] font-bold bg-white"
            style={{ border: '1px solid #e2e8f0', borderRadius: '2px', color: '#64748b' }}
          >
            <RefreshCw className="w-3 h-3 inline" />
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-2 px-3 py-2 text-[12px]" style={{ border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '2px' }}>
          ⚠ {error}
        </p>
      )}

      {!lanes ? (
        <p className="py-12 text-center text-[12px] text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
          거래 상태 계산 중...
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 items-start">
          {LANES.map((lane) => {
            const items = lane.key === 'done' ? lanes.done.slice(0, 20) : lanes[lane.key]
            const sum = lanes[lane.key].reduce((s, r) => s + r.amount, 0)
            return (
              <div key={lane.key} className="bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
                <div className="px-3 py-2" style={{ backgroundColor: lane.bg, borderBottom: '1px solid #e2e8f0' }}>
                  <p className="text-[12px] font-bold" style={{ color: lane.color }}>
                    {lane.title}
                    <span className="ml-1.5 tabular-nums">{lanes[lane.key].length}건</span>
                    <span className="ml-1.5 font-normal text-[11px] opacity-80">{formatKRW(sum)}</span>
                  </p>
                  <p className="text-[10px] text-slate-400">{lane.hint}</p>
                </div>
                <div className="p-2 space-y-1.5 max-h-[520px] overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-slate-300">없음</p>
                  ) : (
                    items.map((r) => (
                      <div
                        key={r.txId}
                        className="p-2"
                        style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}
                      >
                        <div className="flex items-center gap-2 text-[12px]">
                          <span className="font-bold text-slate-800 truncate" title={r.client}>{r.client}</span>
                          <span className="ml-auto shrink-0 font-bold tabular-nums text-slate-700">
                            {formatKRW(r.amount)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="tabular-nums">{r.date.slice(5)}</span>
                          {r.person && <span>· {r.person}</span>}
                          {r.itemsSummary && <span className="truncate">· {r.itemsSummary}</span>}
                        </div>
                        {lane.key !== 'done' && r.arRemaining > 0 && (
                          <span
                            className="mt-1 inline-block px-1 py-0.5 text-[9px] font-bold"
                            style={{ backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '2px' }}
                          >
                            미수 {formatKRW(r.arRemaining)}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                  {lane.key === 'done' && doneTotal > 20 && (
                    <p className="pt-1 text-center text-[10px] text-slate-400">
                      외 {doneTotal - 20}건 — 목록 뷰에서 조회
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
