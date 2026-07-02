'use client'

/**
 * 본체 스와치·샘플 재고 (V1 대략) — 입고/발송 기록, 남은 재고 자동 계산.
 * 추후 샘플 추적(#2c 반환·분실·재구매 전환)과 통합 예정.
 */
import { useEffect, useMemo, useState } from 'react'
import { Boxes, Plus, Trash2, Loader2 } from 'lucide-react'
import { listSampleMoves, addSampleMove, deleteSampleMove } from './actions'
import type { SampleMove } from './actions'

const box: React.CSSProperties = { border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }
const inputCls = 'h-8 px-2 text-[12px] bg-white outline-none'
const inputStyle: React.CSSProperties = { border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }

function todayYmd(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}
function norm(s: string): string {
  return String(s || '').toLowerCase().replace(/\s+/g, '')
}

export default function SampleStock() {
  const [moves, setMoves] = useState<SampleMove[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [showLog, setShowLog] = useState(false)

  useEffect(() => {
    listSampleMoves()
      .then((res) => {
        setMoves(res.moves)
        setTableMissing(!!res.tableMissing)
      })
      .finally(() => setLoading(false))
  }, [])
  const [f, setF] = useState({
    direction: 'out' as 'in' | 'out',
    item: '',
    qty: '1',
    date: todayYmd(),
    counterparty: '',
  })

  // 품목별 재고 (입고 − 발송)
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; inQ: number; outQ: number }>()
    for (const mv of moves) {
      const k = norm(mv.item_name)
      const cur = map.get(k) ?? { name: mv.item_name, inQ: 0, outQ: 0 }
      if (mv.direction === 'in') cur.inQ += Number(mv.qty) || 0
      else cur.outQ += Number(mv.qty) || 0
      map.set(k, cur)
    }
    return [...map.values()]
      .map((v) => ({ ...v, remaining: v.inQ - v.outQ }))
      .sort((a, b) => b.inQ - a.inQ)
  }, [moves])

  const itemNames = useMemo(() => [...new Set(moves.map((m) => m.item_name))], [moves])

  const add = async () => {
    const qty = Number(f.qty) || 0
    if (!f.item.trim() || qty <= 0) {
      setError('품목명과 수량을 입력하세요.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await addSampleMove({
      move_date: f.date,
      direction: f.direction,
      item_name: f.item,
      qty,
      counterparty: f.counterparty || null,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error ?? '저장 실패'); return }
    setMoves((prev) => [
      {
        id: res.id ?? Date.now(), move_date: f.date, direction: f.direction,
        item_name: f.item.trim(), qty, counterparty: f.counterparty.trim() || null, memo: null,
      },
      ...prev,
    ])
    setF({ ...f, qty: '1', counterparty: '' })
  }

  const remove = async (id: number) => {
    if (!confirm('이 기록을 삭제할까요?')) return
    setBusyId(id)
    const res = await deleteSampleMove(id)
    setBusyId(null)
    if (!res.ok) { setError(res.error ?? '삭제 실패'); return }
    setMoves((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div className="bg-white p-4 h-full" style={box}>
      <p className="text-[12px] font-bold text-slate-800">
        <Boxes className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
        본체 스와치·샘플 재고{' '}
        <span className="font-normal text-[11px] text-slate-400">· V1 — 입고/발송 기록 기반</span>
      </p>

      {loading ? (
        <p className="mt-2 text-[12px] text-slate-400 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />
          불러오는 중...
        </p>
      ) : tableMissing ? (
        <p className="mt-2 text-xs text-rose-600 bg-rose-50 rounded p-2.5">
          재고 테이블이 없습니다 — <code>supabase/migrations/2026-07-02_dian_sample_stock.sql</code>{' '}
          을 실행해 주세요.
        </p>
      ) : (
        <>
          {error && <p className="mt-2 text-xs text-rose-600 bg-rose-50 rounded p-2">⚠ {error}</p>}

          {/* 입력 */}
          <div className="mt-2.5 mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden" style={{ ...inputStyle }}>
              {(
                [
                  { v: 'in', label: '입고' },
                  { v: 'out', label: '발송' },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setF({ ...f, direction: o.v })}
                  className="h-8 px-3 text-[12px] font-bold transition-colors"
                  style={{
                    backgroundColor: f.direction === o.v ? 'var(--nv-primary, #76b900)' : 'white',
                    color: f.direction === o.v ? '#000' : '#64748b',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <input
              placeholder="품목 (스와치북 2026SS, 행거샘플…)"
              className={inputCls + ' w-52'}
              style={inputStyle}
              list="dian-sample-items"
              value={f.item}
              onChange={(e) => setF({ ...f, item: e.target.value })}
            />
            <datalist id="dian-sample-items">
              {itemNames.map((n) => <option key={n} value={n} />)}
            </datalist>
            <input
              type="number"
              placeholder="수량"
              className={inputCls + ' w-16'}
              style={inputStyle}
              value={f.qty}
              onChange={(e) => setF({ ...f, qty: e.target.value })}
            />
            <input
              type="date"
              className={inputCls + ' w-34'}
              style={inputStyle}
              value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })}
            />
            <input
              placeholder={f.direction === 'out' ? '발송처 (디자이너·업체)' : '입고처 (선택)'}
              className={inputCls + ' flex-1 min-w-28'}
              style={inputStyle}
              value={f.counterparty}
              onChange={(e) => setF({ ...f, counterparty: e.target.value })}
            />
            <button
              type="button"
              onClick={add}
              disabled={saving}
              className="h-8 px-3 text-[12px] font-bold inline-flex items-center gap-1 shrink-0"
              style={{ backgroundColor: 'var(--nv-primary, #76b900)', color: '#000', borderRadius: '2px' }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              기록
            </button>
          </div>

          {/* 재고 표 */}
          {rows.length === 0 ? (
            <p className="text-[12px] italic text-slate-400">
              입고/발송을 기록하면 품목별 재고가 표시됩니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]" style={{ minWidth: 380 }}>
                <thead>
                  <tr className="text-left text-slate-400" style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th className="py-1.5 pr-2 font-medium">품목</th>
                    <th className="pr-2 font-medium text-right">입고</th>
                    <th className="pr-2 font-medium text-right">발송</th>
                    <th className="font-medium text-right">남은 재고</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td className="py-1.5 pr-2 font-medium text-slate-800">{r.name}</td>
                      <td className="pr-2 text-right tabular-nums">{r.inQ}</td>
                      <td className="pr-2 text-right tabular-nums text-slate-400">{r.outQ}</td>
                      <td
                        className="text-right tabular-nums font-bold"
                        style={{ color: r.remaining < 0 ? '#dc2626' : r.remaining <= 5 ? '#c2410c' : undefined }}
                      >
                        {r.remaining}
                        {r.remaining < 0 && ' ⚠'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 기록 로그 (접이식) */}
          {moves.length > 0 && (
            <div className="mt-3 pt-2" style={{ borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setShowLog(!showLog)}
                className="text-[11px] font-bold text-slate-400"
              >
                {showLog ? '▾' : '▸'} 입고·발송 기록 {moves.length}건
              </button>
              {showLog && (
                <div className="mt-1.5 space-y-1 max-h-48 overflow-y-auto">
                  {moves.map((mv) => (
                    <div key={mv.id} className="flex items-center gap-2 text-[12px]">
                      <span className="w-14 shrink-0 tabular-nums text-slate-400">
                        {mv.move_date.slice(2)}
                      </span>
                      <span
                        className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          backgroundColor: mv.direction === 'in' ? 'rgba(118,185,0,0.12)' : '#fff7ed',
                          color: mv.direction === 'in' ? '#4a7c00' : '#c2410c',
                          borderRadius: '2px',
                        }}
                      >
                        {mv.direction === 'in' ? '입고' : '발송'}
                      </span>
                      <span className="font-medium text-slate-800">{mv.item_name}</span>
                      <span className="tabular-nums text-slate-500">{mv.qty}</span>
                      <span className="flex-1 truncate text-slate-400">{mv.counterparty ?? ''}</span>
                      <button
                        type="button"
                        onClick={() => remove(mv.id)}
                        disabled={busyId === mv.id}
                        className="p-1 shrink-0 text-slate-300 hover:text-slate-500"
                        title="삭제"
                      >
                        {busyId === mv.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
