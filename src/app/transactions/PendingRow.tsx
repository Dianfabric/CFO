'use client'

/**
 * 대사 대기 한 줄 — 미수 관리 보드 아래 (대표 지시 2026-07-13)
 *  ③ 통장 미처리: 입금됐는데 입금처리 전(IN) · 송금했는데 매입처리 전(OUT)
 *  ④ 세금계산서 미발행 업체: 매출 잡혔는데 계산서 미발행 — 업체별 합계
 * 처리(승인·분류)는 공문/자료의 대사 센터에서 — 여기는 눈으로 확인하는 곳.
 */
import { useEffect, useMemo, useState } from 'react'
import { Banknote, FileWarning, ExternalLink, Loader2 } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface BankRow { id: string; date: string; type: 'IN' | 'OUT'; amount: number; counterparty: string }
interface FlowRow { txId: string; date: string; client: string; amount: number; taxStatus: string | null }

const box: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: '2px' }

function Section({ title, sub, rows, empty }: {
  title: string; sub: string
  rows: { key: string; name: string; right: string; sub: string }[]
  empty: string
}) {
  return (
    <div>
      <p className="text-[11px] font-bold text-slate-700">{title} <span className="font-normal text-slate-400">{sub}</span></p>
      <div className="mt-1 space-y-1 max-h-[220px] overflow-y-auto">
        {rows.length === 0 ? (
          <p className="py-2 text-[11px] text-slate-300">{empty}</p>
        ) : rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 px-2 py-1 text-[11px]" style={{ backgroundColor: '#f8fafc', borderRadius: '2px' }}>
            <span className="font-bold text-slate-700 truncate" title={r.name}>{r.name}</span>
            <span className="text-slate-400 shrink-0">{r.sub}</span>
            <span className="ml-auto shrink-0 font-bold tabular-nums text-slate-700">{r.right}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PendingRow() {
  const [bank, setBank] = useState<BankRow[] | null>(null)
  const [flow, setFlow] = useState<FlowRow[] | null>(null)

  useEffect(() => {
    fetch('/api/recon/bank-inbox').then((r) => r.json())
      .then((j) => setBank(Array.isArray(j.unmatched) ? j.unmatched : [])).catch(() => setBank([]))
    fetch('/api/order-flow?days=60').then((r) => r.json())
      .then((j) => setFlow(Array.isArray(j.rows) ? j.rows : [])).catch(() => setFlow([]))
  }, [])

  const bankIn = useMemo(() => (bank ?? []).filter((b) => b.type === 'IN'), [bank])
  const bankOut = useMemo(() => (bank ?? []).filter((b) => b.type === 'OUT'), [bank])
  const unissued = useMemo(() => {
    const byClient = new Map<string, { count: number; sum: number; last: string }>()
    for (const r of flow ?? []) {
      if (r.taxStatus === 'ISSUED' || r.taxStatus === 'COMPLETED') continue
      const c = byClient.get(r.client) ?? { count: 0, sum: 0, last: '' }
      c.count++; c.sum += r.amount
      if (r.date > c.last) c.last = r.date
      byClient.set(r.client, c)
    }
    return [...byClient.entries()].sort((a, b) => b[1].sum - a[1].sum)
  }, [flow])

  const sum = (rows: BankRow[]) => rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 items-start">
      {/* ③ 통장 미처리 */}
      <div className="bg-white p-4" style={box}>
        <p className="mb-2 text-[13px] font-bold text-slate-900">
          <Banknote className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
          통장 미처리 — 돈은 움직였는데 장부 처리 전
          <a href="/documents" className="float-right text-[11px] font-normal text-slate-400 hover:text-slate-600">
            대사 센터에서 처리 <ExternalLink className="w-3 h-3 inline" />
          </a>
        </p>
        {!bank ? (
          <p className="py-4 text-center text-[12px] text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />확인 중...</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Section
              title={`입금인데 입금처리 전 ${bankIn.length}건`}
              sub={formatKRW(sum(bankIn))}
              empty="없음 — 모두 처리됨"
              rows={bankIn.slice(0, 8).map((b) => ({ key: b.id, name: b.counterparty, sub: b.date.slice(5), right: formatKRW(b.amount) }))}
            />
            <Section
              title={`송금인데 매입처리 전 ${bankOut.length}건`}
              sub={formatKRW(sum(bankOut))}
              empty="없음 — 모두 처리됨"
              rows={bankOut.slice(0, 8).map((b) => ({ key: b.id, name: b.counterparty, sub: b.date.slice(5), right: formatKRW(b.amount) }))}
            />
          </div>
        )}
      </div>

      {/* ④ 세금계산서 미발행 업체 */}
      <div className="bg-white p-4" style={box}>
        <p className="mb-2 text-[13px] font-bold text-slate-900">
          <FileWarning className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
          세금계산서 미발행 업체 — 매출은 잡혔는데 계산서 전
          <span className="float-right text-[11px] font-normal text-slate-400">최근 60일 · 업체별 합계</span>
        </p>
        {!flow ? (
          <p className="py-4 text-center text-[12px] text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />확인 중...</p>
        ) : (
          <Section
            title={`${unissued.length}개 업체`}
            sub={formatKRW(unissued.reduce((s, [, v]) => s + v.sum, 0))}
            empty="없음 — 전부 발행 확인됨"
            rows={unissued.slice(0, 12).map(([name, v]) => ({
              key: name, name, sub: `${v.count}건 · 최근 ${v.last.slice(5)}`, right: formatKRW(v.sum),
            }))}
          />
        )}
      </div>
    </div>
  )
}
