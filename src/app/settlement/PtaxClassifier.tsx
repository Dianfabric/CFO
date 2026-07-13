'use client'

/**
 * 매입 세금계산서 성격 분류 (대표 지시 2026-07-13)
 *
 * 미분류 매입 계산서를 매출원가 / 변동비 / 고정비 / 기타로 나눈다.
 *  - 원가·기타는 클릭 즉시 저장, 변동·고정은 관리회계 대분류 선택 후 저장
 *  - 기타는 손익에 반영하지 않음 (관리회계 명세와 중복되는 지출은 기타 권장 — 이중계상 방지)
 *  - 1~6월 백로그도 월 칩으로 골라 여기서 분류
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Tags } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

type PtaxRow = {
  approval_number: string
  issue_date: string
  supplier_name_raw: string
  supply_amount: number
  item_name: string | null
}
type Cats = { fixed: string[]; variable: string[] }

const NATURE_META: { key: 'cogs' | 'variable' | 'fixed' | 'other'; label: string }[] = [
  { key: 'cogs', label: '원가' },
  { key: 'variable', label: '변동' },
  { key: 'fixed', label: '고정' },
  { key: 'other', label: '기타' },
]

function monthChips(): string[] {
  const now = new Date()
  const out: string[] = []
  for (let m = 1; m <= now.getMonth() + 1; m++) {
    out.push(`${now.getFullYear()}-${String(m).padStart(2, '0')}`)
  }
  return out
}

export default function PtaxClassifier() {
  const [month, setMonth] = useState<string>('') // '' = 전체
  const [rows, setRows] = useState<PtaxRow[]>([])
  const [total, setTotal] = useState(0)
  const [cats, setCats] = useState<Cats>({ fixed: [], variable: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingNature, setPendingNature] = useState<Record<string, 'variable' | 'fixed'>>({})
  const [error, setError] = useState<string | null>(null)
  const [columnMissing, setColumnMissing] = useState(false)

  const load = useCallback(async (m: string) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/ptax/classify${m ? `?month=${m}` : ''}`)
      const j = await r.json()
      if (j.columnMissing) setColumnMissing(true)
      setRows(Array.isArray(j.invoices) ? j.invoices : [])
      setTotal(typeof j.total === 'number' ? j.total : (j.invoices?.length ?? 0))
      if (j.categories) setCats(j.categories)
      if (j.error) setError(j.error)
    } catch {
      setError('분류 목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(month) }, [load, month])

  const save = async (approval: string, nature: string, category?: string) => {
    setBusy(approval)
    setError(null)
    try {
      const r = await fetch('/api/ptax/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_number: approval, nature, cost_category: category }),
      })
      const j = await r.json()
      if (!j.ok) {
        setError(j.error ?? '저장 실패')
      } else {
        setRows((prev) => prev.filter((x) => x.approval_number !== approval))
        setTotal((t) => Math.max(0, t - 1))
        setPendingNature((prev) => {
          const next = { ...prev }
          delete next[approval]
          return next
        })
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setBusy(null)
    }
  }

  const pick = (row: PtaxRow, nature: 'cogs' | 'variable' | 'fixed' | 'other') => {
    if (nature === 'cogs' || nature === 'other') {
      save(row.approval_number, nature)
    } else {
      setPendingNature((prev) => ({ ...prev, [row.approval_number]: nature }))
    }
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--nv-hairline, #e2e8f0)' }}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <Tags className="w-3 h-3 inline mr-1" />
        매입 성격 분류 {!loading && <span className="font-normal normal-case">· 미분류 {total}건{total > rows.length ? ` (최근 ${rows.length}건 표시)` : ''}</span>}
      </p>
      <p className="mb-2 text-[10px] text-slate-400 leading-relaxed">
        원가·기타는 클릭 즉시, 변동·고정은 카테고리 선택 후 저장됩니다. 관리회계 명세에 이미 있는
        지출(임대료·통신 등)은 <b>기타</b>로 — 이중 계상을 막습니다. 기타는 손익에 반영되지 않습니다.
      </p>

      {/* 월 필터 칩 — 1~6월 백로그 분류용 */}
      <div className="mb-2 flex flex-wrap gap-1">
        <MonthChip label="전체" active={month === ''} onClick={() => setMonth('')} />
        {monthChips().map((m) => (
          <MonthChip key={m} label={`${Number(m.slice(5))}월`} active={month === m} onClick={() => setMonth(m)} />
        ))}
      </div>

      {columnMissing && (
        <p className="mb-2 px-2 py-1.5 text-[11px]" style={{ border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '2px' }}>
          nature 컬럼 미생성 — Supabase Studio 에서 supabase/migrations/2026-07-13_ptax_nature.sql 실행 필요
        </p>
      )}
      {error && (
        <p className="mb-2 px-2 py-1.5 text-[11px]" style={{ border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '2px' }}>
          ⚠ {error}
        </p>
      )}

      {loading ? (
        <p className="text-[12px] text-slate-400 py-1"><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>
          {month ? `${Number(month.slice(5))}월 매입 계산서는 모두 분류됐습니다.` : '미분류 매입 계산서가 없습니다.'}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
          {rows.map((row) => {
            const pending = pendingNature[row.approval_number]
            const isBusy = busy === row.approval_number
            return (
              <div
                key={row.approval_number}
                className="p-2"
                style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}
              >
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="font-bold text-slate-800 truncate" title={row.supplier_name_raw}>
                    {row.supplier_name_raw}
                  </span>
                  <span className="ml-auto shrink-0 font-bold tabular-nums text-slate-700">
                    {formatKRW(row.supply_amount)}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400 truncate">
                  {row.issue_date}
                  {row.item_name ? ` · ${row.item_name}` : ''}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {NATURE_META.map((n) => (
                    <button
                      key={n.key}
                      type="button"
                      disabled={isBusy}
                      onClick={() => pick(row, n.key)}
                      className="h-6 px-2 text-[10px] font-bold"
                      style={{
                        borderRadius: '2px',
                        border: '1px solid',
                        borderColor: pending === n.key ? 'var(--nv-primary, #76b900)' : '#e2e8f0',
                        backgroundColor: pending === n.key ? 'rgba(118,185,0,0.12)' : '#fff',
                        color: pending === n.key ? 'var(--nv-success-deep, #4a7c00)' : '#475569',
                      }}
                    >
                      {isBusy && (pending === n.key || n.key === 'cogs' || n.key === 'other')
                        ? <Loader2 className="w-3 h-3 animate-spin inline" />
                        : n.label}
                    </button>
                  ))}
                  {pending && (
                    <select
                      disabled={isBusy}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) save(row.approval_number, pending, e.target.value)
                      }}
                      className="h-6 px-1 text-[10px] bg-white"
                      style={{ border: '1px solid var(--nv-primary, #76b900)', borderRadius: '2px', color: '#334155', maxWidth: 130 }}
                    >
                      <option value="">카테고리 선택 → 저장</option>
                      {(pending === 'fixed' ? cats.fixed : cats.variable).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
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

function MonthChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-6 px-2 text-[10px] font-bold"
      style={{
        borderRadius: '2px',
        border: '1px solid',
        borderColor: active ? 'var(--nv-primary, #76b900)' : '#e2e8f0',
        backgroundColor: active ? 'rgba(118,185,0,0.12)' : '#fff',
        color: active ? 'var(--nv-success-deep, #4a7c00)' : '#64748b',
      }}
    >
      {label}
    </button>
  )
}
