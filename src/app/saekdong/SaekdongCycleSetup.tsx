'use client'

/**
 * 색동 전용 12주 기간 설정 (대표 지시 2026-07-13 — 본체와 따로 관리)
 * 시작일만 고르면 종료일 자동(+12주−1일). 저장 후 새로고침으로 반영.
 */
import { useState } from 'react'
import { CalendarDays, Loader2 } from 'lucide-react'

export default function SaekdongCycleSetup({ current }: { current: { start: string; end: string } | null }) {
  const [start, setStart] = useState(current?.start ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(!current)

  const save = async () => {
    if (!start) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/saekdong/cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: start }),
      })
      const j = await r.json()
      if (!j.ok) setError(j.error ?? '저장 실패')
      else window.location.reload()
    } catch {
      setError('네트워크 오류')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-3 flex items-center gap-2 flex-wrap text-[12px]" style={{ color: 'var(--nv-mute)' }}>
      <CalendarDays className="w-3.5 h-3.5" style={{ color: 'var(--nv-primary)' }} />
      {current && !editing ? (
        <>
          <span>
            색동 전용 12주: <b>{current.start} ~ {current.end}</b> (본체 사이클과 독립)
          </span>
          <button type="button" onClick={() => setEditing(true)} className="underline text-slate-400 hover:text-slate-600">
            기간 변경
          </button>
        </>
      ) : (
        <>
          <span>색동 전용 12주 시작일:</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-7 px-1.5 bg-white"
            style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}
          />
          <span className="text-slate-400">종료일 자동 (+12주)</span>
          <button
            type="button"
            onClick={save}
            disabled={busy || !start}
            className="h-7 px-2.5 font-bold"
            style={{ backgroundColor: 'var(--nv-primary, #76b900)', color: '#000', borderRadius: '2px' }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : '저장'}
          </button>
          {current && (
            <button type="button" onClick={() => setEditing(false)} className="underline text-slate-400">취소</button>
          )}
        </>
      )}
      {error && <span style={{ color: '#dc2626' }}>⚠ {error}</span>}
    </div>
  )
}
