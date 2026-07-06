'use client'

/**
 * 주문 진행 상황판 — 발주 접수부터 고객 입고까지.
 *
 *   국내(재고):  주문접수 → 창고출고요청 → 한국출고 → 고객입고
 *   해외(발주):  주문접수 → 해외발주 → 현지출고 → 한국입고 → 한국출고 → 고객입고
 *
 * - 일계표 매출 거래가 자동으로 올라옴 (최근 N일)
 * - 단계 클릭으로 진행 · 국내/해외 경로 전환
 * - 담당자 메시지: 진행 요청 문구 자동 생성 → 복사 (알림톡 계약 후 자동 발송 연결 예정)
 * - 입금·계산서·미수 상태를 같은 줄에 — 경영 계기판 항목의 거래별 통합
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Truck, Loader2, RefreshCw, MessageSquareText, Check } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

const box: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: '2px' }

const STAGES: Record<'domestic' | 'overseas', string[]> = {
  domestic: ['주문접수', '창고출고요청', '한국출고', '고객입고'],
  overseas: ['주문접수', '해외발주', '현지출고', '한국입고', '한국출고', '고객입고'],
}

interface FlowRow {
  txId: string
  date: string
  client: string
  phone: string | null
  itemsSummary: string
  amount: number
  person: string | null
  paymentStatus: string
  taxStatus: string | null
  arRemaining: number
  route: 'domestic' | 'overseas'
  stage: number
  touched: boolean
}

interface FlowData {
  days: number
  tableMissing: boolean
  rows: FlowRow[]
  error?: string
}

function payBadge(status: string, arRemaining: number) {
  if (status === 'PAID') return { label: '입금완료', bg: '#f0fdf4', color: '#15803d' }
  if (status === 'PARTIAL') return { label: `부분입금·미수 ${formatKRW(arRemaining)}`, bg: '#fefce8', color: '#a16207' }
  return { label: arRemaining > 0 ? `미수 ${formatKRW(arRemaining)}` : '미입금', bg: '#fef2f2', color: '#b91c1c' }
}

function taxBadge(status: string | null) {
  if (status === 'ISSUED' || status === 'COMPLETED') return { label: '계산서 발행', bg: '#eff6ff', color: '#1d4ed8' }
  return { label: '계산서 미발행', bg: '#f8fafc', color: '#94a3b8' }
}

export default function OrderFlowBoard() {
  const [data, setData] = useState<FlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(60)
  const [personFilter, setPersonFilter] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [copiedTx, setCopiedTx] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async (d: number, silent = false) => {
    if (!silent) setLoading(true)
    try {
      const r = await fetch(`/api/order-flow?days=${d}`)
      setData(await r.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(days) }, [days, load])

  const update = async (txId: string, patch: { route?: string; stage?: number }) => {
    setSaving(txId)
    try {
      const r = await fetch('/api/order-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId, ...patch }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        alert(j?.error ?? '저장 실패')
        return
      }
      await load(days, true)
    } finally {
      setSaving(null)
    }
  }

  // 담당자 진행 요청 메시지 — 복사 (자동 발송은 알림톡 계약 후 연결)
  const copyMessage = async (r: FlowRow) => {
    const stages = STAGES[r.route]
    const cur = stages[Math.min(r.stage, stages.length - 1)]
    const next = r.stage < stages.length - 1 ? stages[r.stage + 1] : null
    const msg = [
      `[디안 발주 진행] ${r.client}`,
      `품목: ${r.itemsSummary || '-'}`,
      `금액: ${formatKRW(r.amount)} · ${r.date} 주문`,
      `현재: ${cur}${next ? ` → 다음 단계: ${next}` : ' (완료)'}`,
      r.person ? `담당: ${r.person}` : null,
      '진행 확인 부탁드립니다.',
    ].filter(Boolean).join('\n')
    try {
      await navigator.clipboard.writeText(msg)
      setCopiedTx(r.txId)
      setTimeout(() => setCopiedTx(null), 1800)
    } catch {
      alert(msg)
    }
  }

  const persons = useMemo(() => {
    const set = new Set<string>()
    for (const r of data?.rows ?? []) if (r.person) set.add(r.person)
    return [...set].sort()
  }, [data])

  const rows = useMemo(() => {
    let list = data?.rows ?? []
    if (personFilter) list = list.filter((r) => (r.person ?? '미지정') === personFilter)
    if (!showDone) list = list.filter((r) => r.stage < STAGES[r.route].length - 1)
    return list
  }, [data, personFilter, showDone])

  // 단계별 요약 (미완료만)
  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of data?.rows ?? []) {
      const stages = STAGES[r.route]
      if (r.stage >= stages.length - 1) continue
      const key = stages[r.stage]
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [data])

  const doneCount = useMemo(
    () => (data?.rows ?? []).filter((r) => r.stage >= STAGES[r.route].length - 1).length,
    [data],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Truck className="w-4 h-4 text-[#76b900]" />
        <h2 className="text-base font-semibold text-slate-900">주문 진행 상황판</h2>
        <span className="text-xs text-slate-400">
          · 접수 → 출고 → 고객입고 · 단계 클릭으로 진행 · 메시지 = 담당자 진행 요청 문구 복사
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-sm border border-slate-200">
            {[30, 60, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className="h-7 px-2.5 text-[11px] font-bold transition-colors"
                style={{ backgroundColor: days === d ? '#76b900' : 'white', color: days === d ? '#000' : '#64748b' }}
              >
                {d}일
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load(days, true)}
            className="h-7 px-2 text-[11px] font-bold inline-flex items-center gap-1 bg-white border border-slate-200 rounded-sm text-slate-500"
          >
            <RefreshCw className="w-3 h-3" /> 새로고침
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-5 text-center text-[12px] text-slate-400" style={box}>
          <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
          주문 흐름 불러오는 중...
        </div>
      ) : !data || data.error ? (
        <div className="bg-white p-4 text-[12px] text-rose-600" style={box}>
          ⚠ 조회 실패{data?.error ? `: ${data.error}` : ''}
        </div>
      ) : (
        <div className="bg-white p-4" style={box}>
          {data.tableMissing && (
            <p className="mb-3 px-3 py-2 text-[11px] font-medium" style={{ ...box, backgroundColor: '#fff7ed', color: '#c2410c' }}>
              ⚠ order_flow 테이블 미생성 — supabase/migrations/2026-07-06_order_flow.sql 실행하면 단계 저장이 활성화됩니다 (지금은 조회만 가능)
            </p>
          )}

          {/* 단계별 요약 + 필터 */}
          <div className="mb-3 flex items-center gap-1.5 flex-wrap">
            {[...new Set([...STAGES.domestic, ...STAGES.overseas])]
              .filter((s) => s !== '고객입고')
              .map((s) => (
                <span key={s} className="px-2 py-1 text-[11px] font-bold" style={{ ...box, backgroundColor: (stageCounts.get(s) ?? 0) > 0 ? '#f7fee7' : 'white', color: (stageCounts.get(s) ?? 0) > 0 ? '#3d7a00' : '#94a3b8' }}>
                  {s} {stageCounts.get(s) ?? 0}
                </span>
              ))}
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="px-2 py-1 text-[11px] font-bold"
              style={{ ...box, backgroundColor: showDone ? '#000' : 'white', color: showDone ? '#fff' : '#64748b' }}
            >
              완료 {doneCount}건 {showDone ? '숨기기' : '보기'}
            </button>
            <select
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              className="ml-auto h-7 px-1.5 text-[11px] font-bold border border-slate-200 rounded-sm bg-white text-slate-600"
            >
              <option value="">담당자 전체</option>
              {persons.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
              <option value="미지정">미지정</option>
            </select>
          </div>

          {/* 리스트 */}
          {rows.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-slate-400">
              {showDone ? '주문이 없습니다.' : '진행 중인 주문이 없습니다 — 모두 고객입고 완료 🎉'}
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const stages = STAGES[r.route]
                const pay = payBadge(r.paymentStatus, r.arRemaining)
                const tax = taxBadge(r.taxStatus)
                return (
                  <div key={r.txId} className="p-3" style={{ ...box, backgroundColor: r.stage >= stages.length - 1 ? '#fafafa' : 'white' }}>
                    {/* 1행: 거래 정보 + 상태 배지 + 메시지 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] tabular-nums text-slate-400">{r.date.slice(5)}</span>
                      <span className="text-[13px] font-bold text-slate-900">{r.client}</span>
                      <span className="text-[11px] text-slate-500 truncate max-w-[260px]" title={r.itemsSummary}>{r.itemsSummary}</span>
                      <span className="text-[12px] font-bold tabular-nums text-slate-800">{formatKRW(r.amount)}</span>
                      {r.person && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: '2px' }}>
                          {r.person}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: pay.bg, color: pay.color, borderRadius: '2px' }}>
                        {pay.label}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: tax.bg, color: tax.color, borderRadius: '2px' }}>
                        {tax.label}
                      </span>
                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => update(r.txId, { route: r.route === 'domestic' ? 'overseas' : 'domestic', stage: 0 })}
                          disabled={saving === r.txId}
                          className="h-6 px-2 text-[10px] font-bold bg-white border border-slate-200 rounded-sm text-slate-500 hover:border-slate-400"
                          title="국내 재고 ↔ 해외 발주 경로 전환 (단계 초기화)"
                        >
                          {r.route === 'overseas' ? '해외 발주' : '국내 재고'} ⇄
                        </button>
                        <button
                          type="button"
                          onClick={() => copyMessage(r)}
                          className="h-6 px-2 text-[10px] font-bold inline-flex items-center gap-1 rounded-sm"
                          style={{ backgroundColor: copiedTx === r.txId ? '#f0fdf4' : '#000', color: copiedTx === r.txId ? '#15803d' : '#fff' }}
                        >
                          {copiedTx === r.txId ? (<><Check className="w-3 h-3" /> 복사됨</>) : (<><MessageSquareText className="w-3 h-3" /> 메시지</>)}
                        </button>
                      </div>
                    </div>
                    {/* 2행: 단계 스텝퍼 */}
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      {stages.map((s, i) => (
                        <button
                          key={s}
                          type="button"
                          disabled={saving === r.txId}
                          onClick={() => update(r.txId, { stage: i })}
                          className="h-6 px-2 text-[10px] font-bold transition-colors disabled:opacity-50"
                          style={{
                            borderRadius: '2px',
                            border: '1px solid',
                            borderColor: i <= r.stage ? '#76b900' : '#e2e8f0',
                            backgroundColor: i < r.stage ? '#f7fee7' : i === r.stage ? '#76b900' : 'white',
                            color: i < r.stage ? '#3d7a00' : i === r.stage ? '#000' : '#94a3b8',
                          }}
                          title={`${s}(으)로 설정`}
                        >
                          {i < r.stage ? '✓ ' : ''}{s}
                        </button>
                      ))}
                      {saving === r.txId && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            일계표 매출이 자동으로 올라옵니다 (최근 {data.days}일) · 경로 전환 시 단계는 주문접수로 초기화 ·
            메시지 버튼 = 담당자 진행 요청 문구 복사 (카카오 알림톡 계약 후 자동 발송 연결 예정) ·
            입금·계산서·미수 상태는 일계표·통장·세금계산서 업로드에서 자동 반영
          </p>
        </div>
      )}
    </div>
  )
}
