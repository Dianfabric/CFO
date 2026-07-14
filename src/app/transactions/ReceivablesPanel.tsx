'use client'

/**
 * 미수금 관리 (신판) — 거래 관리 페이지 하단 (대표 지시 2026-07-13)
 * 기존 /receivables 페이지를 대체하는 컴팩트 테이블 뷰.
 *  - 거래처 단위: 미수액 · 경과일 · 결제예정일(D-day, 인라인 수정) · 등급(악질/파산) · 담당자
 *  - 입금 처리는 대사 센터(통장 입금↔미수)가 자동 — 여기는 현황과 일정 관리에 집중
 *  - 상세(입금 이력·할인·메모)는 기존 페이지(/receivables)로 링크 (URL 로 접근 가능)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Wallet, ExternalLink } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface ClientRow {
  clientId: string
  clientName: string
  totalAmount: number
  count: number
  oldestDays: number
  dueDate: string | null
  riskGrade: 'normal' | 'blacklist' | 'bankrupt'
  salesPersons: { name: string; count: number; amount: number }[]
}

const RISK: Record<string, { label: string; bg: string; color: string } | null> = {
  normal: null,
  blacklist: { label: '악질', bg: '#fef2f2', color: '#b91c1c' },
  bankrupt: { label: '파산', bg: '#f1f5f9', color: '#334155' },
}

function dDay(due: string | null): { label: string; overdue: boolean } | null {
  if (!due) return null
  const today = new Date().toLocaleDateString('sv-SE')
  const diff = Math.round((new Date(due).getTime() - new Date(today).getTime()) / 86400000)
  if (diff > 0) return { label: `D-${diff}`, overdue: false }
  if (diff === 0) return { label: 'D-day', overdue: false }
  return { label: `D+${-diff} 지남`, overdue: true }
}

type Tab = 'all' | 'overdue' | 'risk'

export default function ReceivablesPanel() {
  const [rows, setRows] = useState<ClientRow[] | null>(null)
  const [totalAR, setTotalAR] = useState(0)
  const [tab, setTab] = useState<Tab>('all')
  const [savingDue, setSavingDue] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/receivables')
      const j = await r.json()
      setRows(Array.isArray(j.summary) ? j.summary : [])
      setTotalAR(j.totalAR ?? 0)
    } catch {
      setRows([])
    }
  }, [])
  useEffect(() => { load() }, [load])

  const saveDue = async (clientId: string, dueDate: string) => {
    setSavingDue(clientId)
    try {
      await fetch('/api/receivables/due-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, dueDate }),
      })
      setRows((prev) => (prev ?? []).map((c) => (c.clientId === clientId ? { ...c, dueDate } : c)))
    } finally {
      setSavingDue(null)
    }
  }

  const view = useMemo(() => {
    if (!rows) return null
    const owed = rows.filter((c) => c.totalAmount > 0)
    if (tab === 'overdue') return owed.filter((c) => dDay(c.dueDate)?.overdue || (!c.dueDate && c.oldestDays > 30))
    if (tab === 'risk') return owed.filter((c) => c.riskGrade !== 'normal')
    return owed
  }, [rows, tab])

  const stats = useMemo(() => {
    if (!rows) return null
    const owed = rows.filter((c) => c.totalAmount > 0)
    const overdue = owed.filter((c) => dDay(c.dueDate)?.overdue)
    const risk = owed.filter((c) => c.riskGrade !== 'normal')
    return {
      clients: owed.length,
      overdueN: overdue.length,
      overdueSum: overdue.reduce((s, c) => s + c.totalAmount, 0),
      riskN: risk.length,
      riskSum: risk.reduce((s, c) => s + c.totalAmount, 0),
    }
  }, [rows])

  return (
    <div className="bg-white p-4 sm:p-5" style={{ border: '1px solid #e2e8f0', borderRadius: '2px' }}>
      <div className="mb-1 flex items-center gap-2 flex-wrap">
        <Wallet className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h3 className="text-[14px] font-bold text-slate-900">미수금 관리 — 받을 돈이 어디에 잠겨 있나</h3>
        <span className="text-[11px] text-slate-400">
          · 입금은 대사 센터가 자동 차감 · 여기는 일정(결제예정일)과 등급 관리
        </span>
        <a
          href="/receivables"
          className="ml-auto text-[11px] text-slate-400 hover:text-slate-600"
          title="입금 이력·할인·상세 편집은 기존 상세 페이지에서"
        >
          상세 페이지 <ExternalLink className="w-3 h-3 inline" />
        </a>
      </div>

      {!rows || !stats || !view ? (
        <p className="py-8 text-center text-[12px] text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />미수 현황 계산 중...
        </p>
      ) : (
        <>
          {/* 요약 스트립 */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: '총 미수', value: formatKRW(totalAR), sub: `${stats.clients}곳` },
              { label: '예정일 지남', value: formatKRW(stats.overdueSum), sub: `${stats.overdueN}곳`, warn: stats.overdueN > 0 },
              { label: '악질·파산', value: formatKRW(stats.riskSum), sub: `${stats.riskN}곳` },
              { label: '정상', value: formatKRW(totalAR - stats.riskSum), sub: `${stats.clients - stats.riskN}곳` },
            ].map((s) => (
              <div key={s.label} className="px-3 py-2" style={{ backgroundColor: s.warn ? '#fef2f2' : 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}>
                <p className="text-[10px] text-slate-400">{s.label} <span className="text-slate-300">· {s.sub}</span></p>
                <p className="text-[14px] font-bold tabular-nums" style={{ color: s.warn ? '#b91c1c' : '#0f172a' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* 필터 탭 */}
          <div className="mb-2 flex gap-1">
            {([['all', `전체 ${stats.clients}`], ['overdue', `예정일 지남 ${stats.overdueN}`], ['risk', `악질·파산 ${stats.riskN}`]] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className="h-7 px-2.5 text-[11px] font-bold"
                style={{
                  borderRadius: '2px', border: '1px solid',
                  borderColor: tab === k ? 'var(--nv-primary, #76b900)' : '#e2e8f0',
                  backgroundColor: tab === k ? 'rgba(118,185,0,0.12)' : '#fff',
                  color: tab === k ? 'var(--nv-success-deep, #4a7c00)' : '#64748b',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 거래처 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-500">
                  <th className="p-2 font-medium">거래처</th>
                  <th className="p-2 font-medium text-right">미수액</th>
                  <th className="p-2 font-medium text-right">건수</th>
                  <th className="p-2 font-medium text-right">경과</th>
                  <th className="p-2 font-medium">결제예정일</th>
                  <th className="p-2 font-medium">담당자</th>
                </tr>
              </thead>
              <tbody>
                {view.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-300">해당 거래처가 없습니다</td></tr>
                ) : (
                  view.map((c) => {
                    const risk = RISK[c.riskGrade]
                    const dd = dDay(c.dueDate)
                    return (
                      <tr key={c.clientId} className="border-b hover:bg-slate-50">
                        <td className="p-2">
                          <span className="font-bold text-slate-800">{c.clientName}</span>
                          {risk && (
                            <span className="ml-1.5 px-1 py-0.5 text-[9px] font-bold" style={{ backgroundColor: risk.bg, color: risk.color, borderRadius: '2px' }}>
                              {risk.label}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-right font-bold tabular-nums">{formatKRW(c.totalAmount)}</td>
                        <td className="p-2 text-right tabular-nums text-slate-500">{c.count}</td>
                        <td className="p-2 text-right tabular-nums text-slate-500">{c.oldestDays}일</td>
                        <td className="p-2">
                          <span className="inline-flex items-center gap-1.5">
                            <input
                              type="date"
                              defaultValue={c.dueDate ?? ''}
                              disabled={savingDue === c.clientId}
                              onChange={(e) => e.target.value && saveDue(c.clientId, e.target.value)}
                              className="h-6 px-1 text-[11px] bg-white"
                              style={{ border: '1px solid #e2e8f0', borderRadius: '2px', color: '#475569' }}
                            />
                            {dd && (
                              <span
                                className="px-1 py-0.5 text-[9px] font-bold tabular-nums"
                                style={{
                                  backgroundColor: dd.overdue ? '#fef2f2' : 'rgba(118,185,0,0.12)',
                                  color: dd.overdue ? '#b91c1c' : 'var(--nv-success-deep, #4a7c00)',
                                  borderRadius: '2px',
                                }}
                              >
                                {dd.label}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="p-2 text-slate-500">
                          {c.salesPersons[0]?.name ?? <span className="text-amber-600">미지정</span>}
                          {c.salesPersons.length > 1 && ` 외 ${c.salesPersons.length - 1}`}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
