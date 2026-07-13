'use client'

/**
 * 통장 미처리 인박스 — 매일 0건으로 만들면 통장 대사 완료.
 *
 * 자동(정확)·퍼지(대사 센터) 매칭 후에도 남은 입출금:
 *  - 입금: 거래처 검색해 수동 연결 (미수금 차감) 또는 분류
 *  - 분류 토글: 개인송금(한태원)·카드대금·급여·세금 등 이유 기록
 * 분류된 건은 '최근 분류'에서 되돌리기 가능.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Landmark, Loader2, Search, Undo2, ChevronDown, ChevronUp, Link2,
} from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

const box: React.CSSProperties = { border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }

// 관리회계 엑셀 분류 준용 — 통장 미처리 사유
const CATEGORIES = [
  '개인송금', '카드대금', '급여', '4대보험', '세금·공과', '임대료·관리비',
  '운임·물류', 'PG정산', '이자·원리금', '내부이체', '경비', '기타',
]

interface BankRow {
  id: string
  date: string
  type: 'IN' | 'OUT'
  amount: number
  counterparty: string
  description: string
  category: string | null
}

interface ClientHit {
  id: string
  name: string
  remaining: number
}

export default function BankInbox() {
  const [unmatched, setUnmatched] = useState<BankRow[]>([])
  const [classified, setClassified] = useState<BankRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showClassified, setShowClassified] = useState(false)
  // 거래처 연결 확장 행
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<ClientHit[]>([])
  const [searching, setSearching] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/recon/bank-inbox')
      const j = await r.json()
      setUnmatched(Array.isArray(j.unmatched) ? j.unmatched : [])
      setClassified(Array.isArray(j.classified) ? j.classified : [])
      if (j.error) setError(j.error)
    } catch {
      setError('인박스 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const classify = async (row: BankRow, category: string) => {
    if (!category) return
    setBusyId(row.id)
    setError(null)
    try {
      const r = await fetch('/api/recon/bank-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId: row.id, category }),
      })
      const j = await r.json()
      if (!j.ok) setError(j.error ?? '분류 실패')
      else {
        setUnmatched((prev) => prev.filter((x) => x.id !== row.id))
        setClassified((prev) => [{ ...row, category }, ...prev].slice(0, 20))
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setBusyId(null)
    }
  }

  const undo = async (row: BankRow) => {
    setBusyId(row.id)
    try {
      const r = await fetch('/api/recon/bank-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId: row.id, undo: true }),
      })
      const j = await r.json()
      if (j.ok) {
        setClassified((prev) => prev.filter((x) => x.id !== row.id))
        setUnmatched((prev) => [{ ...row, category: null }, ...prev])
      }
    } finally {
      setBusyId(null)
    }
  }

  const search = async (text: string) => {
    setQ(text)
    if (text.trim().length < 1) { setHits([]); return }
    setSearching(true)
    try {
      const r = await fetch(`/api/recon/clients?q=${encodeURIComponent(text.trim())}`)
      const j = await r.json()
      setHits(Array.isArray(j.clients) ? j.clients : [])
    } finally {
      setSearching(false)
    }
  }

  const linkClient = async (row: BankRow, client: ClientHit) => {
    if (!confirm(`${row.counterparty} 입금 ${formatKRW(row.amount)} 을(를) '${client.name}' 입금으로 처리할까요?\n(미수금에서 차감됩니다)`)) return
    setBusyId(row.id)
    setError(null)
    try {
      const r = await fetch('/api/recon/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm', kind: 'deposit',
          key: `manual:${row.id}:${client.id}`,
          leftId: row.id, rightId: client.id,
        }),
      })
      const j = await r.json()
      if (!j.ok) setError(j.error ?? '연결 실패')
      else {
        setUnmatched((prev) => prev.filter((x) => x.id !== row.id))
        setLinkingId(null)
        setQ('')
        setHits([])
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="bg-white p-4" style={box}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Landmark className="w-4 h-4 text-slate-400" />
        <p className="text-[12px] font-bold text-slate-800">통장 미처리 인박스</p>
        {!loading && (
          <span
            className="px-1.5 py-0.5 text-[10px] font-bold"
            style={{
              backgroundColor: unmatched.length > 0 ? '#fff7ed' : 'rgba(118,185,0,0.12)',
              color: unmatched.length > 0 ? '#c2410c' : 'var(--nv-success-deep, #4a7c00)',
              borderRadius: '2px',
            }}
          >
            {unmatched.length > 0 ? `${unmatched.length}건 남음` : '오늘 대사 완료 🎉'}
          </span>
        )}
      </div>
      <p className="mb-3 text-[11px] text-slate-400">
        자동·유사 매칭 후에도 남은 입출금입니다. 입금은 거래처 연결, 그 외는 사유
        분류(개인송금·카드대금 등)를 선택하면 인박스에서 사라집니다 — 매일 0건이 목표.
      </p>

      {error && (
        <p className="mb-2 px-3 py-2 text-[12px]" style={{ ...box, borderColor: '#fca5a5', backgroundColor: '#fef2f2', color: '#dc2626' }}>
          ⚠ {error}
        </p>
      )}

      {loading ? (
        <p className="text-[12px] text-slate-400 py-3 text-center">
          <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
          불러오는 중...
        </p>
      ) : unmatched.length === 0 ? (
        <p className="text-[12px] py-1" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>
          미처리 입출금이 없습니다.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
          {unmatched.map((row) => (
            <div key={row.id} style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}>
              <div className="flex items-center gap-2 p-2.5 text-[12px]">
                <span className="w-12 shrink-0 tabular-nums text-slate-400">{row.date.slice(5)}</span>
                <span
                  className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: row.type === 'IN' ? 'rgba(118,185,0,0.12)' : '#fff7ed',
                    color: row.type === 'IN' ? 'var(--nv-success-deep, #4a7c00)' : '#c2410c',
                    borderRadius: '2px',
                  }}
                >
                  {row.type === 'IN' ? '입금' : '출금'}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={row.description}>
                  {row.counterparty}
                </span>
                <span className="shrink-0 tabular-nums font-bold text-slate-900">
                  {formatKRW(row.amount)}
                </span>
                {/* 분류 토글 */}
                <select
                  className="shrink-0 h-7 px-1.5 text-[11px] bg-white outline-none"
                  style={box}
                  value=""
                  disabled={busyId === row.id}
                  onChange={(e) => classify(row, e.target.value)}
                  title="사유 분류 — 선택하면 처리됩니다"
                >
                  <option value="">분류 ▾</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {row.type === 'IN' && (
                  <button
                    type="button"
                    onClick={() => { setLinkingId(linkingId === row.id ? null : row.id); setQ(''); setHits([]) }}
                    disabled={busyId === row.id}
                    className="shrink-0 h-7 px-2 inline-flex items-center gap-1 text-[11px] font-bold bg-white"
                    style={{ ...box, color: 'var(--nv-success-deep, #4a7c00)' }}
                    title="거래처 입금으로 수동 연결"
                  >
                    {busyId === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                    거래처 연결
                  </button>
                )}
              </div>
              {/* 거래처 검색 확장 */}
              {linkingId === row.id && (
                <div className="px-2.5 pb-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      autoFocus
                      placeholder="거래처명 검색..."
                      className="h-7 px-2 text-[12px] bg-white outline-none flex-1"
                      style={box}
                      value={q}
                      onChange={(e) => search(e.target.value)}
                    />
                    {searching && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                  </div>
                  {hits.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {hits.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => linkClient(row, c)}
                          className="h-7 px-2 text-[11px] font-bold bg-white"
                          style={{ ...box, color: '#1e293b' }}
                          title={`남은 미수 ${formatKRW(c.remaining)}`}
                        >
                          {c.name}
                          <span className="ml-1 font-normal text-slate-400">
                            {formatKRW(c.remaining)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 최근 분류 — 되돌리기 */}
      {classified.length > 0 && (
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => setShowClassified(!showClassified)}
            className="text-[11px] font-bold text-slate-400 inline-flex items-center gap-1"
          >
            {showClassified ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            최근 분류 {classified.length}건
          </button>
          {showClassified && (
            <div className="mt-1.5 space-y-1">
              {classified.map((row) => (
                <div key={row.id} className="flex items-center gap-2 text-[12px]" style={{ opacity: 0.75 }}>
                  <span className="w-12 shrink-0 tabular-nums text-slate-400">{row.date.slice(5)}</span>
                  <span
                    className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: '2px' }}
                  >
                    {row.category}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-500">{row.counterparty}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">{formatKRW(row.amount)}</span>
                  <button
                    type="button"
                    onClick={() => undo(row)}
                    disabled={busyId === row.id}
                    className="p-1 shrink-0 text-slate-300 hover:text-slate-500"
                    title="분류 해제 — 인박스로 복귀"
                  >
                    {busyId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
