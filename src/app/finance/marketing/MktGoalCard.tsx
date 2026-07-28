'use client'

/**
 * 마케팅 목표 카드 (대표 지시 2026-07-28)
 * - 디안 / 색동공장 별도 목표 (다른 비즈니스)
 * - 지표 자유 설정: 이름은 자유(순이익·매출·팔로워 등)
 *   · 자동(쇼핑몰 매출 연동): 이번 달 아임웹 매출로 추적, 마진율 입력 시 순이익 추정
 *   · 수동: 현재값을 직접 입력해 추적 (팔로워·구독자 등 아무 지표)
 */
import { useEffect, useMemo, useState } from 'react'
import { Target, Loader2, Pencil } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { fetchSharedSales, fetchSharedDianShop } from '@/app/saekdong/sharedFetch'

interface Series { thisMonth: number; monthly?: { month: string; revenue: number }[]; error?: string }
interface BizGoal {
  label: string          // 지표 이름 (예: 월 순이익, 월 매출, 팔로워)
  target: number         // 목표값 (auto=원, manual=자유 단위)
  mode: 'auto' | 'manual'
  margin?: number        // auto + 마진율(%) → 순이익 추정 (없으면 매출 그대로)
  current?: number       // manual 현재값
  unit?: string          // manual 단위 (예: 명, 건)
  start?: string         // 목표 기간 (YYYY-MM-DD)
  end?: string
}
interface Goals { dian: BizGoal | null; saek: BizGoal | null }

const EMPTY: Goals = { dian: null, saek: null }

function BizCard({
  biz, title, series, goal, onSave,
}: {
  biz: 'dian' | 'saek'
  title: string
  series: Series | null // 아임웹 매출 시계열
  goal: BizGoal | null
  onSave: (g: BizGoal) => Promise<void>
}) {
  // 자동 추적 매출 — 기간이 있으면 기간에 걸친 월들의 합, 없으면 이번 달 (공급가 환산)
  const revenue = useMemo(() => {
    if (!series) return null
    if (goal?.start && goal?.end && series.monthly?.length) {
      const s = goal.start.slice(0, 7)
      const e = goal.end.slice(0, 7)
      const sum = series.monthly.filter((m) => m.month >= s && m.month <= e).reduce((a, m) => a + m.revenue, 0)
      return Math.round(sum / 1.1)
    }
    return Math.round((series.thisMonth ?? 0) / 1.1)
  }, [series, goal?.start, goal?.end])
  const [editing, setEditing] = useState(!goal)
  const [label, setLabel] = useState(goal?.label ?? '월 순이익')
  const [mode, setMode] = useState<'auto' | 'manual'>(goal?.mode ?? 'auto')
  const [tIn, setTIn] = useState(goal ? String(goal.mode === 'auto' ? Math.round(goal.target / 10000) : goal.target) : '500')
  const [mIn, setMIn] = useState(String(goal?.margin ?? ''))
  const [cIn, setCIn] = useState(String(goal?.current ?? ''))
  const [unit, setUnit] = useState(goal?.unit ?? '명')
  const [sIn, setSIn] = useState(goal?.start ?? '')
  const [eIn, setEIn] = useState(goal?.end ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const period = sIn && eIn ? { start: sIn, end: eIn } : {}
    const g: BizGoal =
      mode === 'auto'
        ? { label: label.trim() || '목표', target: Math.round(Number(tIn) * 10000), mode, margin: Number(mIn) || undefined, ...period }
        : { label: label.trim() || '목표', target: Number(tIn), mode, current: Number(cIn) || 0, unit: unit.trim() || '', ...period }
    if (!g.target) return
    setBusy(true)
    try {
      await onSave(g)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const calc = useMemo(() => {
    if (!goal) return null
    if (goal.mode === 'auto') {
      const rev = revenue ?? 0
      const value = goal.margin ? Math.round(rev * (goal.margin / 100)) : rev
      const pct = goal.target > 0 ? Math.round((value / goal.target) * 100) : 0
      const needRev = goal.margin ? Math.round(goal.target / (goal.margin / 100)) : goal.target
      return { value, pct, needRev, fmt: (n: number) => formatKRW(n) }
    }
    const value = goal.current ?? 0
    const pct = goal.target > 0 ? Math.round((value / goal.target) * 100) : 0
    return { value, pct, needRev: null, fmt: (n: number) => `${n.toLocaleString()}${goal.unit ?? ''}` }
  }, [goal, revenue])

  return (
    <div className="p-3" style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[12px] font-bold" style={{ color: biz === 'saek' ? '#be185d' : '#1d4ed8' }}>{title}</span>
        {goal && !editing && (
          <>
            <span className="text-[12px] text-slate-500">· {goal.label}</span>
            <button type="button" onClick={() => setEditing(true)} className="ml-auto text-slate-400 hover:text-slate-600">
              <Pencil className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      {editing ? (
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500">기간</span>
            <input type="date" value={sIn} onChange={(e) => setSIn(e.target.value)} className="h-6 px-1 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
            <span className="text-slate-400">~</span>
            <input type="date" value={eIn} onChange={(e) => setEIn(e.target.value)} className="h-6 px-1 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
            <span className="text-slate-400">(비우면 이번 달 기준)</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500">지표</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 월 순이익 / 팔로워" className="h-6 w-32 px-1.5 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
            <select value={mode} onChange={(e) => setMode(e.target.value as 'auto' | 'manual')} className="h-6 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
              <option value="auto">자동 (쇼핑몰 매출 연동)</option>
              <option value="manual">수동 (직접 입력)</option>
            </select>
          </div>
          {mode === 'auto' ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500">목표</span>
              <input value={tIn} onChange={(e) => setTIn(e.target.value)} className="h-6 w-20 px-1.5 text-right bg-white tabular-nums" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
              <span className="text-slate-500">만원 · 마진율(선택)</span>
              <input value={mIn} onChange={(e) => setMIn(e.target.value)} placeholder="%" className="h-6 w-12 px-1.5 text-right bg-white tabular-nums" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
              <span className="text-slate-400">% — 넣으면 순이익 추정, 비우면 매출 그대로</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500">목표</span>
              <input value={tIn} onChange={(e) => setTIn(e.target.value)} className="h-6 w-24 px-1.5 text-right bg-white tabular-nums" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
              <span className="text-slate-500">현재값</span>
              <input value={cIn} onChange={(e) => setCIn(e.target.value)} className="h-6 w-24 px-1.5 text-right bg-white tabular-nums" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
              <span className="text-slate-500">단위</span>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} className="h-6 w-12 px-1.5 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
            </div>
          )}
          <button type="button" onClick={save} disabled={busy} className="h-6 px-2.5 text-[11px] font-bold" style={{ backgroundColor: 'var(--nv-primary, #76b900)', color: '#000', borderRadius: '2px' }}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '저장'}
          </button>
        </div>
      ) : goal && calc ? (
        <>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[16px] font-bold tabular-nums" style={{ color: calc.pct >= 100 ? 'var(--nv-success-deep, #4a7c00)' : '#0f172a' }}>
              {calc.fmt(calc.value)}
            </span>
            <span className="text-[11px] text-slate-400">/ 목표 {calc.fmt(goal.target)} · 달성률 <b>{calc.pct}%</b></span>
            {goal.mode === 'auto' && (
              <span className="text-[10px] text-slate-400">
                {goal.margin ? `${goal.start ? '기간' : '이번 달'} 매출 ${formatKRW(revenue ?? 0)} × ${goal.margin}% · 필요 매출 ${formatKRW(calc.needRev!)}` : `${goal.start ? '기간' : '이번 달'} 쇼핑몰 매출 (아임웹 공급가)`}
              </span>
            )}
            {goal.start && goal.end && (
              <span className="text-[10px] text-slate-400">· {goal.start} ~ {goal.end}</span>
            )}
          </div>
          <div className="mt-1.5 h-2 w-full" style={{ backgroundColor: '#e2e8f0', borderRadius: '2px' }}>
            <div className="h-2 transition-all" style={{ width: `${Math.min(100, Math.max(0, calc.pct))}%`, backgroundColor: calc.pct >= 100 ? 'var(--nv-primary, #76b900)' : calc.pct >= 60 ? '#f59e0b' : '#f43f5e', borderRadius: '2px' }} />
          </div>
          {goal.mode === 'manual' && (
            <InlineCurrent goal={goal} onSave={onSave} />
          )}
        </>
      ) : null}
    </div>
  )
}

/** 수동 지표 — 현재값만 빠르게 갱신 */
function InlineCurrent({ goal, onSave }: { goal: BizGoal; onSave: (g: BizGoal) => Promise<void> }) {
  const [v, setV] = useState(String(goal.current ?? 0))
  const [busy, setBusy] = useState(false)
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-400">
      현재값 갱신:
      <input value={v} onChange={(e) => setV(e.target.value)} className="h-5 w-20 px-1 text-right bg-white tabular-nums" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
      <button
        type="button"
        disabled={busy}
        onClick={async () => { setBusy(true); try { await onSave({ ...goal, current: Number(v) || 0 }) } finally { setBusy(false) } }}
        className="h-5 px-1.5 font-bold bg-white"
        style={{ border: '1px solid #e2e8f0', borderRadius: '2px', color: '#64748b' }}
      >
        {busy ? '...' : '저장'}
      </button>
    </div>
  )
}

