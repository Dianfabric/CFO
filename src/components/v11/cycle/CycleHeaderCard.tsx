'use client'

/**
 * 12주 사이클 헤더 카드 (인라인 편집)
 *
 * - Week {n}/12 + 진행 바
 * - 시작일·종료일 인라인 편집 (시작일 변경 시 모든 KR.started_date 자동 동기화)
 * - 큰 목표 (vision_statement) 한 문장 — 모두가 한 방향을 바라보게
 * - 다음 WAM 카운트다운
 */
import { useCallback, useEffect, useState } from 'react'
import { Calendar, Clock, Target, Pencil, Save, X, Loader2 } from 'lucide-react'

interface Cycle {
  id: number
  cycle_number: number
  start_date: string
  end_date: string
  vision_statement: string | null
  status: string
}

interface Props {
  initial: Cycle
}

export default function CycleHeaderCard({ initial }: Props) {
  const [cycle, setCycle] = useState<Cycle>(initial)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 편집 폼 상태
  const [startDate, setStartDate] = useState(initial.start_date)
  const [endDate, setEndDate] = useState(initial.end_date)
  const [vision, setVision] = useState(initial.vision_statement ?? '')

  // 진행률 + WAM dday — mount 후에만 계산 (SSR/CSR hydration mismatch 방지)
  const [progress, setProgress] = useState<{
    weekNumber: number
    daysRemaining: number
    totalProgress: number
  } | null>(null)
  const [wamDday, setWamDday] = useState<number | null>(null)

  useEffect(() => {
    const s = new Date(cycle.start_date).getTime()
    const e = new Date(cycle.end_date).getTime()
    const now = Date.now()
    let p
    if (now < s) p = { weekNumber: 0, daysRemaining: Math.ceil((e - s) / 86400000), totalProgress: 0 }
    else if (now > e) p = { weekNumber: 12, daysRemaining: 0, totalProgress: 1 }
    else {
      const diff = now - s
      const total = e - s
      const days = Math.floor(diff / 86400000)
      p = {
        weekNumber: Math.min(12, Math.floor(days / 7) + 1),
        daysRemaining: Math.ceil((e - now) / 86400000),
        totalProgress: diff / total,
      }
    }
    setProgress(p)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dow = today.getDay()
    setWamDday(dow === 0 ? 1 : (8 - dow) % 7)
  }, [cycle.start_date, cycle.end_date])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/cycle/info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          vision_statement: vision.trim() || null,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error ?? `${r.status}`)
      }
      const j = await r.json()
      setCycle(j.cycle)
      setEditing(false)
      // 시작일 변경했으면 페이지 reload (KR 동기화 결과 반영)
      if (j.day_delta && j.day_delta !== 0) {
        window.location.reload()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setStartDate(cycle.start_date)
    setEndDate(cycle.end_date)
    setVision(cycle.vision_statement ?? '')
    setEditing(false)
    setError(null)
  }

  return (
    <div
      className="border border-[#e5e5e5] bg-white overflow-hidden"
      style={{ borderRadius: '2px' }}
    >
      <div className="p-4 space-y-3">
        {/* 큰 목표 (vision) — 가장 위에 강조 */}
        {!editing && cycle.vision_statement && (
          <div
            className="border-l-4 border-[#f59e0b] bg-[#fffbeb] px-3 py-2"
            style={{ borderRadius: '2px' }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Target className="w-3 h-3 text-[#92400e]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#92400e]">
                12주 큰 목표 · 모두가 향하는 한 방향
              </span>
            </div>
            <p className="text-[14px] font-bold text-[#000] leading-snug">
              {cycle.vision_statement}
            </p>
          </div>
        )}
        {!editing && !cycle.vision_statement && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full text-left border border-dashed border-[#cccccc] bg-white px-3 py-2 hover:border-[#000] transition-colors"
            style={{ borderRadius: '2px' }}
          >
            <div className="flex items-center gap-1.5">
              <Target className="w-3 h-3 text-[#999]" />
              <span className="text-[11px] text-[#666] italic">
                12주 큰 목표 — 한 문장으로 적어주세요 (예: "B2C 신사업 안착 + B2B 매출 +30%")
              </span>
            </div>
          </button>
        )}

        {/* 헤더 row */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-bold tabular-nums text-[#000]">
                Week {progress?.weekNumber ?? '—'}
              </span>
              <span className="text-[16px] text-[#999]">/ 12</span>
            </div>
            <p className="mt-1 text-[12px] text-[#666]">
              <Calendar className="mr-1 inline h-3 w-3" />
              시작 <strong>{cycle.start_date}</strong> · 종료{' '}
              <strong>{cycle.end_date}</strong>
              {progress && (
                <>
                  {' · '}
                  <strong className="text-[#000]">D-{progress.daysRemaining}</strong>
                </>
              )}
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="ml-2 inline-flex items-center gap-1 text-[#666] hover:text-[#000]"
                  title="시작일·종료일·큰 목표 편집"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {wamDday !== null && wamDday <= 7 && (
              <div
                className="bg-[#dbeafe] text-[#1e40af] px-3 py-1.5 text-[12px]"
                style={{ borderRadius: '2px' }}
              >
                <Clock className="mr-1 inline h-3 w-3" />
                다음 WAM:{' '}
                <strong>{wamDday === 0 ? '오늘' : `D-${wamDday}`}</strong>
              </div>
            )}
            <div className="text-right">
              <div className="text-[20px] font-bold tabular-nums text-[#76b900]">
                {progress ? `${Math.round(progress.totalProgress * 100)}%` : '—'}
              </div>
              <div className="text-[10px] text-[#999]">사이클 진행</div>
            </div>
          </div>
        </div>

        {/* 진행 바 */}
        <div className="relative h-3 overflow-hidden bg-[#f3f4f6]" style={{ borderRadius: '2px' }}>
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#0ea5e9] to-[#76b900] transition-all"
            style={{ width: progress ? `${(progress.totalProgress * 100).toFixed(2)}%` : '0%' }}
          />
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 h-full w-px bg-white/40"
              style={{ left: `${((i + 1) / 12) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#999]">
          <span>W1</span>
          <span>W4</span>
          <span>W7</span>
          <span>W10</span>
          <span>W12</span>
        </div>

        {/* 편집 모드 */}
        {editing && (
          <div
            className="border-t border-[#e5e5e5] pt-3 mt-2 space-y-3 bg-[#f9fafb] -mx-4 -mb-4 px-4 pb-4"
          >
            <p className="text-[11px] font-bold text-[#000]">사이클 정보 편집</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-[#666] block mb-0.5">
                  시작일
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-full px-2 text-[13px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
                  style={{ borderRadius: '2px' }}
                />
                <p className="text-[9px] text-[#999] mt-0.5">
                  ℹ 변경 시 모든 직원 KR 의 시작일이 같은 차이만큼 자동 이동
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#666] block mb-0.5">
                  종료일
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 w-full px-2 text-[13px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
                  style={{ borderRadius: '2px' }}
                />
                <p className="text-[9px] text-[#999] mt-0.5">
                  보통 시작일 + 11주 후 금요일 (12주차 종료)
                </p>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#666] block mb-0.5">
                12주 큰 목표 (한 문장)
              </label>
              <textarea
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                rows={2}
                placeholder="예: B2C 신사업 안착 + 디자이너 인지도 30% 상승 + 매출 +20%"
                className="w-full px-2 py-1.5 text-[13px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900] resize-none"
                style={{ borderRadius: '2px' }}
              />
              <p className="text-[9px] text-[#999] mt-0.5">
                모두가 향하는 단 하나의 방향. 헤더에 큰 글씨로 표시됨.
              </p>
            </div>

            {error && (
              <div
                className="border border-[#ef4444] bg-[#fef2f2] px-2 py-1 text-[11px] text-[#991b1b]"
                style={{ borderRadius: '2px' }}
              >
                ⚠ {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="h-8 px-3 text-[11px] font-bold bg-white border border-[#cccccc] hover:border-[#000] inline-flex items-center gap-1"
                style={{ borderRadius: '2px' }}
              >
                <X className="w-3 h-3" />
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-8 px-3 text-[11px] font-bold bg-black text-white inline-flex items-center gap-1 disabled:opacity-50"
                style={{ borderRadius: '2px' }}
              >
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
