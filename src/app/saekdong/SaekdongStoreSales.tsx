'use client'

/**
 * 색동 매장 직접 판매 입력 (대표 지시 2026-07-28)
 * 매장에서 바로 결제된 현금/카드 매출을 그 자리에서 기록 — 월별 현금·카드 합계로 확인.
 * (손익 합산과는 별도의 매장 판매 추적 카드 — 일계표와 이중계상 없음)
 */
import { useCallback, useEffect, useState } from 'react'
import { Store, Loader2, X } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface Row { id: number; sale_date: string; method: 'cash' | 'card'; amount: number; memo: string | null }
interface Monthly { month: string; cash: number; card: number; total: number }

export default function SaekdongStoreSales() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [monthly, setMonthly] = useState<Monthly[]>([])
  const [date, setDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [method, setMethod] = useState<'cash' | 'card'>('card')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/saekdong/store-sales?months=3')
      const j = await r.json()
      if (j.tableMissing) setError('테이블 미생성 — 마이그레이션 필요')
      setRows(Array.isArray(j.rows) ? j.rows : [])
      setMonthly(Array.isArray(j.monthly) ? j.monthly : [])
    } catch {
      setError('조회 실패')
      setRows([])
    }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    const amt = Number(amount.replace(/,/g, ''))
    if (!amt) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/saekdong/store-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_date: date, method, amount: amt, memo }),
      })
      const j = await r.json()
      if (j.ok) {
        setAmount('')
        setMemo('')
        load()
      } else setError(j.error ?? '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  const del = async (id: number) => {
    setRows((prev) => (prev ?? []).filter((r) => r.id !== id))
    await fetch('/api/saekdong/store-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    load()
  }

  const thisMonth = monthly.find((m) => m.month === date.slice(0, 7)) ?? monthly[0]

  return (
    <div className="bg-white p-4 sm:p-5" style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}>
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <Store className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h3 className="text-[14px] font-bold" style={{ color: 'var(--nv-ink, #0f172a)' }}>매장 직접 판매 — 현금·카드</h3>
        <span className="text-[11px]" style={{ color: 'var(--nv-stone, #94a3b8)' }}>매장에서 바로 결제된 매출을 그 자리에서 기록</span>
      </div>

      {/* 입력 줄 */}
      <div className="flex items-center gap-1.5 flex-wrap text-[12px] mb-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 px-2 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
        {(['card', 'cash'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMethod(m)} className="h-8 px-3 font-bold"
            style={{
              borderRadius: '2px', border: '1px solid',
              borderColor: method === m ? 'var(--nv-primary, #76b900)' : '#e2e8f0',
              backgroundColor: method === m ? 'rgba(118,185,0,0.12)' : '#fff',
              color: method === m ? 'var(--nv-success-deep, #4a7c00)' : '#64748b',
            }}>
            {m === 'card' ? '카드' : '현금'}
          </button>
        ))}
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="금액(원)" inputMode="numeric"
          className="h-8 w-28 px-2 text-right bg-white tabular-nums" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모(선택 — 품목 등)"
          className="h-8 flex-1 min-w-[120px] px-2 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
        <button type="button" onClick={save} disabled={busy || !Number(amount.replace(/,/g, ''))}
          className="h-8 px-3 font-bold" style={{ backgroundColor: 'var(--nv-primary, #76b900)', color: '#000', borderRadius: '2px' }}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : '기록'}
        </button>
      </div>

      {error && <p className="mb-2 text-[11px]" style={{ color: '#dc2626' }}>⚠ {error}</p>}

      {!rows ? (
        <p className="py-4 text-center text-[12px] text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />불러오는 중...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* 월별 합계 */}
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">월별 합계</p>
            {monthly.length === 0 ? (
              <p className="text-[12px] text-slate-300">아직 입력 없음 — 첫 판매를 기록해보세요</p>
            ) : (
              <div className="space-y-1">
                {monthly.slice(0, 3).map((m) => (
                  <div key={m.month} className="flex items-center gap-2 px-2 py-1.5 text-[12px]" style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}>
                    <span className="font-bold text-slate-700">{m.month}</span>
                    <span className="text-slate-500">카드 {formatKRW(m.card)}</span>
                    <span className="text-slate-500">현금 {formatKRW(m.cash)}</span>
                    <span className="ml-auto font-bold tabular-nums" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>{formatKRW(m.total)}</span>
                  </div>
                ))}
              </div>
            )}
            {thisMonth && (
              <p className="mt-1 text-[10px] text-slate-400">이번 달 매장 판매 {formatKRW(thisMonth.total)} (카드 {Math.round((thisMonth.card / Math.max(1, thisMonth.total)) * 100)}%)</p>
            )}
          </div>
          {/* 최근 입력 */}
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">최근 입력</p>
            <div className="space-y-1 max-h-[180px] overflow-y-auto">
              {rows.length === 0 ? (
                <p className="text-[12px] text-slate-300">없음</p>
              ) : (
                rows.slice(0, 20).map((r) => (
                  <div key={r.id} className="group flex items-center gap-2 px-2 py-1 text-[12px]" style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}>
                    <span className="tabular-nums text-slate-400">{r.sale_date.slice(5)}</span>
                    <span className="px-1 py-0.5 text-[9px] font-bold" style={{ backgroundColor: r.method === 'card' ? '#eff6ff' : '#f0fdf4', color: r.method === 'card' ? '#1d4ed8' : '#15803d', borderRadius: '2px' }}>
                      {r.method === 'card' ? '카드' : '현금'}
                    </span>
                    {r.memo && <span className="truncate text-slate-500">{r.memo}</span>}
                    <span className="ml-auto font-bold tabular-nums text-slate-700">{formatKRW(r.amount)}</span>
                    <button type="button" onClick={() => del(r.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