export default function MktGoalCard() {
  const [goals, setGoals] = useState<Goals>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [saek, setSaek] = useState<Series | null>(null)
  const [shop, setShop] = useState<Series | null>(null)

  useEffect(() => {
    fetch('/api/mkt/settings?key=mkt_goals')
      .then((r) => r.json())
      .then((j) => { if (j.value) setGoals({ ...EMPTY, ...j.value }) })
      .catch(() => {})
      .finally(() => setLoaded(true))
    fetchSharedSales<Series>().then(setSaek).catch(() => setSaek({ thisMonth: 0 }))
    fetchSharedDianShop<Series>().then(setShop).catch(() => setShop({ thisMonth: 0 }))
  }, [])

  const saveBiz = (biz: 'dian' | 'saek') => async (g: BizGoal) => {
    const next = { ...goals, [biz]: g }
    setGoals(next)
    await fetch('/api/mkt/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'mkt_goals', value: next }),
    })
  }

  return (
    <div className="bg-white p-4 sm:p-5" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <Target className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h3 className="text-[14px] font-bold text-slate-900">마케팅 목표 — 콘텐츠는 이걸 위해 올린다</h3>
        <span className="text-[11px] text-slate-400">디안·색동 별도 목표 · 지표 자유 (순이익·매출·팔로워…)</span>
      </div>
      {!loaded ? (
        <p className="py-4 text-center text-[12px] text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />불러오는 중...</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <BizCard biz="dian" title="디안" series={shop} goal={goals.dian} onSave={saveBiz('dian')} />
          <BizCard biz="saek" title="색동공장" series={saek} goal={goals.saek} onSave={saveBiz('saek')} />
        </div>
      )}
    </div>
  )
}
