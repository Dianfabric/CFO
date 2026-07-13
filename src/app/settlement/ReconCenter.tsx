'use client'

/**
 * 대사 센터 — 일계표(ERP) 거래 축 교차 확인.
 *
 * 자동(정확) 매칭이 놓친 것들을 퍼지 매칭(~80% 유사)으로 제안:
 *  ① 매출 거래 ↔ 미매칭 매출 세금계산서 → 승인 시 발행 확인 연결
 *  ② 통장 미매칭 입금 ↔ 미수 거래처 → 승인 시 입금 처리(미수금 차감)
 * '아님' 처리한 조합은 기억되어 다시 제안하지 않음.
 */
import { useCallback, useEffect, useState } from 'react'
import { GitCompareArrows, Check, X, Loader2, ArrowRight, FileCheck2, Banknote } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import type { TaxSuggestion, PurchaseTaxSuggestion, DepositSuggestion } from '@/lib/recon'
import BankInbox from './BankInbox'

const box: React.CSSProperties = { border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }

export default function ReconCenter() {
  const [tax, setTax] = useState<TaxSuggestion[]>([])
  const [ptax, setPtax] = useState<PurchaseTaxSuggestion[]>([])
  const [deposits, setDeposits] = useState<DepositSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/recon/suggestions')
      const j = await r.json()
      setTax(Array.isArray(j.tax) ? j.tax : [])
      setPtax(Array.isArray(j.ptax) ? j.ptax : [])
      setDeposits(Array.isArray(j.deposits) ? j.deposits : [])
      if (j.error) setError(j.error)
    } catch {
      setError('제안 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (
    action: 'confirm' | 'reject',
    kind: 'tax' | 'ptax' | 'deposit',
    key: string,
    leftId?: string,
    rightId?: string,
  ) => {
    setBusyKey(key)
    setError(null)
    try {
      const r = await fetch('/api/recon/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, kind, key, leftId, rightId }),
      })
      const j = await r.json()
      if (!j.ok) {
        setError(j.error ?? '처리 실패')
      } else {
        // 처리된 제안 제거
        if (kind === 'tax') setTax((prev) => prev.filter((s) => s.key !== key))
        else if (kind === 'ptax') setPtax((prev) => prev.filter((s) => s.key !== key))
        else setDeposits((prev) => prev.filter((s) => s.key !== key))
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setBusyKey(null)
    }
  }

  const total = tax.length + ptax.length + deposits.length

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <GitCompareArrows className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h2 className="text-base font-semibold text-slate-900">대사 센터 — 확인이 필요한 매칭</h2>
        {!loading && (
          <span
            className="px-1.5 py-0.5 text-[10px] font-bold"
            style={{
              backgroundColor: total > 0 ? '#fff7ed' : 'rgba(118,185,0,0.12)',
              color: total > 0 ? '#c2410c' : 'var(--nv-success-deep, #4a7c00)',
              borderRadius: '2px',
            }}
          >
            {total > 0 ? `제안 ${total}건` : '모두 대사됨'}
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-400">
        거래처명·금액이 자료마다 조금 달라도 유사하면(~80%) 후보로 제안합니다. ✓ 승인하면 실제로
        연결(발행 확인·수취 확인·입금 처리)되고, ✕ 아님 처리한 조합은 다시 제안하지 않습니다.
      </p>

      {error && (
        <p className="mb-3 px-3 py-2 text-[12px]" style={{ ...box, borderColor: '#fca5a5', backgroundColor: '#fef2f2', color: '#dc2626' }}>
          ⚠ {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 items-start">
        {/* ① 매출·매입 ↔ 세금계산서 */}
        <div className="bg-white p-4" style={box}>
          <p className="mb-2 text-[12px] font-bold text-slate-800">
            <FileCheck2 className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
            매출·매입 ↔ 세금계산서{' '}
            <span className="font-normal text-[11px] text-slate-400">· {tax.length + ptax.length}건 제안</span>
          </p>
          {loading ? (
            <p className="text-[12px] text-slate-400 py-2"><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />계산 중...</p>
          ) : tax.length + ptax.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>확인 필요한 제안이 없습니다.</p>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto">
              {/* 매출 */}
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">매출 · {tax.length}건</p>
                {tax.length === 0 ? (
                  <p className="text-[11px] text-slate-300">없음</p>
                ) : (
                  <div className="space-y-2">
                    {tax.map((s) => (
                      <SuggestionRow
                        key={s.key}
                        busy={busyKey === s.key}
                        score={s.score}
                        left={{ title: s.tx.client, sub: `${s.tx.date} · 매출 ${formatKRW(s.tx.amount)}` }}
                        right={{ title: s.invoice.clientNameRaw, sub: `${s.invoice.issueDate} · 공급가 ${formatKRW(s.invoice.supplyAmount)}` }}
                        onConfirm={() => act('confirm', 'tax', s.key, s.tx.id, s.invoice.id)}
                        onReject={() => act('reject', 'tax', s.key)}
                      />
                    ))}
                  </div>
                )}
              </div>
              {/* 매입 */}
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">매입 (수취) · {ptax.length}건</p>
                {ptax.length === 0 ? (
                  <p className="text-[11px] text-slate-300">없음</p>
                ) : (
                  <div className="space-y-2">
                    {ptax.map((s) => (
                      <SuggestionRow
                        key={s.key}
                        busy={busyKey === s.key}
                        score={s.score}
                        left={{ title: s.tx.client, sub: `${s.tx.date} · 매입 ${formatKRW(s.tx.amount)}` }}
                        right={{ title: s.invoice.supplierNameRaw, sub: `${s.invoice.issueDate} · 공급가 ${formatKRW(s.invoice.supplyAmount)}` }}
                        onConfirm={() => act('confirm', 'ptax', s.key, s.tx.id, s.invoice.approvalNumber)}
                        onReject={() => act('reject', 'ptax', s.key)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ② 통장 입금 ↔ 미수 거래처 */}
        <div className="bg-white p-4" style={box}>
          <p className="mb-2 text-[12px] font-bold text-slate-800">
            <Banknote className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
            통장 입금 ↔ 미수 거래처{' '}
            <span className="font-normal text-[11px] text-slate-400">· {deposits.length}건 제안</span>
          </p>
          {loading ? (
            <p className="text-[12px] text-slate-400 py-2"><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />계산 중...</p>
          ) : deposits.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>확인 필요한 제안이 없습니다.</p>
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-y-auto">
              {deposits.map((s) => (
                <SuggestionRow
                  key={s.key}
                  busy={busyKey === s.key}
                  score={s.score}
                  left={{ title: s.bank.counterparty, sub: `${s.bank.date} · 입금 ${formatKRW(s.bank.amount)}` }}
                  right={{ title: s.client.name, sub: `남은 미수 ${formatKRW(s.client.remaining)}` }}
                  onConfirm={() => act('confirm', 'deposit', s.key, s.bank.id, s.client.id)}
                  onReject={() => act('reject', 'deposit', s.key)}
                />
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-slate-400">승인 시 입금이 미수금에서 차감됩니다 (오래된 미수부터).</p>
        </div>

        {/* ③ 통장 미처리 인박스 */}
        <BankInbox />
      </div>
    </div>
  )
}

function SuggestionRow({
  left, right, score, busy, onConfirm, onReject,
}: {
  left: { title: string; sub: string }
  right: { title: string; sub: string }
  score: number
  busy: boolean
  onConfirm: () => void
  onReject: () => void
}) {
  const pct = Math.round(score * 100)
  return (
    <div
      className="flex items-center gap-2 p-2.5"
      style={{ backgroundColor: 'var(--nv-surface-soft, #f8fafc)', borderRadius: '2px' }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[12px]">
          <span className="font-bold text-slate-800 truncate" title={left.title}>{left.title}</span>
          <ArrowRight className="w-3 h-3 shrink-0 text-slate-300" />
          <span className="font-bold text-slate-800 truncate" title={right.title}>{right.title}</span>
          <span
            className="ml-auto shrink-0 px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
            style={{
              backgroundColor: pct >= 85 ? 'rgba(118,185,0,0.12)' : '#fff7ed',
              color: pct >= 85 ? 'var(--nv-success-deep, #4a7c00)' : '#c2410c',
              borderRadius: '2px',
            }}
            title="유사도"
          >
            {pct}%
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500 truncate">
          {left.sub} <span className="text-slate-300">↔</span> {right.sub}
        </div>
      </div>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="shrink-0 h-7 px-2 inline-flex items-center gap-1 text-[11px] font-bold"
        style={{ backgroundColor: 'var(--nv-primary, #76b900)', color: '#000', borderRadius: '2px' }}
        title="맞음 — 연결 승인"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        연결
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={busy}
        className="shrink-0 h-7 px-2 inline-flex items-center gap-1 text-[11px] font-bold bg-white"
        style={{ ...{ border: '1px solid #e2e8f0', borderRadius: '2px' }, color: '#64748b' }}
        title="아님 — 다시 제안하지 않음"
      >
        <X className="w-3.5 h-3.5" />
        아님
      </button>
    </div>
  )
}
