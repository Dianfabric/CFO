'use client'

/**
 * 채널 성과 카드 (대표 지시 2026-07-28) — 후행지표 추적
 * 색동 인스타 팔로워 자동 수집(IG Graph API, 열 때마다 오늘 스냅샷 저장) + 90일 추이 스파크라인.
 * 유튜브·디안 인스타는 API 연결 시 같은 자리에 추가.
 */
import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, Loader2 } from 'lucide-react'

interface Live { followers: number; extra?: { username?: string }; error?: string }
interface Hist { channel: string; stat_date: string; followers: number | null }

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const w = 120
  const h = 28
  const step = w / (points.length - 1)
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} className="shrink-0">
      <path d={d} fill="none" stroke="var(--nv-primary, #76b900)" strokeWidth="1.5" />
    </svg>
  )
}

export default function MktInsightsCard() {
  const [live, setLive] = useState<Record<string, Live> | null>(null)
  const [history, setHistory] = useState<Hist[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/mkt/insights')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error)
        setLive(j.live ?? {})
        setHistory(Array.isArray(j.history) ? j.history : [])
      })
      .catch(() => setError('조회 실패'))
  }, [])

  const saek = live?.saek_insta
  const saekHist = useMemo(
    () => history.filter((h) => h.channel === 'saek_insta' && h.followers != null).map((h) => h.followers as number),
    [history],
  )
  const delta7 = useMemo(() => {
    const rows = history.filter((h) => h.channel === 'saek_insta' && h.followers != null)
    if (rows.length < 2 || !saek) return null
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const base = rows.filter((r) => r.stat_date <= weekAgo.toLocaleDateString('sv-SE')).pop() ?? rows[0]
    return saek.followers - (base.followers as number)
  }, [history, saek])

  return (
    <div className="bg-white p-4 sm:p-5" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <TrendingUp className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h3 className="text-[14px] font-bold text-slate-900">채널 성과 — 꾸준함의 결과 (후행지표)</h3>
        <span className="text-[11px] text-slate-400">페이지를 열 때마다 오늘 수치가 자동 기록되어 추이가 쌓입니다</span>
      </div>

      {!live ? (
        <p className="py-4 text-center text-[12px] text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />수집 중...</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {/* 색동 인스타 — 자동 */}
          <div className="px-3 py-2 flex items-center gap-3" style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-slate-400">색동 인스타 팔로워 {saek?.extra?.username ? `(@${saek.extra.username})` : ''}</p>
              {saek?.error ? (
                <p className="text-[11px]" style={{ color: '#dc2626' }}>⚠ {saek.error.slice(0, 60)}</p>
              ) : (
                <p className="text-[18px] font-bold tabular-nums text-slate-900">
                  {saek?.followers?.toLocaleString() ?? '—'}
                  {delta7 != null && (
                    <span className="ml-1.5 text-[11px] font-bold" style={{ color: delta7 >= 0 ? 'var(--nv-success-deep, #4a7c00)' : '#dc2626' }}>
                      {delta7 >= 0 ? '+' : ''}{delta7.toLocaleString()} /7일
                    </span>
                  )}
                </p>
              )}
            </div>
            <Spark points={saekHist} />
          </div>
          {/* 자리 표시 — 연결 대기 채널 */}
          <div className="px-3 py-2" style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}>
            <p className="text-[10px] text-slate-400">디안 인스타</p>
            <p className="text-[11px] text-slate-400">계정 토큰 연결 시 자동 수집</p>
          </div>
          <div className="px-3 py-2" style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}>
            <p className="text-[10px] text-slate-400">유튜브 (디안·색동)</p>
            <p className="text-[11px] text-slate-400">YouTube API 키 등록 시 구독자 자동 수집</p>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[11px]" style={{ color: '#dc2626' }}>⚠ {error}</p>}
    </div>
  )
}
