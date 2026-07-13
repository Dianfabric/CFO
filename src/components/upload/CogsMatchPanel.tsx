'use client'

/**
 * 원가 매칭 점검 — TMS 단가표로 원가가 안 잡히는 판매 품목에 수기 원가를 부여.
 * 자료 페이지(일일 마감 업로드 아래) 배치. 2026-07-13.
 *
 * - 품목 규칙(반복): 방염·배송 등 한 번 등록하면 계속 적용 (수량당/건당)
 * - 건별(1회): 커튼제작비·이불커버 같은 커스텀 — 그 거래에만
 * - 수기 원가는 원화 직접 · 7/1부터만 적용(1~6월 확정 손익 불변)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calculator, ChevronDown, ChevronRight, Loader2, Check, Trash2, Plus, AlertTriangle } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface UnmatchedLine { txId: string; date: string; qty: number; amount: number }
interface UnmatchedItem { name: string; qty: number; amount: number; txIds: string[]; lastDate: string; lines: UnmatchedLine[] }
interface Override {
  id: number; scope: 'name' | 'line'; product_name: string; match_mode: string
  transaction_id: string | null; cost_mode: 'per_unit' | 'per_line'; unit_cost: number
  effective_from: string; note: string | null
}

function kstToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}
function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number)
  const end = new Date(y, m, 0).getDate()
  return { start: `${ym}-01`, end: `${ym}-${String(end).padStart(2, '0')}` }
}

export default function CogsMatchPanel() {
  const nowYm = kstToday().slice(0, 7)
  const [ym, setYm] = useState(nowYm)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    coveragePct: number; unmatchedRev: number; matchedRev: number; unmatchedItems: UnmatchedItem[]
  } | null>(null)
  const [overrides, setOverrides] = useState<Override[]>([])
  const [tableMissing, setTableMissing] = useState(false)
  const [openName, setOpenName] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const months = useMemo(() => {
    // 2026-07 ~ 이번 달
    const out: string[] = []
    const [ny, nm] = nowYm.split('-').map(Number)
    let y = 2026, m = 7
    while (y < ny || (y === ny && m <= nm)) {
      out.push(`${y}-${String(m).padStart(2, '0')}`)
      m++; if (m > 12) { m = 1; y++ }
    }
    return out.length ? out : [nowYm]
  }, [nowYm])

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { start, end } = monthRange(ym)
      const [u, o] = await Promise.all([
        fetch(`/api/cogs/unmatched?start=${start}&end=${end}`).then((r) => r.json()),
        fetch('/api/cogs/overrides').then((r) => r.json()),
      ])
      if (u.error) throw new Error(u.error)
      setData(u)
      setOverrides(o.overrides ?? [])
      setTableMissing(!!o.tableMissing)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [ym])

  useEffect(() => { load() }, [load])

  const saveOverride = async (body: Record<string, unknown>) => {
    setErr(null)
    const r = await fetch('/api/cogs/overrides', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const j = await r.json()
    if (!r.ok) { setErr(j.error ?? '저장 실패'); return false }
    await load()
    return true
  }
  const removeOverride = async (id: number) => {
    await fetch(`/api/cogs/overrides?id=${id}`, { method: 'DELETE' })
    await load()
  }

  const cov = data?.coveragePct ?? 0
  const covColor = cov >= 99.5 ? '#16a34a' : cov >= 97 ? '#df6500' : '#e52020'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <Calculator className="w-4 h-4 text-purple-600" />
          원가 매칭 점검
          <span className="text-xs font-normal text-slate-400">
            · 단가표로 원가가 안 잡히는 품목에 수기 원가 부여 — 방염·배송은 규칙, 커스텀은 건별
          </span>
          <div className="ml-auto flex items-center gap-1">
            {months.map((m) => (
              <button
                key={m}
                onClick={() => setYm(m)}
                className="h-7 px-2 text-[11px] font-bold transition-colors"
                style={{
                  border: '1px solid #e2e8f0', borderRadius: '2px',
                  backgroundColor: ym === m ? '#000' : 'white', color: ym === m ? '#fff' : '#64748b',
                }}
              >
                {Number(m.slice(5))}월
              </button>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tableMissing && (
          <div className="flex items-start gap-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>cogs_overrides 테이블이 없습니다 — <code className="text-[11px]">supabase/migrations/2026-07-13_cogs_overrides.sql</code> 을 Supabase에서 실행해주세요. (실행 전엔 저장이 안 됩니다)</span>
          </div>
        )}
        {err && (
          <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded p-2.5">⚠ {err}</div>
        )}

        {/* 커버리지 요약 */}
        {data && !loading && (
          <div className="flex items-center gap-4 flex-wrap text-[12px]">
            <span className="text-slate-500">단가표 커버리지</span>
            <span className="text-[18px] font-bold tabular-nums" style={{ color: covColor }}>
              {cov.toFixed(1)}%
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">
              원가 0 품목 <b>{data.unmatchedItems.length}</b>종 · 매출 {formatKRW(data.unmatchedRev)}
            </span>
            {data.unmatchedItems.length === 0 && (
              <span className="text-[12px] font-bold text-green-600 inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> 이 달은 전 품목 원가 매칭 완료
              </span>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-center py-6 text-[12px] text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" /> 매칭 점검 중...
          </p>
        ) : (
          <div className="space-y-1.5">
            {(data?.unmatchedItems ?? []).map((it) => (
              <UnmatchedRow
                key={it.name}
                item={it}
                open={openName === it.name}
                onToggle={() => setOpenName(openName === it.name ? null : it.name)}
                onSave={saveOverride}
                disabled={tableMissing}
              />
            ))}
          </div>
        )}

        {/* 등록된 수기 원가 */}
        {overrides.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-[11px] font-bold text-slate-500 mb-1.5">등록된 수기 원가 ({overrides.length})</p>
            <div className="space-y-1">
              {overrides.map((o) => (
                <div key={o.id} className="flex items-center gap-2 text-[11px] bg-slate-50 rounded px-2 py-1">
                  <span className="font-bold text-slate-700">{o.product_name}</span>
                  <span className="text-slate-400">
                    {o.unit_cost === 0 ? '패스' : o.scope === 'line' ? '건별' : o.match_mode === 'contains' ? '포함규칙' : '품목규칙'}
                  </span>
                  {o.unit_cost === 0 ? (
                    <span className="text-slate-400">원가 없음 — 점검 제외</span>
                  ) : (
                    <span className="tabular-nums text-slate-600">
                      {formatKRW(o.unit_cost)} {o.cost_mode === 'per_line' ? '/건' : '/수량'}
                    </span>
                  )}
                  <span className="text-slate-400">· {o.effective_from}~</span>
                  {o.note && <span className="text-slate-400 truncate">· {o.note}</span>}
                  <button onClick={() => removeOverride(o.id)} className="ml-auto text-slate-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function UnmatchedRow({
  item, open, onToggle, onSave, disabled,
}: {
  item: UnmatchedItem
  open: boolean
  onToggle: () => void
  onSave: (body: Record<string, unknown>) => Promise<boolean>
  disabled: boolean
}) {
  const [cost, setCost] = useState('')
  const [mode, setMode] = useState<'per_unit' | 'per_line'>('per_unit')
  const [saving, setSaving] = useState(false)

  const saveRule = async () => {
    const v = Number(cost.replace(/,/g, ''))
    if (!v || v <= 0) return
    setSaving(true)
    const ok = await onSave({
      scope: 'name', product_name: item.name, match_mode: 'exact',
      cost_mode: mode, unit_cost: v, note: '품목 규칙',
    })
    setSaving(false)
    if (ok) setCost('')
  }

  // 패스 — 원가 카운트가 필요 없는 품목(할인·단수정리 등). 원가 0 규칙으로 저장 →
  // 매칭 처리되어 앞으로 이 품목은 점검 목록에 나오지 않음.
  const passItem = async () => {
    if (!confirm(`"${item.name}" 은(는) 원가 없이 패스할까요?\n앞으로 이 품목은 점검 목록에 나오지 않습니다. (등록된 수기 원가에서 삭제하면 복귀)`)) return
    setSaving(true)
    await onSave({
      scope: 'name', product_name: item.name, match_mode: 'exact',
      cost_mode: 'per_unit', unit_cost: 0, note: '원가 없음 — 점검 제외',
    })
    setSaving(false)
  }

  return (
    <div className="border border-slate-200 rounded" style={{ borderRadius: '2px' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        <span className="text-[12px] font-bold text-slate-800 flex-1 truncate">{item.name}</span>
        <span className="text-[11px] text-slate-400 tabular-nums">{item.qty.toLocaleString()}개 · {item.txIds.length}건</span>
        <span className="text-[12px] font-bold tabular-nums text-slate-700">{formatKRW(item.amount)}</span>
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-2.5 border-t border-slate-100">
          {/* 품목 규칙 (반복) */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 mb-1">이 품목 원가 규칙 (계속 적용 — 방염·배송 등)</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Input
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="원가 (원)"
                inputMode="numeric"
                className="h-8 w-28 text-[12px]"
              />
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'per_unit' | 'per_line')}
                className="h-8 text-[11px] font-bold border border-slate-200 bg-white px-1.5 outline-none focus:border-[#76b900]"
                style={{ borderRadius: '2px' }}
              >
                <option value="per_unit">수량당 (× {item.qty.toLocaleString()})</option>
                <option value="per_line">건당 (× {item.txIds.length})</option>
              </select>
              <Button size="sm" className="h-8 gap-1" disabled={disabled || saving} onClick={saveRule}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                규칙 저장
              </Button>
              <Button
                size="sm" variant="outline" className="h-8 gap-1 text-slate-500"
                disabled={disabled || saving} onClick={passItem}
                title="원가 카운트 불필요 — 앞으로 이 품목은 점검에 나오지 않음"
              >
                패스 (원가 없음)
              </Button>
            </div>
          </div>

          {/* 건별 (커스텀) */}
          {item.lines.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 mb-1">건별 원가 (커스텀 — 그때그때)</p>
              <div className="space-y-1">
                {item.lines.slice(0, 30).map((ln, i) => (
                  <LineCostRow key={`${ln.txId}-${i}`} name={item.name} line={ln} onSave={onSave} disabled={disabled} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LineCostRow({
  name, line, onSave, disabled,
}: {
  name: string
  line: UnmatchedLine
  onSave: (body: Record<string, unknown>) => Promise<boolean>
  disabled: boolean
}) {
  const [cost, setCost] = useState('')
  const [mode, setMode] = useState<'per_unit' | 'per_line'>('per_line')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const save = async () => {
    const v = Number(cost.replace(/,/g, ''))
    if (!v || v <= 0) return
    setSaving(true)
    const ok = await onSave({
      scope: 'line', product_name: name, transaction_id: line.txId,
      cost_mode: mode, unit_cost: v, effective_from: line.date, note: `건별 ${line.date}`,
    })
    setSaving(false)
    if (ok) { setDone(true); setCost('') }
  }

  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="text-slate-400 tabular-nums w-14">{line.date.slice(5)}</span>
      <span className="text-slate-500 tabular-nums w-16">{line.qty.toLocaleString()}개</span>
      <span className="text-slate-600 tabular-nums w-20">{formatKRW(line.amount)}</span>
      <Input
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        placeholder="원가"
        inputMode="numeric"
        className="h-7 w-24 text-[11px]"
      />
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as 'per_unit' | 'per_line')}
        className="h-7 text-[10px] font-bold border border-slate-200 bg-white px-1 outline-none"
        style={{ borderRadius: '2px' }}
      >
        <option value="per_line">건당</option>
        <option value="per_unit">수량당</option>
      </select>
      <button
        onClick={save}
        disabled={disabled || saving || done}
        className="h-7 px-2 inline-flex items-center gap-1 text-[10px] font-bold bg-slate-900 text-white disabled:opacity-40"
        style={{ borderRadius: '2px' }}
      >
        {done ? <Check className="w-3 h-3" /> : saving ? <Loader2 className="w-3 h-3 animate-spin" /> : '저장'}
      </button>
    </div>
  )
}
