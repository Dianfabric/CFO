'use client'

/**
 * 매입 세금계산서 성격 분류 (대표 지시 2026-07-13)
 *
 * 미분류 매입 계산서를 매출원가 / 변동비 / 고정비 / 기타로 나눈다.
 *  - 원가·기타는 클릭 즉시 저장, 변동·고정은 관리회계 대분류 선택 후 저장
 *  - 기타는 손익에 반영하지 않음 (관리회계 명세와 중복되는 지출은 기타 권장 — 이중계상 방지)
 *  - 한 번 분류한 거래처는 규칙이 생겨 다음 계산서부터 자동 분류 (목록에 안 나옴)
 *  - 같은 거래처를 이전과 다른 성격으로 분류하면 '혼합'으로 전환 — 매번 물어봄
 *  - '분류 내역' 뷰에서 자동/수동 분류를 검수하고 재분류 가능
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Tags, ListChecks, Settings2, Trash2 } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

type PtaxRow = {
  approval_number: string
  issue_date: string
  supplier_name_raw: string
  supply_amount: number
  item_name: string | null
  nature: string | null
  cost_category: string | null
  classified_by: string | null
}
type Cats = { fixed: string[]; variable: string[] }
type Rule = {
  supplier_key: string
  supplier_name: string
  nature: 'cogs' | 'variable' | 'fixed' | 'other'
  cost_category: string | null
  mode: 'auto' | 'manual'
  hit_count: number
}
type Applied = { supplier_name: string; nature: string; cost_category: string | null; count: number }

const NATURE_META: { key: 'cogs' | 'variable' | 'fixed' | 'other'; label: string }[] = [
  { key: 'cogs', label: '원가' },
  { key: 'variable', label: '변동' },
  { key: 'fixed', label: '고정' },
  { key: 'other', label: '기타' },
]
const NATURE_LABEL: Record<string, string> = { cogs: '원가', variable: '변동', fixed: '고정', other: '기타' }

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
  const [view, setView] = useState<'todo' | 'done'>('todo')
  const [rows, setRows] = useState<PtaxRow[]>([])
  const [total, setTotal] = useState(0)
  const [cats, setCats] = useState<Cats>({ fixed: [], variable: [] })
  const [rules, setRules] = useState<Rule[]>([])
  const [autoApplied, setAutoApplied] = useState<Applied[]>([])
  const [showRules, setShowRules] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingNature, setPendingNature] = useState<Record<string, 'variable' | 'fixed'>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [columnMissing, setColumnMissing] = useState(false)

  const load = useCallback(async (m: string, v: 'todo' | 'done') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (m) params.set('month', m)
      if (v === 'done') params.set('view', 'classified')
      const r = await fetch(`/api/ptax/classify${params.size ? `?${params}` : ''}`)
      const j = await r.json()
      if (j.columnMissing) setColumnMissing(true)
      setRows(Array.isArray(j.invoices) ? j.invoices : [])
      setTotal(typeof j.total === 'number' ? j.total : (j.invoices?.length ?? 0))
      if (j.categories) setCats(j.categories)
      if (Array.isArray(j.rules)) setRules(j.rules)
      if (Array.isArray(j.autoApplied) && j.autoApplied.length) setAutoApplied(j.autoApplied)
      if (j.error) setError(j.error)
    } catch {
      setError('분류 목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(month, view) }, [load, month, view])

  const save = async (approval: string, nature: string, category?: string | null) => {
    setBusy(approval)
    setError(null)
    setNotice(null)
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
        if (view === 'todo') {
          setRows((prev) => prev.filter((x) => x.approval_number !== approval))
          setTotal((t) => Math.max(0, t - 1))
        } else {
          setRows((prev) =>
            prev.map((x) =>
              x.approval_number === approval
                ? { ...x, nature, cost_category: category ?? null, classified_by: 'user' }
                : x,
            ),
          )
        }
        setPendingNature((prev) => {
          const next = { ...prev }
          delete next[approval]
          return next
        })
        if (j.conflict) {
          setNotice(
            `'${j.conflict.supplier_name}'는 이전(${NATURE_LABEL[j.conflict.prevNature] ?? j.conflict.prevNature})과 다른 성격으로 분류되어 자동 분류를 껐습니다 — 혼합 거래처로 매번 물어봅니다.`,
          )
        }
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

  const patchRule = async (key: string, mode: 'auto' | 'manual') => {
    const r = await fetch('/api/ptax/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_key: key, mode }),
    })
    if ((await r.json()).ok) setRules((prev) => prev.map((x) => (x.supplier_key === key ? { ...x, mode } : x)))
  }

  const deleteRule = async (key: string) => {
    const r = await fetch('/api/ptax/rules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_key: key }),
    })
    if ((await r.json()).ok) setRules((prev) => prev.filter((x) => x.supplier_key !== key))
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--nv-hairline, #e2e8f0)' }}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Tags className="w-3 h-3 inline mr-1" />
          매입 성격 분류
          {!loading && (
            <span className="font-normal normal-case">
              {' '}· {view === 'todo' ? '미분류' : '분류 내역'} {total}건
              {total > rows.length ? ` (최근 ${rows.length}건 표시)` : ''}
            </span>
          )}
        </p>
        <div className="ml-auto flex items-center gap-1">
          <ViewChip label="미분류" active={view === 'todo'} onClick={() => setView('todo')} />
          <ViewChip
            label={<span><ListChecks className="w-3 h-3 inline mr-0.5" />분류 내역</span>}
            active={view === 'done'}
            onClick={() => setView('done')}
          />
        </div>
      </div>
      <p className="mb-2 text-[10px] text-slate-400 leading-relaxed">
        원가·기타는 클릭 즉시, 변동·고정은 카테고리 선택 후 저장됩니다. <b>한 번 분류한 거래처는 다음
        계산서부터 자동 분류</b>되고, 이전과 다르게 분류하면 혼합 거래처로 바뀌어 매번 물어봅니다.
        관리회계 명세에 이미 있는 지출(임대료·통신 등)은 <b>기타</b>로 — 이중 계상을 막습니다.
      </p>

      {/* 월 필터 칩 — 1~6월 백로그 분류용 */}
      <div className="mb-2 flex flex-wrap gap-1">
        <MonthChip label="전체" active={month === ''} onClick={() => setMonth('')} />
        {monthChips().map((m) => (
          <MonthChip key={m} label={`${Number(m.slice(5))}월`} active={month === m} onClick={() => setMonth(m)} />
        ))}
      </div>

      {autoApplied.length > 0 && (
        <div
          className="mb-2 px-2 py-1.5 text-[11px]"
          style={{ backgroundColor: 'rgba(118,185,0,0.08)', color: 'var(--nv-success-deep, #4a7c00)', borderRadius: '2px' }}
        >
          규칙 자동 분류 {autoApplied.reduce((s, a) => s + a.count, 0)}건 —{' '}
          {autoApplied.slice(0, 4).map((a) => `${a.supplier_name} ${a.count}건(${NATURE_LABEL[a.nature] ?? a.nature})`).join(', ')}
          {autoApplied.length > 4 ? ` 외 ${autoApplied.length - 4}곳` : ''}
          <span className="text-slate-400"> · 분류 내역에서 검수 가능</span>
        </div>
      )}
      {notice && (
        <p className="mb-2 px-2 py-1.5 text-[11px]" style={{ border: '1px solid #fdba74', backgroundColor: '#fff7ed', color: '#c2410c', borderRadius: '2px' }}>
          ⚠ {notice}
        </p>
      )}
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
          {view === 'done'
            ? '분류된 계산서가 없습니다.'
            : month
              ? `${Number(month.slice(5))}월 매입 계산서는 모두 분류됐습니다.`
              : '미분류 매입 계산서가 없습니다.'}
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
                  {view === 'done' && row.nature && (
                    <span
                      className="shrink-0 px-1 py-0.5 text-[9px] font-bold"
                      style={{
                        backgroundColor: row.nature === 'other' ? '#f1f5f9' : 'rgba(118,185,0,0.12)',
                        color: row.nature === 'other' ? '#64748b' : 'var(--nv-success-deep, #4a7c00)',
                        borderRadius: '2px',
                      }}
                    >
                      {NATURE_LABEL[row.nature] ?? row.nature}
                      {row.cost_category ? ` · ${row.cost_category}` : ''}
                      {row.classified_by === 'rule' ? ' · 자동' : ''}
                    </span>
                  )}
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
                        borderColor: pending === n.key || (view === 'done' && row.nature === n.key && !pending)
                          ? 'var(--nv-primary, #76b900)' : '#e2e8f0',
                        backgroundColor: pending === n.key || (view === 'done' && row.nature === n.key && !pending)
                          ? 'rgba(118,185,0,0.12)' : '#fff',
                        color: pending === n.key || (view === 'done' && row.nature === n.key && !pending)
                          ? 'var(--nv-success-deep, #4a7c00)' : '#475569',
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

      {/* 자동 분류 규칙 관리 */}
      {rules.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowRules((v) => !v)}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
          >
            <Settings2 className="w-3 h-3 inline mr-0.5" />
            자동 분류 규칙 {rules.length}개 {showRules ? '접기' : '보기'}
            {rules.some((r) => r.mode === 'manual') &&
              ` · 혼합 ${rules.filter((r) => r.mode === 'manual').length}곳`}
          </button>
          {showRules && (
            <div className="mt-1.5 space-y-1 max-h-[200px] overflow-y-auto">
              {rules.map((r) => (
                <div
                  key={r.supplier_key}
                  className="flex items-center gap-2 px-2 py-1.5 text-[11px]"
                  style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}
                >
                  <span className="font-bold text-slate-700 truncate" title={r.supplier_name}>{r.supplier_name}</span>
                  <span className="shrink-0 text-slate-500">
                    {NATURE_LABEL[r.nature] ?? r.nature}
                    {r.cost_category ? ` · ${r.cost_category}` : ''}
                    {r.hit_count > 0 ? ` · 자동 ${r.hit_count}건` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => patchRule(r.supplier_key, r.mode === 'auto' ? 'manual' : 'auto')}
                    className="ml-auto shrink-0 h-5 px-1.5 text-[9px] font-bold"
                    style={{
                      borderRadius: '2px',
                      border: '1px solid',
                      borderColor: r.mode === 'auto' ? 'var(--nv-primary, #76b900)' : '#fdba74',
                      backgroundColor: r.mode === 'auto' ? 'rgba(118,185,0,0.12)' : '#fff7ed',
                      color: r.mode === 'auto' ? 'var(--nv-success-deep, #4a7c00)' : '#c2410c',
                    }}
                    title={r.mode === 'auto' ? '자동 분류 중 — 누르면 수동(매번 물어봄)으로' : '혼합/수동 — 누르면 자동 분류로'}
                  >
                    {r.mode === 'auto' ? '자동' : '혼합·수동'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRule(r.supplier_key)}
                    className="shrink-0 text-slate-300 hover:text-red-500"
                    title="규칙 삭제 (이미 분류된 계산서는 그대로)"
                  >
                    <Trash2 className="w-3 h-3" />
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

function ViewChip({ label, active, onClick }: { label: React.ReactNode; active: boolean; onClick: () => void }) {
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
