'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface PreviewSummary {
  dateRange: { from: string; to: string } | null
  sheetCount: number
  sales: { add: number; delete: number; keep: number; addAmount: number; deleteAmount: number }
  deposits: { add: number; delete: number; keep: number; addAmount: number; deleteAmount: number }
  expenses: { add: number; keep: number }
  purchases: { add: number; keep: number }
}

interface PreviewDetail {
  salesAdd: { date: string; client: string; amount: number }[]
  salesDelete: { date: string; client: string; amount: number }[]
  depositsAdd: { date: string; client: string; amount: number }[]
  depositsDelete: { date: string; client: string; amount: number }[]
  expensesAdd: { date: string; description: string; amount: number }[]
  purchasesAdd: { date: string; client: string; amount: number }[]
}

type State =
  | { kind: 'loading' }
  | { kind: 'preview'; summary: PreviewSummary; detail: PreviewDetail }
  | { kind: 'applying' }
  | { kind: 'done'; summary: PreviewSummary; result: { added: number; deleted: number; errors: string[] } }
  | { kind: 'error'; message: string }

export default function LedgerSyncDialog({
  file, open, onClose, onComplete,
}: {
  file: File | null
  open: boolean
  onClose: () => void
  onComplete: () => void
}) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [showDetail, setShowDetail] = useState<keyof PreviewDetail | null>(null)

  useEffect(() => {
    if (!file || !open) return
    setState({ kind: 'loading' })
    const form = new FormData()
    form.append('file', file)
    form.append('mode', 'preview')
    fetch('/api/upload/sales/sync', { method: 'POST', body: form })
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? '미리보기 실패')
        return j
      })
      .then(j => setState({ kind: 'preview', summary: j.summary, detail: j.detail }))
      .catch(e => setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }))
  }, [file, open])

  const handleApply = async () => {
    if (!file) return
    setState({ kind: 'applying' })
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('mode', 'apply')
      const r = await fetch('/api/upload/sales/sync', { method: 'POST', body: form })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? '적용 실패')
      setState({ kind: 'done', summary: j.summary, result: j.result })
      onComplete()
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>일계표 동기화 미리보기</DialogTitle>
        </DialogHeader>

        {state.kind === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-3 text-slate-500">일계표 분석 중…</span>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="py-8 text-center text-red-600">
            <XCircle className="w-10 h-10 mx-auto mb-2" />
            <p className="font-medium">오류</p>
            <p className="text-sm text-slate-500 mt-1">{state.message}</p>
          </div>
        )}

        {state.kind === 'preview' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-500">
              📅 기간: <strong>{state.summary.dateRange?.from} ~ {state.summary.dateRange?.to}</strong> ({state.summary.sheetCount}개 시트)
            </div>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded p-3 text-amber-800">
              ⚠️ 위 기간 외의 데이터는 건드리지 않습니다. 일계표 출처가 아닌 데이터(수동 입력/이월 보정/선수금)도 보호됩니다.
            </div>

            {/* 매출 */}
            <SyncRow
              label="매출"
              color="red"
              add={state.summary.sales.add}
              addAmount={state.summary.sales.addAmount}
              del={state.summary.sales.delete}
              delAmount={state.summary.sales.deleteAmount}
              keep={state.summary.sales.keep}
              onShowAdd={state.detail.salesAdd.length ? () => setShowDetail('salesAdd') : undefined}
              onShowDelete={state.detail.salesDelete.length ? () => setShowDetail('salesDelete') : undefined}
            />

            {/* 입금 */}
            <SyncRow
              label="입금"
              color="blue"
              add={state.summary.deposits.add}
              addAmount={state.summary.deposits.addAmount}
              del={state.summary.deposits.delete}
              delAmount={state.summary.deposits.deleteAmount}
              keep={state.summary.deposits.keep}
              onShowAdd={state.detail.depositsAdd.length ? () => setShowDetail('depositsAdd') : undefined}
              onShowDelete={state.detail.depositsDelete.length ? () => setShowDetail('depositsDelete') : undefined}
            />

            {/* 경비 (추가만) */}
            <div className="bg-slate-50 rounded p-3 text-sm">
              <div className="font-medium">경비</div>
              <div className="text-xs text-slate-500 mt-1">
                추가 <strong className="text-green-700">{state.summary.expenses.add}건</strong> /
                유지 {state.summary.expenses.keep}건 (자동 삭제 안 함)
              </div>
            </div>

            {/* 매입 (추가만) */}
            <div className="bg-slate-50 rounded p-3 text-sm">
              <div className="font-medium">매입</div>
              <div className="text-xs text-slate-500 mt-1">
                추가 <strong className="text-green-700">{state.summary.purchases.add}건</strong> /
                유지 {state.summary.purchases.keep}건 (자동 삭제 안 함)
              </div>
            </div>

            {/* 상세 보기 */}
            {showDetail && (
              <DetailList
                title={DETAIL_TITLES[showDetail]}
                items={state.detail[showDetail]}
                onClose={() => setShowDetail(null)}
              />
            )}

            {/* 버튼 */}
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" className="flex-1" onClick={onClose}>취소</Button>
              <Button className="flex-1" onClick={handleApply}>
                {state.summary.sales.add + state.summary.sales.delete + state.summary.deposits.add + state.summary.deposits.delete > 0
                  ? '모두 적용'
                  : '변경 없음 (닫기)'}
              </Button>
            </div>
          </div>
        )}

        {state.kind === 'applying' && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-green-500" />
            <span className="ml-3 text-slate-500">DB에 적용 중… (수십초 걸릴 수 있음)</span>
          </div>
        )}

        {state.kind === 'done' && (
          <div className="space-y-3">
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="font-medium text-slate-900">동기화 완료</p>
              <p className="text-sm text-slate-500 mt-1">
                추가 {state.result.added}건 / 삭제 {state.result.deleted}건
              </p>
            </div>
            {state.result.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  실패 {state.result.errors.length}건
                </div>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {state.result.errors.slice(0, 10).map((e, i) => <li key={i}>• {e}</li>)}
                  {state.result.errors.length > 10 && <li>• … 외 {state.result.errors.length - 10}건</li>}
                </ul>
              </div>
            )}
            <Button className="w-full" onClick={onClose}>닫기</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SyncRow({
  label, color, add, addAmount, del, delAmount, keep, onShowAdd, onShowDelete,
}: {
  label: string; color: 'red' | 'blue'; add: number; addAmount: number; del: number; delAmount: number; keep: number
  onShowAdd?: () => void; onShowDelete?: () => void
}) {
  return (
    <div className={`rounded p-3 text-sm border ${color === 'red' ? 'border-red-200 bg-red-50/40' : 'border-blue-200 bg-blue-50/40'}`}>
      <div className="font-medium">{label}</div>
      <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-3">
        <span>
          🆕 추가 <strong className="text-green-700">{add}건</strong> {addAmount > 0 && <span className="text-slate-500">/ {formatKRW(addAmount)}</span>}
          {onShowAdd && <button onClick={onShowAdd} className="ml-1 text-blue-600 hover:underline">[상세]</button>}
        </span>
        <span>
          🗑 삭제 <strong className="text-red-700">{del}건</strong> {delAmount > 0 && <span className="text-slate-500">/ {formatKRW(delAmount)}</span>}
          {onShowDelete && <button onClick={onShowDelete} className="ml-1 text-blue-600 hover:underline">[상세]</button>}
        </span>
        <span>✓ 유지 {keep}건</span>
      </div>
    </div>
  )
}

const DETAIL_TITLES: Record<keyof PreviewDetail, string> = {
  salesAdd: '추가될 매출',
  salesDelete: '삭제될 매출 (일계표에 없음)',
  depositsAdd: '추가될 입금',
  depositsDelete: '삭제될 입금 (일계표에 없음)',
  expensesAdd: '추가될 경비',
  purchasesAdd: '추가될 매입',
}

function DetailList({
  title, items, onClose,
}: {
  title: string
  items: Array<{ date: string; client?: string; description?: string; amount: number }>
  onClose: () => void
}) {
  return (
    <div className="bg-white border border-slate-300 rounded p-3 max-h-64 overflow-y-auto text-xs">
      <div className="flex items-center justify-between mb-2">
        <strong>{title} ({items.length}건)</strong>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
      </div>
      <table className="w-full">
        <thead className="text-slate-500">
          <tr>
            <th className="text-left py-1">날짜</th>
            <th className="text-left py-1">거래처/내용</th>
            <th className="text-right py-1">금액</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="py-1 text-slate-600">{it.date}</td>
              <td className="py-1 text-slate-700">{it.client ?? it.description ?? ''}</td>
              <td className="py-1 text-right font-medium">{formatKRW(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
