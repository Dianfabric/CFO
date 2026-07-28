'use client'

/**
 * AI 발행 기획자 (대표 지시 2026-07-28)
 * 목표·기간을 컨텍스트로 AI 와 대화하며 기간 전체 발행 기획을 다듬고,
 * "확정" 시 AI 가 내놓는 최종 계획(json)을 검토 → 버튼 한 번으로 캘린더(mkt_posts) 반영.
 */
import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, Send, CalendarCheck } from 'lucide-react'

interface Msg { role: 'user' | 'assistant'; content: string }
interface PlanRow { channel: string; content_type: string; planned_date: string; title?: string }

const CH_LABEL: Record<string, string> = {
  dian_blog: '디안 블로그', dian_insta: '디안 인스타', dian_yt: '디안 유튜브',
  saek_blog: '색동 블로그', saek_insta: '색동 인스타', saek_yt: '색동 유튜브',
}

function parsePlan(text: string): PlanRow[] | null {
  const m = [...text.matchAll(/```json\s*([\s\S]*?)```/g)]
  if (!m.length) return null
  try {
    const j = JSON.parse(m[m.length - 1][1])
    return Array.isArray(j.posts) && j.posts.length ? j.posts : null
  } catch {
    return null
  }
}

export default function MktPlanner() {
  const [open, setOpen] = useState(false)
  const [biz, setBiz] = useState<'dian' | 'saek'>('dian')
  const [goals, setGoals] = useState<Record<string, { label: string; target: number; start?: string; end?: string; unit?: string; mode: string } | null>>({})
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/mkt/settings?key=mkt_goals')
      .then((r) => r.json())
      .then((j) => setGoals(j.value ?? {}))
      .catch(() => {})
  }, [open])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  const goal = goals[biz]
  const plan = msgs.length ? parsePlan(msgs[msgs.length - 1]?.content ?? '') : null

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content }]
    setMsgs(next)
    setInput('')
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/mkt/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          context: goal
            ? { biz: biz === 'dian' ? '디안' : '색동공장', goalLabel: goal.label, target: `${goal.target.toLocaleString()}${goal.unit ?? (goal.mode === 'auto' ? '원' : '')}`, start: goal.start, end: goal.end }
            : { biz: biz === 'dian' ? '디안' : '색동공장' },
        }),
      })
      const j = await r.json()
      if (j.error) setError(j.error)
      else setMsgs((prev) => [...prev, { role: 'assistant', content: j.text }])
    } catch {
      setError('네트워크 오류')
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    if (!plan) return
    setBusy(true)
    try {
      const r = await fetch('/api/mkt/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-create', rows: plan }),
      })
      const j = await r.json()
      if (j.ok) setApplied(`캘린더 반영 완료 — ${j.created}건 등록${j.skipped ? `, 중복 ${j.skipped}건 제외` : ''}. 새로고침하면 캘린더에 보입니다.`)
      else setError(j.error ?? '반영 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white p-4 sm:p-5" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <Bot className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h3 className="text-[14px] font-bold text-slate-900">AI 발행 기획자</h3>
        <span className="text-[11px] text-slate-400">목표·기간으로 전체 발행 기획 → 대화로 수정 → 확정하면 캘린더 반영</span>
        <button type="button" onClick={() => setOpen((v) => !v)} className="ml-auto h-6 px-2 text-[11px] font-bold bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '2px', color: '#64748b' }}>
          {open ? '접기' : '기획 시작'}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <span className="text-slate-500">대상</span>
            {(['dian', 'saek'] as const).map((b) => (
              <button key={b} type="button" onClick={() => setBiz(b)} className="h-6 px-2 font-bold" style={{ borderRadius: '2px', border: '1px solid', borderColor: biz === b ? 'var(--nv-primary, #76b900)' : '#e2e8f0', backgroundColor: biz === b ? 'rgba(118,185,0,0.12)' : '#fff', color: biz === b ? 'var(--nv-success-deep, #4a7c00)' : '#64748b' }}>
                {b === 'dian' ? '디안' : '색동공장'}
              </button>
            ))}
            <span className="text-slate-400">
              {goal ? `목표: ${goal.label} ${goal.target.toLocaleString()}${goal.unit ?? ''} · ${goal.start ?? '기간 미설정'}${goal.end ? ` ~ ${goal.end}` : ''}` : '⚠ 위 목표 카드에서 먼저 목표·기간을 저장하세요'}
            </span>
          </div>

          {/* 대화 */}
          <div className="max-h-[360px] overflow-y-auto space-y-2 p-2" style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}>
            {msgs.length === 0 && (
              <button type="button" onClick={() => send('목표와 기간에 맞춰 전체 콘텐츠 발행 기획 초안을 제안해줘. 주차별 테마와 채널별 주당 횟수 포함해서.')}
                className="w-full py-2 text-[12px] font-bold" style={{ border: '1px dashed var(--nv-primary, #76b900)', borderRadius: '2px', color: 'var(--nv-success-deep, #4a7c00)' }}>
                ✨ 기획 초안 받기 — 주차별 테마 + 채널 배분 제안
              </button>
            )}
            {msgs.map((m, i) => (
              <div key={i} className="text-[12px] whitespace-pre-wrap leading-relaxed px-2 py-1.5" style={{ backgroundColor: m.role === 'user' ? 'rgba(118,185,0,0.10)' : '#fff', borderRadius: '2px', border: '1px solid #eef2f7' }}>
                <b style={{ color: m.role === 'user' ? 'var(--nv-success-deep, #4a7c00)' : '#334155' }}>{m.role === 'user' ? '대표' : '기획자'}</b>{' '}
                {m.content.replace(/```json[\s\S]*?```/g, '📋 (최종 계획 json — 아래 반영 버튼으로)')}
              </div>
            ))}
            {busy && <p className="text-[12px] text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />기획자가 생각 중...</p>}
            <div ref={endRef} />
          </div>

          {error && <p className="text-[11px]" style={{ color: '#dc2626' }}>⚠ {error}</p>}
          {applied && <p className="text-[12px] font-bold" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>✅ {applied}</p>}

          {/* 확정 계획 반영 */}
          {plan && !applied && (
            <div className="p-2" style={{ border: '1px solid var(--nv-primary, #76b900)', backgroundColor: 'rgba(118,185,0,0.06)', borderRadius: '2px' }}>
              <p className="text-[12px] font-bold text-slate-800 mb-1">최종 계획 {plan.length}건 — 채널 구성:{' '}
                {Object.entries(plan.reduce((a: Record<string, number>, p) => { a[p.channel] = (a[p.channel] ?? 0) + 1; return a }, {})).map(([c, n]) => `${CH_LABEL[c] ?? c} ${n}`).join(' · ')}
              </p>
              <button type="button" onClick={apply} disabled={busy} className="h-7 px-3 text-[12px] font-bold" style={{ backgroundColor: 'var(--nv-primary, #76b900)', color: '#000', borderRadius: '2px' }}>
                <CalendarCheck className="w-3.5 h-3.5 inline mr-1" />캘린더에 반영
              </button>
            </div>
          )}

          <div className="flex gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }}
              placeholder="수정 요청 (예: 릴스를 주 3회로 늘려줘 / 이대로 확정해줘)"
              className="flex-1 h-8 px-2 text-[12px] bg-white"
              style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}
            />
            <button type="button" onClick={() => send()} disabled={busy || !input.trim()} className="h-8 px-3" style={{ backgroundColor: 'var(--nv-primary, #76b900)', color: '#000', borderRadius: '2px' }}>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
