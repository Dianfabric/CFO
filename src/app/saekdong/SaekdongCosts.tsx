'use client'

/**
 * 색동 매입·비용 관리 (ERP 없이 간편 입력)
 *
 * - 매입: 색동원단 / 완제품. 간이과세자 매입처는 부가세 0·계산서 해당없음.
 *   송금·세금계산서 수취 체크로 누락 방지 (미완료 강조).
 * - 비용: 디안 관리회계 분류 준용 — 대분류 × 고정/변동 × 재량/비재량 × 비용성격.
 *   고정비는 '매월 반복' 한 번 등록, 일회성은 발생일 기준.
 * - 상단 요약: 이번 달 매출원가 / 월 고정비 / 이번 달 변동비 한눈에.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Package, Receipt, Plus, Trash2, Loader2, CheckCircle2, Circle, AlertTriangle,
} from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { fetchSharedSales, fetchSharedOffline } from './sharedFetch'
import {
  addSaekdongPurchase, updateSaekdongPurchase, deleteSaekdongPurchase,
  addSaekdongExpense, deleteSaekdongExpense,
  upsertSaekdongItemCost, deleteSaekdongItemCost,
  addSaekdongGift, deleteSaekdongGift,
} from './actions'
import type {
  SaekdongPurchase, SaekdongExpense, SaekdongItemCost, SaekdongGift,
} from './actions'

// 디안 관리회계 엑셀 분류 준용
export const EXPENSE_CATEGORIES = [
  '임대료/관리비', '인건비', '외주용역', '운영유지비', '차량·운송비',
  '교통·원재료', '접대·회의', '마케팅·광고', '금융비용', '기타',
] as const
const NATURES = ['판관비', '매출원가', '영업외비용'] as const

const box: React.CSSProperties = { border: '1px solid var(--nv-hairline)', borderRadius: '2px' }
const inputCls =
  'h-8 px-2 text-[12px] bg-white outline-none w-full'
const inputStyle: React.CSSProperties = { border: '1px solid var(--nv-hairline)', borderRadius: '2px', color: 'var(--nv-ink)' }

function todayYmd(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}
function thisMonthKey(): string {
  return todayYmd().slice(0, 7)
}

interface Props {
  initialPurchases: SaekdongPurchase[]
  initialExpenses: SaekdongExpense[]
  initialItemCosts?: SaekdongItemCost[]
  initialGifts?: SaekdongGift[]
  tableMissing?: boolean
}

export default function SaekdongCosts({
  initialPurchases, initialExpenses, initialItemCosts = [], initialGifts = [], tableMissing,
}: Props) {
  const [purchases, setPurchases] = useState(initialPurchases)
  const [expenses, setExpenses] = useState(initialExpenses)
  const [itemCosts, setItemCosts] = useState(initialItemCosts)
  const [gifts, setGifts] = useState(initialGifts)
  const [tab, setTab] = useState<'purchase' | 'expense'>('purchase')
  const [error, setError] = useState<string | null>(null)

  const monthKey = thisMonthKey()

  // ── 요약 (이번 달) ──
  const summary = useMemo(() => {
    const monthPurchases = purchases.filter((p) => p.purchase_date.startsWith(monthKey))
    const cogs = monthPurchases.reduce((s, p) => s + p.amount, 0)
    const monthlyFixed = expenses
      .filter((e) => e.is_monthly && e.cost_type === 'fixed' && activeThisMonth(e, monthKey))
      .reduce((s, e) => s + e.amount, 0)
    const onceFixed = expenses
      .filter((e) => !e.is_monthly && e.cost_type === 'fixed' && (e.expense_date ?? '').startsWith(monthKey))
      .reduce((s, e) => s + e.amount, 0)
    const variable =
      expenses
        .filter((e) => !e.is_monthly && e.cost_type === 'variable' && (e.expense_date ?? '').startsWith(monthKey))
        .reduce((s, e) => s + e.amount, 0) +
      expenses
        .filter((e) => e.is_monthly && e.cost_type === 'variable' && activeThisMonth(e, monthKey))
        .reduce((s, e) => s + e.amount, 0)
    const unpaid = purchases.filter((p) => !p.paid).length
    const noInvoice = purchases.filter(
      (p) => !p.invoice_received && p.supplier_tax_type === 'general',
    ).length
    return { cogs, fixed: monthlyFixed + onceFixed, variable, unpaid, noInvoice }
  }, [purchases, expenses, monthKey])

  if (tableMissing) {
    return (
      <div className="space-y-3">
        <Header />
        <div
          className="p-4 text-[12px]"
          style={{ ...box, borderColor: 'var(--nv-error)', backgroundColor: '#fef2f2', color: 'var(--nv-error)' }}
        >
          ⚠ 매입·비용 테이블이 아직 없습니다. Supabase Studio 에서{' '}
          <code>supabase/migrations/2026-07-02_saekdong_costs.sql</code> 을 실행해 주세요.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Header />

      {/* 한눈에 — 이번 달 매출원가 / 고정비 / 변동비 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="이번 달 매출원가 (매입)" value={summary.cogs} accent />
        <SummaryCard label="이번 달 고정비" value={summary.fixed} />
        <SummaryCard label="이번 달 변동비" value={summary.variable} />
      </div>

      {/* 누락 경고 */}
      {(summary.unpaid > 0 || summary.noInvoice > 0) && (
        <div
          className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium"
          style={{ ...box, backgroundColor: '#fff7ed', color: '#c2410c' }}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {summary.unpaid > 0 && <span>미송금 {summary.unpaid}건</span>}
          {summary.unpaid > 0 && summary.noInvoice > 0 && <span>·</span>}
          {summary.noInvoice > 0 && <span>세금계산서 미수취 {summary.noInvoice}건</span>}
        </div>
      )}

      {error && (
        <div className="px-3 py-2 text-[12px]" style={{ ...box, borderColor: 'var(--nv-error)', backgroundColor: '#fef2f2', color: 'var(--nv-error)' }}>
          ⚠ {error}
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1.5">
        {(
          [
            { key: 'purchase', label: '매입 (원단·완제품)' },
            { key: 'expense', label: '비용 (고정·변동)' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="h-8 px-3 text-[12px] font-bold transition-colors"
            style={{
              borderRadius: '2px',
              border: `1px solid ${tab === t.key ? 'var(--nv-primary)' : 'var(--nv-hairline)'}`,
              backgroundColor: tab === t.key ? 'var(--nv-primary)' : 'white',
              color: tab === t.key ? '#000' : 'var(--nv-mute)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'purchase' ? (
        <>
          <PurchaseTab purchases={purchases} setPurchases={setPurchases} setError={setError} />
          <StockBlock
            purchases={purchases}
            gifts={gifts}
            setGifts={setGifts}
            setError={setError}
          />
          <ItemCostBlock
            itemCosts={itemCosts}
            setItemCosts={setItemCosts}
            purchases={purchases}
            setError={setError}
          />
        </>
      ) : (
        <ExpenseTab expenses={expenses} setExpenses={setExpenses} setError={setError} />
      )}
    </div>
  )
}

function activeThisMonth(e: SaekdongExpense, monthKey: string): boolean {
  if (e.start_month && e.start_month > monthKey) return false
  if (e.end_month && e.end_month < monthKey) return false
  return true
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <Package className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />
      <h2 className="text-base font-semibold" style={{ color: 'var(--nv-ink)' }}>
        색동 매입·비용
      </h2>
      <span className="text-xs" style={{ color: 'var(--nv-stone)' }}>
        · 매출원가(원단·완제품) + 고정비·변동비 — 간편 입력
      </span>
    </div>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-white p-4" style={box}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--nv-mute)' }}>
        {label}
      </p>
      <p className="mt-2 text-[22px] font-bold tabular-nums leading-none" style={{ color: accent ? 'var(--nv-primary)' : 'var(--nv-ink)' }}>
        {formatKRW(value)}
      </p>
    </div>
  )
}

// ═══════════ 매입 탭 ═══════════

function PurchaseTab({
  purchases, setPurchases, setError,
}: {
  purchases: SaekdongPurchase[]
  setPurchases: React.Dispatch<React.SetStateAction<SaekdongPurchase[]>>
  setError: (m: string | null) => void
}) {
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [f, setF] = useState({
    purchase_date: todayYmd(),
    kind: 'fabric' as 'fabric' | 'finished',
    item_name: '',
    supplier: '',
    supplier_tax_type: 'general' as 'general' | 'simplified',
    qty: '1',
    unit_price: '',
    memo: '',
  })

  const qtyN = Number(f.qty) || 0
  const unitN = Number(f.unit_price) || 0
  const amount = Math.round(qtyN * unitN)
  const vat = f.supplier_tax_type === 'simplified' ? 0 : Math.round(amount * 0.1)

  const add = async () => {
    if (!f.item_name.trim() || amount <= 0) {
      setError('품목명과 수량·단가를 입력하세요.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await addSaekdongPurchase({
      purchase_date: f.purchase_date,
      kind: f.kind,
      item_name: f.item_name.trim(),
      supplier: f.supplier.trim() || null,
      supplier_tax_type: f.supplier_tax_type,
      qty: qtyN,
      unit_price: unitN,
      amount,
      vat,
      memo: f.memo.trim() || null,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error ?? '저장 실패'); return }
    // 서버 재조회 대신 낙관적 반영 (id 는 임시 — 새로고침 시 실제값)
    setPurchases((prev) => [
      {
        id: Date.now(), purchase_date: f.purchase_date, kind: f.kind,
        item_name: f.item_name.trim(), supplier: f.supplier.trim() || null,
        supplier_tax_type: f.supplier_tax_type, qty: qtyN, unit_price: unitN,
        amount, vat, paid: false, invoice_received: false, memo: f.memo.trim() || null,
      },
      ...prev,
    ])
    setF({ ...f, item_name: '', qty: '1', unit_price: '', memo: '' })
  }

  const toggle = async (p: SaekdongPurchase, field: 'paid' | 'invoice_received') => {
    setBusyId(p.id)
    const res = await updateSaekdongPurchase(p.id, { [field]: !p[field] })
    setBusyId(null)
    if (!res.ok) { setError(res.error ?? '수정 실패'); return }
    setPurchases((prev) => prev.map((x) => (x.id === p.id ? { ...x, [field]: !p[field] } : x)))
  }

  const remove = async (id: number) => {
    if (!confirm('이 매입을 삭제할까요?')) return
    setBusyId(id)
    const res = await deleteSaekdongPurchase(id)
    setBusyId(null)
    if (!res.ok) { setError(res.error ?? '삭제 실패'); return }
    setPurchases((prev) => prev.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-3">
      {/* 입력 폼 */}
      <div className="bg-white p-4 space-y-2.5" style={box}>
        <p className="text-[12px] font-bold" style={{ color: 'var(--nv-ink)' }}>매입 입력</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <input type="date" className={inputCls} style={inputStyle} value={f.purchase_date}
            onChange={(e) => setF({ ...f, purchase_date: e.target.value })} />
          <select className={inputCls} style={inputStyle} value={f.kind}
            onChange={(e) => setF({ ...f, kind: e.target.value as 'fabric' | 'finished' })}>
            <option value="fabric">색동원단</option>
            <option value="finished">완제품</option>
          </select>
          <input placeholder="품목명 (금빛단, 복주머니…)" className={inputCls + ' col-span-2'} style={inputStyle}
            value={f.item_name} onChange={(e) => setF({ ...f, item_name: e.target.value })} />
          <input placeholder="매입처" className={inputCls} style={inputStyle}
            value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
          <select className={inputCls} style={inputStyle} value={f.supplier_tax_type}
            onChange={(e) => setF({ ...f, supplier_tax_type: e.target.value as 'general' | 'simplified' })}>
            <option value="general">일반과세</option>
            <option value="simplified">간이과세</option>
          </select>
          <input type="number" placeholder="수량" className={inputCls} style={inputStyle}
            value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
          <input type="number" placeholder="단가" className={inputCls} style={inputStyle}
            value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input placeholder="메모 (선택)" className={inputCls + ' flex-1 min-w-40'} style={inputStyle}
            value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} />
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--nv-mute)' }}>
            공급가 <b style={{ color: 'var(--nv-ink)' }}>{formatKRW(amount)}</b>
            {' '}+ 부가세 <b style={{ color: 'var(--nv-ink)' }}>{formatKRW(vat)}</b>
            {f.supplier_tax_type === 'simplified' && (
              <span className="ml-1" style={{ color: '#c2410c' }}>(간이 — 부가세·계산서 없음)</span>
            )}
          </span>
          <button type="button" onClick={add} disabled={saving}
            className="h-8 px-3 text-[12px] font-bold inline-flex items-center gap-1"
            style={{ backgroundColor: 'var(--nv-primary)', color: '#000', borderRadius: '2px' }}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            추가
          </button>
        </div>
      </div>

      {/* 목록 */}
      <div className="bg-white p-4" style={box}>
        <p className="text-[12px] font-bold mb-2" style={{ color: 'var(--nv-ink)' }}>
          매입 내역 <span className="font-normal text-[11px]" style={{ color: 'var(--nv-stone)' }}>· {purchases.length}건 · 체크를 눌러 송금/계산서 완료 처리</span>
        </p>
        {purchases.length === 0 ? (
          <p className="text-[12px] italic py-2" style={{ color: 'var(--nv-stone)' }}>매입 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]" style={{ minWidth: 760 }}>
              <thead>
                <tr className="text-left" style={{ color: 'var(--nv-stone)', borderBottom: '1px solid var(--nv-hairline)' }}>
                  <th className="py-1.5 pr-2 font-medium">날짜</th>
                  <th className="pr-2 font-medium">구분</th>
                  <th className="pr-2 font-medium">품목</th>
                  <th className="pr-2 font-medium">매입처</th>
                  <th className="pr-2 font-medium text-right">수량</th>
                  <th className="pr-2 font-medium text-right">공급가</th>
                  <th className="pr-2 font-medium text-right">부가세</th>
                  <th className="pr-2 font-medium text-center">송금</th>
                  <th className="pr-2 font-medium text-center">계산서</th>
                  <th className="font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const pending = !p.paid || (!p.invoice_received && p.supplier_tax_type === 'general')
                  return (
                    <tr key={p.id}
                      style={{ borderBottom: '1px solid var(--nv-hairline)', backgroundColor: pending ? '#fffbeb' : undefined }}>
                      <td className="py-1.5 pr-2 tabular-nums" style={{ color: 'var(--nv-mute)' }}>{p.purchase_date.slice(2)}</td>
                      <td className="pr-2">
                        <span className="px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: p.kind === 'fabric' ? 'rgba(118,185,0,0.12)' : '#eef2ff', color: p.kind === 'fabric' ? 'var(--nv-success-deep, #4a7c00)' : '#4338ca', borderRadius: '2px' }}>
                          {p.kind === 'fabric' ? '원단' : '완제품'}
                        </span>
                      </td>
                      <td className="pr-2 font-medium" style={{ color: 'var(--nv-ink)' }}>{p.item_name}</td>
                      <td className="pr-2" style={{ color: 'var(--nv-mute)' }}>
                        {p.supplier ?? '-'}
                        {p.supplier_tax_type === 'simplified' && (
                          <span className="ml-1 text-[10px]" style={{ color: '#c2410c' }}>간이</span>
                        )}
                      </td>
                      <td className="pr-2 text-right tabular-nums" style={{ color: 'var(--nv-mute)' }}>{p.qty}</td>
                      <td className="pr-2 text-right tabular-nums font-bold" style={{ color: 'var(--nv-ink)' }}>{formatKRW(p.amount)}</td>
                      <td className="pr-2 text-right tabular-nums" style={{ color: 'var(--nv-stone)' }}>{p.vat > 0 ? formatKRW(p.vat) : '-'}</td>
                      <td className="pr-2 text-center">
                        <CheckToggle checked={p.paid} busy={busyId === p.id} onClick={() => toggle(p, 'paid')} />
                      </td>
                      <td className="pr-2 text-center">
                        {p.supplier_tax_type === 'simplified' ? (
                          <span className="text-[10px]" style={{ color: 'var(--nv-stone)' }}>해당없음</span>
                        ) : (
                          <CheckToggle checked={p.invoice_received} busy={busyId === p.id} onClick={() => toggle(p, 'invoice_received')} />
                        )}
                      </td>
                      <td className="text-right">
                        <button type="button" onClick={() => remove(p.id)} className="p-1" title="삭제"
                          style={{ color: 'var(--nv-stone)' }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function CheckToggle({ checked, busy, onClick }: { checked: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="inline-flex items-center justify-center p-1"
      title={checked ? '완료 (클릭 시 해제)' : '미완료 (클릭 시 완료)'}>
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--nv-stone)' }} />
      ) : checked ? (
        <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />
      ) : (
        <Circle className="w-4 h-4" style={{ color: '#d97706' }} />
      )}
    </button>
  )
}

// ═══════════ 비용 탭 ═══════════

function ExpenseTab({
  expenses, setExpenses, setError,
}: {
  expenses: SaekdongExpense[]
  setExpenses: React.Dispatch<React.SetStateAction<SaekdongExpense[]>>
  setError: (m: string | null) => void
}) {
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [f, setF] = useState({
    cost_type: 'fixed' as 'fixed' | 'variable',
    is_monthly: true,
    category: EXPENSE_CATEGORIES[0] as string,
    item: '',
    amount: '',
    discretionary: false,
    nature: '판관비' as '판관비' | '매출원가' | '영업외비용',
    expense_date: todayYmd(),
    start_month: thisMonthKey(),
    memo: '',
  })

  const add = async () => {
    const amt = Number(f.amount) || 0
    if (!f.item.trim() || amt <= 0) { setError('항목명과 금액을 입력하세요.'); return }
    setSaving(true)
    setError(null)
    const payload = {
      cost_type: f.cost_type,
      category: f.category,
      item: f.item.trim(),
      discretionary: f.discretionary,
      nature: f.nature,
      amount: amt,
      is_monthly: f.is_monthly,
      start_month: f.is_monthly ? f.start_month : null,
      end_month: null,
      expense_date: f.is_monthly ? null : f.expense_date,
      memo: f.memo.trim() || null,
    }
    const res = await addSaekdongExpense(payload)
    setSaving(false)
    if (!res.ok) { setError(res.error ?? '저장 실패'); return }
    setExpenses((prev) => [{ id: Date.now(), ...payload } as SaekdongExpense, ...prev])
    setF({ ...f, item: '', amount: '', memo: '' })
  }

  const remove = async (id: number) => {
    if (!confirm('이 비용을 삭제할까요?')) return
    setBusyId(id)
    const res = await deleteSaekdongExpense(id)
    setBusyId(null)
    if (!res.ok) { setError(res.error ?? '삭제 실패'); return }
    setExpenses((prev) => prev.filter((x) => x.id !== id))
  }

  const monthly = expenses.filter((e) => e.is_monthly)
  const oneoff = expenses.filter((e) => !e.is_monthly)

  return (
    <div className="space-y-3">
      {/* 입력 폼 */}
      <div className="bg-white p-4 space-y-2.5" style={box}>
        <p className="text-[12px] font-bold" style={{ color: 'var(--nv-ink)' }}>비용 입력</p>
        <div className="flex flex-wrap items-center gap-2">
          {/* 고정/변동 토글 */}
          <Toggle2
            value={f.cost_type} left={{ v: 'fixed', label: '고정비' }} right={{ v: 'variable', label: '변동비' }}
            onChange={(v) => setF({ ...f, cost_type: v as 'fixed' | 'variable', is_monthly: v === 'fixed' })}
          />
          {/* 재량/비재량 토글 */}
          <Toggle2
            value={f.discretionary ? 'y' : 'n'} left={{ v: 'n', label: '비재량' }} right={{ v: 'y', label: '재량' }}
            onChange={(v) => setF({ ...f, discretionary: v === 'y' })}
          />
          <select className={inputCls + ' w-auto'} style={inputStyle} value={f.nature}
            onChange={(e) => setF({ ...f, nature: e.target.value as typeof f.nature })}>
            {NATURES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--nv-mute)' }}>
            <input type="checkbox" checked={f.is_monthly}
              onChange={(e) => setF({ ...f, is_monthly: e.target.checked })} />
            매월 반복
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <select className={inputCls} style={inputStyle} value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value })}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="항목명 (예: 창고 임대료)" className={inputCls + ' col-span-2'} style={inputStyle}
            value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} />
          <input type="number" placeholder={f.is_monthly ? '월 금액' : '금액'} className={inputCls} style={inputStyle}
            value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          {f.is_monthly ? (
            <input type="month" className={inputCls} style={inputStyle} value={f.start_month}
              onChange={(e) => setF({ ...f, start_month: e.target.value })} title="반복 시작 월" />
          ) : (
            <input type="date" className={inputCls} style={inputStyle} value={f.expense_date}
              onChange={(e) => setF({ ...f, expense_date: e.target.value })} />
          )}
          <div className="flex gap-2">
            <input placeholder="메모" className={inputCls} style={inputStyle}
              value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} />
            <button type="button" onClick={add} disabled={saving}
              className="h-8 px-3 text-[12px] font-bold inline-flex items-center gap-1 shrink-0"
              style={{ backgroundColor: 'var(--nv-primary)', color: '#000', borderRadius: '2px' }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              추가
            </button>
          </div>
        </div>
      </div>

      {/* 매월 반복 (고정 세팅) */}
      <ExpenseList
        title="매월 반복 비용"
        subtitle="한 번 등록하면 매달 자동 반영"
        rows={monthly}
        busyId={busyId}
        onDelete={remove}
        dateLabel={(e) => `${e.start_month ?? ''}~${e.end_month ?? ''}`}
      />
      {/* 일회성 */}
      <ExpenseList
        title="일회성 비용"
        subtitle="발생일 기준"
        rows={oneoff}
        busyId={busyId}
        onDelete={remove}
        dateLabel={(e) => e.expense_date?.slice(2) ?? ''}
      />
    </div>
  )
}

