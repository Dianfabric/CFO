'use client'

/**
 * 쇼핑몰 순이익 목표 카드 (대표 지시 2026-07-28)
 * 목표(월 순이익)와 마진율을 정하면 → 필요 매출을 역산하고,
 * 이번 달 쇼핑몰 실매출(디안몰 + 색동 온라인, 아임웹)로 달성률을 추적한다.
 * 콘텐츠 발행 시스템의 존재 이유 = 이 목표 — 그래서 발행 보드 바로 위에 둔다.
 */
import { useEffect, useMemo, useState } from 'react'
import { Target, Loader2, Pencil } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { fetchSharedSales, fetchSharedDianShop } from '@/app/saekdong/sharedFetch'

interface Series { thisMonth: number; error?: string }
interface Goal { target: number; margin: number } // target 원, margin %

export default function MktGoalCard() {
  const [goal, setGoal] = useState<Goal | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [tIn, setTIn] = useState('500') // 만원
  const [mIn, setMIn] = useState('30') // %
  const [saek, setSaek] = useState<Series | null>(null)
  const [shop, setShop] = useState<Series | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/mkt/settings?key=mkt_goal')
      .then((r) => r.json())
      .then((j) => {
        if (j.value?.target) {
          setGoal(j.value)
          setTIn(String(Math.round(j.value.target / 10000)))
          setMIn(String(j.value.margin))
        } else setEditing(true)
      })
      .catch(() => setEditing(true))
      .finally(() => setLoaded(true))
    fetchSharedSales<Series>().then(setSaek).catch(() => setSaek({ thisMonth: 0 }))
    fetchSharedDianShop<Series>().then(setShop).catch(() => setShop({ thisMonth: 0 }))
  }, [])

  const save = async () => {
    const target = Math.round(Number(tIn) * 10000)
    const margin = Number(mIn)
    if (!target || !margin) return
    setBusy(true)
    try {
      await fetch('/api/mkt/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'mkt_goal', value: { target, margin } }),
      })
      setGoal({ target, margin })
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const calc = useMemo(() => {
    if (!goal || !saek || !shop) return null
    const saekRev = Math.round((saek.thisMonth ?? 0) / 1.1) // 공급가
    const shopRev = Math.round((shop.thisMonth ?? 0) / 1.1)
    const revenue = saekRev + shopRev
    const estNet = Math.round(revenue * (goal.margin / 100))
    const needRevenue = Math.round(goal.target / (goal.margin / 100))
    const pct = goal.target > 0 ? Math.min(999, Math.round((estNet / goal.target) * 100)) : 0
    return { saekRev, shopRev, revenue, estNet, needRevenue, pct }
  }, [goal, saek, shop])

  return (
    <div className="bg-white p-4 sm:p-5" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <Target className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h3 className="text-[14px] font-bold text-slate-900">쇼핑몰 순이익 목표 — 콘텐츠는 이걸 위해 올린다</h3>
        <span className="text-[11px] text-slate-400">디안몰 + 색동 온라인 (아임웹, 공급가 기준)</span>
        {goal && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="ml-auto text-[11px] text-slate-400 hover:text-slate-600">
            <Pencil className="w-3 h-3 inline mr-0.5" />목표 수정
          </button>
        )}
      </div>

      {!loaded ? (
        <p className="py-4 text-center text-[12px] text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />불러오는 중...</p>
      ) : editing ? (
        <div className="flex items-center gap-2 flex-wrap text-[12px]">
          <span className="text-slate-500">월 순이익 목표</span>
          <input value={tIn} onChange={(e) => setTIn(e.target.value)} className="h-7 w-20 px-1.5 text-right bg-white tabular-nums" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
          <span className="text-slate-500">만원 · 평균 마진율</span>
          <input value={mIn} onChange={(e) => setMIn(e.target.value)} className="h-7 w-14 px-1.5 text-right bg-white tabular-nums" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
          <span className="text-slate-500">%</span>
          <button type="button" onClick={save} disabled={busy} className="h-7 px-2.5 font-bold" style={{ backgroundColor: 'var(--nv-primary, #76b900)', color: '#000', borderRadius: '2px' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : '저장'}
          </button>
          {Number(tIn) > 0 && Number(mIn) > 0 && (
            <span className="text-slate-400">
              → 필요 매출 약 <b>{formatKRW(Math.round((Number(tIn) * 10000) / (Number(mIn) / 100)))}</b>/월
            </span>
          )}
        </div>
      ) : goal && calc ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-2">
            {[
              { label: '목표 순이익', value: formatKRW(goal.target), sub: `마진 ${goal.margin}% 기준` },
              { label: '필요 매출', value: formatKRW(calc.needRevenue), sub: '목표 ÷ 마진율' },
              { label: '이번 달 매출', value: formatKRW(calc.revenue), sub: `디안몰 ${formatKRW(calc.shopRev)} · 색동 ${formatKRW(calc.saekRev)}` },
              { label: '추정 순이익', value: formatKRW(calc.estNet), sub: `달성률 ${calc.pct}%`, hot: true },
            ].map((s) => (
              <div key={s.label} className="px-3 py-2" style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}>
                <p className="text-[10px] text-slate-400">{s.label}</p>
                <p className="text-[15px] font-bold tabular-nums" style={{ color: s.hot ? (calc.pct >= 100 ? 'var(--nv-success-deep, #4a7c00)' : '#c2410c') : '#0f172a' }}>{s.value}</p>
                <p className="text-[10px] text-slate-400">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="h-2 w-full" style={{ backgroundColor: '#f1f5f9', borderRadius: '2px' }}>
            <div
              className="h-2 transition-all"
              style={{
                width: `${Math.min(100, calc.pct)}%`,
                backgroundColor: calc.pct >= 100 ? 'var(--nv-primary, #76b900)' : calc.pct >= 60 ? '#f59e0b' : '#f43f5e',
                borderRadius: '2px',
              }}
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            추정 순이익 = 이번 달 쇼핑몰 매출 × 마진율. 목표를 달성하면 목표를 올려 잡아 다음 단계로.
          </p>
        </>
      ) : null}
    </div>
  )
}
