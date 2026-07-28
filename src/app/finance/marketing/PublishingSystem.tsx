'use client'

/**
 * 전사 콘텐츠 발행 시스템 — 주간 보드 (대표 지시 2026-07-14)
 * 목적: 들쭉날쭉한 발행 → 6채널(디안/색동 × 블로그·인스타·유튜브) 주간 계획 + 완료 체크 + 준수율.
 * - 칩 클릭 = 완료 토글 · ✕ = 삭제 · 셀 + = 그 날짜에 추가
 * - 주간 템플릿(요일 반복 슬롯) → '이번 주/다음 주 슬롯 생성' 한 번으로 계획 채움
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, Settings2, X } from 'lucide-react'

interface Post {
  id: number
  channel: string
  content_type: string
  planned_date: string
  title: string | null
  status: 'planned' | 'done' | 'skipped'
}
interface Tpl { id: number; channel: string; content_type: string; weekday: number }

const CHANNELS: { key: string; label: string; group: string }[] = [
  { key: 'dian_blog', label: '블로그', group: '디안' },
  { key: 'dian_insta', label: '인스타', group: '디안' },
  { key: 'dian_yt', label: '유튜브', group: '디안' },
  { key: 'saek_blog', label: '블로그', group: '색동' },
  { key: 'saek_insta', label: '인스타', group: '색동' },
  { key: 'saek_yt', label: '유튜브', group: '색동' },
]
const TYPES: Record<string, { label: string; bg: string; color: string }> = {
  info: { label: '정보', bg: '#eff6ff', color: '#1d4ed8' },
  brand: { label: '브랜딩', bg: '#faf5ff', color: '#7e22ce' },
  carousel: { label: '캐러셀', bg: '#fff7ed', color: '#c2410c' },
  reels: { label: '릴스', bg: '#fdf2f8', color: '#be185d' },
  video: { label: '영상', bg: '#f0fdf4', color: '#15803d' },
}
const DAYS = ['월', '화', '수', '목', '금', '토', '일']

function mondayOf(offsetWeeks: number): string {
  const t = new Date()
  const dow = t.getDay()
  t.setDate(t.getDate() - (dow === 0 ? 6 : dow - 1) + offsetWeeks * 7)
  return t.toLocaleDateString('sv-SE')
}
function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv-SE')
}

export default function PublishingSystem() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [posts, setPosts] = useState<Post[]>([])
  const [templates, setTemplates] = useState<Tpl[]>([])
  const [adherence, setAdherence] = useState<{ due: number; done: number; pct: number | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTpl, setShowTpl] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ channel: string; date: string } | null>(null)
  const [addType, setAddType] = useState('info')
  const [addTitle, setAddTitle] = useState('')
  const [tplChannel, setTplChannel] = useState('dian_insta')
  const [tplType, setTplType] = useState('info')
  const [tplDay, setTplDay] = useState(0)

  const monday = useMemo(() => mondayOf(weekOffset), [weekOffset])
  const today = new Date().toLocaleDateString('sv-SE')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/mkt/posts?start=${monday}&end=${addDays(monday, 6)}`)
      const j = await r.json()
      if (j.tableMissing) setError('mkt 테이블 미생성 — 마이그레이션 필요')
      setPosts(Array.isArray(j.posts) ? j.posts : [])
      setTemplates(Array.isArray(j.templates) ? j.templates : [])
      setAdherence(j.adherence ?? null)
    } catch {
      setError('조회 실패')
    } finally {
      setLoading(false)
    }
  }, [monday])
  useEffect(() => { load() }, [load])

  const act = async (body: Record<string, unknown>) => {
    setError(null)
    const r = await fetch('/api/mkt/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const j = await r.json()
    if (!j.ok) setError(j.error ?? '처리 실패')
    return j
  }

  const toggle = async (p: Post) => {
    const next = p.status === 'done' ? 'planned' : 'done'
    setPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next } : x)))
    await act({ action: 'status', id: p.id, status: next })
  }
  const remove = async (p: Post) => {
    setPosts((prev) => prev.filter((x) => x.id !== p.id))
    await act({ action: 'delete', id: p.id })
  }
  const create = async () => {
    if (!adding) return
    const j = await act({ action: 'create', channel: adding.channel, content_type: addType, planned_date: adding.date, title: addTitle })
    if (j.ok) setPosts((prev) => [...prev, j.post])
    setAdding(null)
    setAddTitle('')
  }

  const weekPosts = (channel: string, date: string) =>
    posts.filter((p) => p.channel === channel && p.planned_date === date)
  const weekDone = posts.filter((p) => p.status === 'done').length
  const weekTotal = posts.filter((p) => p.status !== 'skipped').length

  return (
    <div className="bg-white p-4 sm:p-5" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <CalendarDays className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h3 className="text-[14px] font-bold text-slate-900">콘텐츠 발행 시스템 — 꾸준함이 브랜드다</h3>
        <span className="text-[11px] text-slate-400">칩 클릭 = 발행 완료 · 주간 템플릿으로 계획 자동 생성</span>
        <div className="ml-auto flex items-center gap-1.5">
          {adherence && adherence.pct !== null && (
            <span
              className="px-2 py-0.5 text-[11px] font-bold"
              style={{
                backgroundColor: adherence.pct >= 80 ? 'rgba(118,185,0,0.12)' : '#fff7ed',
                color: adherence.pct >= 80 ? 'var(--nv-success-deep, #4a7c00)' : '#c2410c',
                borderRadius: '2px',
              }}
            >
              준수율 {adherence.pct}% ({adherence.done}/{adherence.due})
            </span>
          )}
          <button type="button" onClick={() => setWeekOffset((w) => w - 1)} className="h-6 w-6 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
            <ChevronLeft className="w-3.5 h-3.5 mx-auto text-slate-500" />
          </button>
          <span className="text-[11px] font-bold text-slate-600 tabular-nums">
            {monday.slice(5)} 주{weekOffset === 0 ? ' (이번 주)' : ''}
          </span>
          <button type="button" onClick={() => setWeekOffset((w) => w + 1)} className="h-6 w-6 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
            <ChevronRight className="w-3.5 h-3.5 mx-auto text-slate-500" />
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-2 px-2 py-1.5 text-[11px]" style={{ border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '2px' }}>⚠ {error}</p>
      )}

      {loading ? (
        <p className="py-8 text-center text-[12px] text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />불러오는 중...</p>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-slate-400">
            이번 주 계획 {weekTotal}건 · 완료 {weekDone}건
          </p>
          {/* 주간 그리드 — 6채널 × 7일 */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" style={{ minWidth: 760 }}>
              <thead>
                <tr className="border-b bg-slate-50 text-slate-500">
                  <th className="p-1.5 text-left font-medium w-24">채널</th>
                  {DAYS.map((d, i) => (
                    <th key={d} className="p-1.5 font-medium" style={{ color: addDays(monday, i) === today ? 'var(--nv-primary, #76b900)' : undefined }}>
                      {d} <span className="font-normal text-slate-300">{addDays(monday, i).slice(8)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CHANNELS.map((ch, idx) => (
                  <tr key={ch.key} className="border-b align-top" style={{ borderTop: idx === 3 ? '2px solid #cbd5e1' : undefined }}>
                    <td className="p-1.5 whitespace-nowrap">
                      <span className="font-bold" style={{ color: ch.group === '색동' ? '#be185d' : '#1d4ed8' }}>{ch.group}</span>{' '}
                      <span className="text-slate-600">{ch.label}</span>
                    </td>
                    {DAYS.map((_, i) => {
                      const date = addDays(monday, i)
                      const cell = weekPosts(ch.key, date)
                      return (
                        <td key={i} className="p-1" style={{ backgroundColor: date === today ? 'rgba(118,185,0,0.04)' : undefined }}>
                          <div className="space-y-1 min-h-[26px]">
                            {cell.map((p) => {
                              const t = TYPES[p.content_type] ?? TYPES.info
                              const overdue = p.status !== 'done' && p.planned_date < today
                              return (
                                <div key={p.id} className="group flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => toggle(p)}
                                    title={p.title ?? t.label}
                                    className="flex-1 px-1 py-0.5 text-left text-[10px] font-bold truncate"
                                    style={{
                                      backgroundColor: p.status === 'done' ? 'rgba(118,185,0,0.15)' : t.bg,
                                      color: p.status === 'done' ? 'var(--nv-success-deep, #4a7c00)' : t.color,
                                      borderRadius: '2px',
                                      border: overdue ? '1px solid #fca5a5' : '1px solid transparent',
                                      textDecoration: p.status === 'done' ? 'line-through' : undefined,
                                    }}
                                  >
                                    {p.status === 'done' ? '✓ ' : ''}{t.label}{p.title ? ` · ${p.title}` : ''}
                                  </button>
                                  <button type="button" onClick={() => remove(p)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              )
                            })}
                            {adding?.channel === ch.key && adding.date === date ? (
                              <div className="space-y-1">
                                <select value={addType} onChange={(e) => setAddType(e.target.value)} className="w-full h-6 text-[10px] bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
                                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                                <input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="주제(선택)" className="w-full h-6 px-1 text-[10px] bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }} />
                                <div className="flex gap-1">
                                  <button type="button" onClick={create} className="flex-1 h-6 text-[10px] font-bold" style={{ backgroundColor: 'var(--nv-primary, #76b900)', color: '#000', borderRadius: '2px' }}>추가</button>
                                  <button type="button" onClick={() => setAdding(null)} className="h-6 px-1.5 text-[10px] bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px', color: '#64748b' }}>취소</button>
                                </div>
                              </div>
                            ) : (
                              <button type="button" onClick={() => { setAdding({ channel: ch.key, date }); setAddTitle('') }} className="w-full h-5 text-slate-200 hover:text-slate-400" title="계획 추가">
                                <Plus className="w-3 h-3 mx-auto" />
                              </button>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 템플릿 — 요일 반복 슬롯 */}
          <div className="mt-3 pt-2" style={{ borderTop: '1px dashed #e2e8f0' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setShowTpl((v) => !v)} className="text-[11px] font-bold text-slate-500 hover:text-slate-700">
                <Settings2 className="w-3 h-3 inline mr-0.5" />주간 템플릿 {templates.length}개 {showTpl ? '접기' : '보기'}
              </button>
              <button type="button" onClick={async () => { const j = await act({ action: 'generate-week', monday }); if (j.ok) { load() } }}
                className="h-6 px-2 text-[10px] font-bold" style={{ backgroundColor: 'rgba(118,185,0,0.12)', color: 'var(--nv-success-deep, #4a7c00)', borderRadius: '2px', border: '1px solid var(--nv-primary, #76b900)' }}>
                이 주에 템플릿 슬롯 생성
              </button>
              <span className="text-[10px] text-slate-400">— 템플릿을 만들어두면 매주 버튼 한 번으로 계획이 채워집니다</span>
            </div>
            {showTpl && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <select value={tplChannel} onChange={(e) => setTplChannel(e.target.value)} className="h-6 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
                    {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.group} {c.label}</option>)}
                  </select>
                  <select value={tplType} onChange={(e) => setTplType(e.target.value)} className="h-6 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
                    {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <select value={tplDay} onChange={(e) => setTplDay(Number(e.target.value))} className="h-6 bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
                    {DAYS.map((d, i) => <option key={d} value={i}>{d}요일</option>)}
                  </select>
                  <button type="button" onClick={async () => { const j = await act({ action: 'template-add', channel: tplChannel, content_type: tplType, weekday: tplDay }); if (j.ok) setTemplates((prev) => [...prev, j.template]) }}
                    className="h-6 px-2 font-bold" style={{ backgroundColor: 'var(--nv-primary, #76b900)', color: '#000', borderRadius: '2px' }}>템플릿 추가</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {templates.map((t) => {
                    const ch = CHANNELS.find((c) => c.key === t.channel)
                    return (
                      <span key={t.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: '#f8fafc', borderRadius: '2px', border: '1px solid #e2e8f0' }}>
                        {ch?.group} {ch?.label} · {TYPES[t.content_type]?.label} · {DAYS[t.weekday]}
                        <button type="button" onClick={async () => { const j = await act({ action: 'template-del', id: t.id }); if (j.ok) setTemplates((prev) => prev.filter((x) => x.id !== t.id)) }} className="text-slate-300 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