function Toggle2({
  value, left, right, onChange,
}: {
  value: string
  left: { v: string; label: string }
  right: { v: string; label: string }
  onChange: (v: string) => void
}) {
  return (
    <div className="inline-flex" style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px', overflow: 'hidden' }}>
      {[left, right].map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className="h-8 px-3 text-[12px] font-bold transition-colors"
          style={{
            backgroundColor: value === o.v ? 'var(--nv-primary)' : 'white',
            color: value === o.v ? '#000' : 'var(--nv-mute)',
          }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ExpenseList({
  title, subtitle, rows, busyId, onDelete, dateLabel,
}: {
  title: string
  subtitle: string
  rows: SaekdongExpense[]
  busyId: number | null
  onDelete: (id: number) => void
  dateLabel: (e: SaekdongExpense) => string
}) {
  const total = rows.reduce((s, e) => s + e.amount, 0)
  return (
    <div className="bg-white p-4" style={box}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] font-bold" style={{ color: 'var(--nv-ink)' }}>
          <Receipt className="w-3.5 h-3.5 inline mr-1" style={{ color: 'var(--nv-mute)' }} />
          {title}{' '}
          <span className="font-normal text-[11px]" style={{ color: 'var(--nv-stone)' }}>· {subtitle} · {rows.length}건</span>
        </p>
        <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--nv-ink)' }}>{formatKRW(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[12px] italic" style={{ color: 'var(--nv-stone)' }}>등록된 비용이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-[12px]">
              <span className="w-16 shrink-0 tabular-nums" style={{ color: 'var(--nv-stone)' }}>{dateLabel(e)}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold shrink-0"
                style={{
                  backgroundColor: e.cost_type === 'fixed' ? '#eef2ff' : 'rgba(118,185,0,0.12)',
                  color: e.cost_type === 'fixed' ? '#4338ca' : 'var(--nv-success-deep, #4a7c00)',
                  borderRadius: '2px',
                }}>
                {e.cost_type === 'fixed' ? '고정' : '변동'}
              </span>
              <span className="px-1.5 py-0.5 text-[10px] shrink-0"
                style={{ backgroundColor: 'var(--nv-surface-soft)', color: 'var(--nv-mute)', borderRadius: '2px' }}>
                {e.category}
              </span>
              <span className="px-1.5 py-0.5 text-[10px] shrink-0"
                style={{ backgroundColor: 'var(--nv-surface-soft)', color: e.discretionary ? '#c2410c' : 'var(--nv-mute)', borderRadius: '2px' }}>
                {e.discretionary ? '재량' : '비재량'}
              </span>
              <span className="px-1.5 py-0.5 text-[10px] shrink-0"
                style={{ backgroundColor: 'var(--nv-surface-soft)', color: 'var(--nv-mute)', borderRadius: '2px' }}>
                {e.nature}
              </span>
              <span className="flex-1 truncate font-medium" style={{ color: 'var(--nv-ink)' }} title={e.memo ?? undefined}>
                {e.item}
              </span>
              <span className="shrink-0 tabular-nums font-bold" style={{ color: 'var(--nv-ink)' }}>
                {formatKRW(e.amount)}{e.is_monthly && <span className="text-[10px] font-normal" style={{ color: 'var(--nv-stone)' }}>/월</span>}
              </span>
              <button type="button" onClick={() => onDelete(e.id)} disabled={busyId === e.id} className="p-1 shrink-0" title="삭제"
                style={{ color: 'var(--nv-stone)' }}>
                {busyId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════ 품목 기준단가 — 매입으로 잡지 않는 원가 (이익 계산 전용) ═══════════

const CUSTOM = '__custom__'

function normItemName(s: string): string {
  return String(s || '').replace(/\[[^\]]*\]/g, '').toLowerCase().replace(/\s+/g, '')
}

interface SoldProduct {
  prodName: string
  revenue: number
  qty: number
}

function ItemCostBlock({
  itemCosts, setItemCosts, purchases, setError,
}: {
  itemCosts: SaekdongItemCost[]
  setItemCosts: React.Dispatch<React.SetStateAction<SaekdongItemCost[]>>
  purchases: SaekdongPurchase[]
  setError: (m: string | null) => void
}) {
  const [saving, setSaving] = useState(false)
  const [busyName, setBusyName] = useState<string | null>(null)
  const [picked, setPicked] = useState<string>('') // 드롭다운 선택값 (또는 CUSTOM)
  const [customName, setCustomName] = useState('')
  const [cost, setCost] = useState('')
  const [products, setProducts] = useState<SoldProduct[]>([])
  const [productYear, setProductYear] = useState('')

  // 2026년 판매 제품 목록 — 매출 섹션과 같은 요청 공유 (추가 호출 없음)
  useEffect(() => {
    fetchSharedSales<{ products?: SoldProduct[]; productYear?: string; error?: string }>()
      .then((s) => {
        if (!s.error && Array.isArray(s.products)) {
          setProducts(s.products)
          setProductYear(s.productYear ?? '')
        }
      })
      .catch(() => {})
  }, [])

  // 원가 정보가 있는 품목 (기준단가 등록 or 매입 기록) — 없는 품목은 드롭다운에서 빨간색
  const costKeys = useMemo(() => {
    const set = new Set<string>()
    for (const c of itemCosts) set.add(normItemName(c.item_name))
    for (const p of purchases) set.add(normItemName(p.item_name))
    return set
  }, [itemCosts, purchases])

  const name = picked === CUSTOM ? customName : picked
  const unitCost = Number(cost) || 0
  // 선택 제품의 판매수량 → 매출원가·이익 미리보기
  const preview = useMemo(() => {
    if (!name.trim() || unitCost <= 0) return null
    const pr = products.find((p) => normItemName(p.prodName) === normItemName(name))
    if (!pr) return null
    const estCogs = Math.round(unitCost * pr.qty)
    const supply = Math.round(pr.revenue / 1.1)
    const profit = supply - estCogs
    return { qty: pr.qty, estCogs, profit, margin: supply > 0 ? (profit / supply) * 100 : 0 }
  }, [name, unitCost, products])

  const add = async () => {
    if (!name.trim() || unitCost <= 0) {
      setError('품목명과 개당 원가를 입력하세요.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await upsertSaekdongItemCost({
      item_name: name.trim(),
      unit_cost: unitCost,
      memo: null,
    })
    setSaving(false)
    if (!res.ok) {
      setError(
        /find the table|does not exist/i.test(res.error ?? '')
          ? '기준단가 테이블이 없습니다 — supabase/migrations/2026-07-02_saekdong_item_costs.sql 을 실행해 주세요.'
          : (res.error ?? '저장 실패'),
      )
      return
    }
    setItemCosts((prev) => [
      ...prev.filter((c) => c.item_name !== name.trim()),
      { item_name: name.trim(), unit_cost: unitCost, memo: null },
    ].sort((a, b) => a.item_name.localeCompare(b.item_name)))
    setPicked('')
    setCustomName('')
    setCost('')
  }

  const remove = async (itemName: string) => {
    if (!confirm(`'${itemName}' 기준단가를 삭제할까요?`)) return
    setBusyName(itemName)
    const res = await deleteSaekdongItemCost(itemName)
    setBusyName(null)
    if (!res.ok) { setError(res.error ?? '삭제 실패'); return }
    setItemCosts((prev) => prev.filter((c) => c.item_name !== itemName))
  }

  return (
    <div className="bg-white p-4" style={box}>
      <p className="text-[12px] font-bold" style={{ color: 'var(--nv-ink)' }}>
        품목 기준단가{' '}
        <span className="font-normal text-[11px]" style={{ color: 'var(--nv-stone)' }}>
          · 매입(지출)으로 잡지 않고 제품별 이익 계산에만 쓰는 개당 원가
        </span>
      </p>
      <p className="mt-0.5 mb-2.5 text-[11px]" style={{ color: 'var(--nv-stone)' }}>
        {productYear || '올해'}년 판매 제품에서 선택하면 판매수량으로 매출원가·이익이 자동
        계산됩니다. 실제 매입 기록이 있는 품목은 매입 평균단가가 우선 적용됩니다.
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        <select
          className={inputCls + ' w-52'}
          style={inputStyle}
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
        >
          <option value="">
            {products.length > 0 ? `제품 선택 (${productYear}년 판매)` : '제품 목록 불러오는 중...'}
          </option>
          {products.map((p) => {
            const hasCost = costKeys.has(normItemName(p.prodName))
            return (
              <option
                key={p.prodName}
                value={p.prodName}
                style={{ color: hasCost ? undefined : '#dc2626' }}
              >
                {p.prodName} · {p.qty}개 판매{hasCost ? '' : ' · 원가 미입력'}
              </option>
            )
          })}
          <option value={CUSTOM}>직접 입력 (미판매 품목)</option>
        </select>
        {picked === CUSTOM && (
          <input
            placeholder="품목명 직접 입력"
            className={inputCls + ' w-40'}
            style={inputStyle}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
        )}
        <input
          type="number"
          placeholder="개당 원가"
          className={inputCls + ' w-28'}
          style={inputStyle}
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
        <button
          type="button"
          onClick={add}
          disabled={saving}
          className="h-8 px-3 text-[12px] font-bold inline-flex items-center gap-1"
          style={{ backgroundColor: 'var(--nv-primary)', color: '#000', borderRadius: '2px' }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          등록
        </button>
      </div>

      {/* 자동 계산 미리보기 — 판매수량 × 단가 */}
      {preview && (
        <p
          className="mb-2.5 px-3 py-2 text-[12px] tabular-nums"
          style={{ backgroundColor: 'rgba(118,185,0,0.08)', borderRadius: '2px', color: 'var(--nv-ink)' }}
        >
          {productYear}년 판매 <b>{preview.qty}개</b> × {formatKRW(unitCost)} = 매출원가{' '}
          <b>{formatKRW(preview.estCogs)}</b> → 이익{' '}
          <b style={{ color: preview.profit >= 0 ? 'var(--nv-success-deep, #4a7c00)' : 'var(--nv-error)' }}>
            {formatKRW(preview.profit)} ({preview.margin.toFixed(1)}%)
          </b>
        </p>
      )}

      {itemCosts.length === 0 ? (
        <p className="text-[12px] italic" style={{ color: 'var(--nv-stone)' }}>
          등록된 기준단가가 없습니다. 같은 품목명을 다시 등록하면 수정됩니다.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {itemCosts.map((c) => {
            const pr = products.find(
              (p) => normItemName(p.prodName) === normItemName(c.item_name),
            )
            const estCogs = pr ? Math.round(c.unit_cost * pr.qty) : null
            return (
              <span
                key={c.item_name}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-[12px]"
                style={{ backgroundColor: 'var(--nv-surface-soft)', borderRadius: '2px' }}
              >
                <b style={{ color: 'var(--nv-ink)' }}>{c.item_name}</b>
                <span className="tabular-nums" style={{ color: 'var(--nv-mute)' }}>
                  {formatKRW(c.unit_cost)}/개
                </span>
                {estCogs != null && (
                  <span className="tabular-nums text-[11px]" style={{ color: 'var(--nv-stone)' }}>
                    · {pr!.qty}개 → 원가 {formatKRW(estCogs)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(c.item_name)}
                  disabled={busyName === c.item_name}
                  title="삭제"
                  style={{ color: 'var(--nv-stone)' }}
                >
                  {busyName === c.item_name ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════ 재고 현황 — 입고 · 판매 · 선물 · 남은 재고 ═══════════

function StockBlock({
  purchases, gifts, setGifts, setError,
}: {
  purchases: SaekdongPurchase[]
  gifts: SaekdongGift[]
  setGifts: React.Dispatch<React.SetStateAction<SaekdongGift[]>>
  setError: (m: string | null) => void
}) {
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [showGifts, setShowGifts] = useState(false)
  const [f, setF] = useState({ item: '', qty: '1', date: todayYmd(), memo: '' })
  const [soldMap, setSoldMap] = useState<Map<string, number>>(new Map())
  const [soldLoaded, setSoldLoaded] = useState(false)

  // 판매수량 = 온라인(아임웹) + 오프라인(일계표) — 페이지 공유 fetch 재사용
  useEffect(() => {
    Promise.all([
      fetchSharedSales<{ products?: { prodName: string; qty: number }[] }>(),
      fetchSharedOffline<{ products?: { prodName: string; qty: number }[] }>(),
    ])
      .then(([s, o]) => {
        const map = new Map<string, number>()
        for (const list of [s.products, o.products]) {
          for (const p of list ?? []) {
            const k = normItemName(p.prodName)
            map.set(k, (map.get(k) ?? 0) + (Number(p.qty) || 0))
          }
        }
        setSoldMap(map)
        setSoldLoaded(true)
      })
      .catch(() => setSoldLoaded(true))
  }, [])

  // 재고 행: 매입 또는 선물 기록이 있는 품목
  const rows = useMemo(() => {
    const stocked = new Map<string, { name: string; stocked: number; gifted: number }>()
    for (const p of purchases) {
      const k = normItemName(p.item_name)
      const cur = stocked.get(k) ?? { name: p.item_name, stocked: 0, gifted: 0 }
      cur.stocked += Number(p.qty) || 0
      stocked.set(k, cur)
    }
    for (const g of gifts) {
      const k = normItemName(g.item_name)
      const cur = stocked.get(k) ?? { name: g.item_name, stocked: 0, gifted: 0 }
      cur.gifted += Number(g.qty) || 0
      stocked.set(k, cur)
    }
    return [...stocked.entries()]
      .map(([k, v]) => {
        const sold = soldMap.get(k) ?? 0
        const remaining = v.stocked - sold - v.gifted
        return {
          key: k,
          name: v.name,
          stocked: v.stocked,
          sold,
          gifted: v.gifted,
          remaining,
          sellRate: v.stocked > 0 ? (sold / v.stocked) * 100 : null,
          giftRate: v.stocked > 0 ? (v.gifted / v.stocked) * 100 : null,
        }
      })
      .sort((a, b) => b.stocked - a.stocked)
  }, [purchases, gifts, soldMap])

  const addGift = async () => {
    const qty = Number(f.qty) || 0
    if (!f.item.trim() || qty <= 0) {
      setError('선물 품목과 수량을 입력하세요.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await addSaekdongGift({
      gift_date: f.date,
      item_name: f.item.trim(),
      qty,
      memo: f.memo.trim() || null,
    })
    setSaving(false)
    if (!res.ok) {
      setError(
        /find the table|does not exist/i.test(res.error ?? '')
          ? '선물 테이블이 없습니다 — supabase/migrations/2026-07-02_saekdong_gifts.sql 을 실행해 주세요.'
          : (res.error ?? '저장 실패'),
      )
      return
    }
    setGifts((prev) => [
      { id: Date.now(), gift_date: f.date, item_name: f.item.trim(), qty, memo: f.memo.trim() || null },
      ...prev,
    ])
    setF({ ...f, qty: '1', memo: '' })
  }

  const removeGift = async (id: number) => {
    if (!confirm('이 선물 기록을 삭제할까요? (재고가 다시 늘어납니다)')) return
    setBusyId(id)
    const res = await deleteSaekdongGift(id)
    setBusyId(null)
    if (!res.ok) { setError(res.error ?? '삭제 실패'); return }
    setGifts((prev) => prev.filter((g) => g.id !== id))
  }

  const itemOptions = [...new Set(purchases.map((p) => p.item_name))]

  return (
    <div className="bg-white p-4" style={box}>
      <p className="text-[12px] font-bold" style={{ color: 'var(--nv-ink)' }}>
        재고 현황{' '}
        <span className="font-normal text-[11px]" style={{ color: 'var(--nv-stone)' }}>
          · 남은 재고 = 입고(매입) − 판매(온라인+오프라인) − 선물 · 2026년 판매 기준
        </span>
      </p>

      {/* 선물(무료) 입력 */}
      <div className="mt-2.5 mb-3 flex flex-wrap items-center gap-2">
        <select
          className={inputCls + ' w-44'}
          style={inputStyle}
          value={f.item}
          onChange={(e) => setF({ ...f, item: e.target.value })}
        >
          <option value="">선물(무료) 품목 선택</option>
          {itemOptions.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="수량"
          className={inputCls + ' w-20'}
          style={inputStyle}
          value={f.qty}
          onChange={(e) => setF({ ...f, qty: e.target.value })}
        />
        <input
          type="date"
          className={inputCls + ' w-36'}
          style={inputStyle}
          value={f.date}
          onChange={(e) => setF({ ...f, date: e.target.value })}
        />
        <input
          placeholder="메모 (누구에게 등)"
          className={inputCls + ' flex-1 min-w-32'}
          style={inputStyle}
          value={f.memo}
          onChange={(e) => setF({ ...f, memo: e.target.value })}
        />
        <button
          type="button"
          onClick={addGift}
          disabled={saving}
          className="h-8 px-3 text-[12px] font-bold inline-flex items-center gap-1 shrink-0"
          style={{ backgroundColor: 'var(--nv-primary)', color: '#000', borderRadius: '2px' }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          선물 기록
        </button>
      </div>

      {/* 재고 표 */}
      {rows.length === 0 ? (
        <p className="text-[12px] italic" style={{ color: 'var(--nv-stone)' }}>
          매입을 입력하면 품목별 재고가 여기에 표시됩니다.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ minWidth: 640 }}>
            <thead>
              <tr className="text-left" style={{ color: 'var(--nv-stone)', borderBottom: '1px solid var(--nv-hairline)' }}>
                <th className="py-1.5 pr-2 font-medium">품목</th>
                <th className="pr-2 font-medium text-right">입고</th>
                <th className="pr-2 font-medium text-right">판매</th>
                <th className="pr-2 font-medium text-right">선물</th>
                <th className="pr-2 font-medium text-right">남은 재고</th>
                <th className="pr-2 font-medium text-right">판매율</th>
                <th className="font-medium text-right">선물율</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} style={{ borderBottom: '1px solid var(--nv-hairline)' }}>
                  <td className="py-1.5 pr-2 font-medium" style={{ color: 'var(--nv-ink)' }}>{r.name}</td>
                  <td className="pr-2 text-right tabular-nums">{r.stocked}</td>
                  <td className="pr-2 text-right tabular-nums">
                    {soldLoaded ? r.sold : <Loader2 className="w-3 h-3 animate-spin inline" />}
                  </td>
                  <td className="pr-2 text-right tabular-nums" style={{ color: r.gifted > 0 ? '#c2410c' : 'var(--nv-stone)' }}>
                    {r.gifted}
                  </td>
                  <td
                    className="pr-2 text-right tabular-nums font-bold"
                    style={{ color: r.remaining < 0 ? 'var(--nv-error)' : r.remaining <= 5 ? '#c2410c' : 'var(--nv-ink)' }}
                    title={r.remaining < 0 ? '재고가 음수 — 입고 수량 입력 누락 가능성' : undefined}
                  >
                    {r.remaining}
                    {r.remaining < 0 && ' ⚠'}
                  </td>
                  <td className="pr-2 text-right tabular-nums" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>
                    {r.sellRate != null ? `${r.sellRate.toFixed(0)}%` : '-'}
                  </td>
                  <td className="text-right tabular-nums" style={{ color: 'var(--nv-mute)' }}>
                    {r.giftRate != null ? `${r.giftRate.toFixed(0)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 선물 내역 (접이식) */}
      {gifts.length > 0 && (
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--nv-hairline)' }}>
          <button
            type="button"
            onClick={() => setShowGifts(!showGifts)}
            className="text-[11px] font-bold"
            style={{ color: 'var(--nv-mute)' }}
          >
            {showGifts ? '▾' : '▸'} 선물 내역 {gifts.length}건
          </button>
          {showGifts && (
            <div className="mt-1.5 space-y-1">
              {gifts.map((g) => (
                <div key={g.id} className="flex items-center gap-2 text-[12px]">
                  <span className="w-16 shrink-0 tabular-nums" style={{ color: 'var(--nv-stone)' }}>
                    {g.gift_date.slice(2)}
                  </span>
                  <span className="font-medium" style={{ color: 'var(--nv-ink)' }}>{g.item_name}</span>
                  <span className="tabular-nums" style={{ color: '#c2410c' }}>{g.qty}개</span>
                  <span className="flex-1 truncate" style={{ color: 'var(--nv-stone)' }}>{g.memo ?? ''}</span>
                  <button
                    type="button"
                    onClick={() => removeGift(g.id)}
                    disabled={busyId === g.id}
                    className="p-1 shrink-0"
                    title="삭제"
                    style={{ color: 'var(--nv-stone)' }}
                  >
                    {busyId === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
