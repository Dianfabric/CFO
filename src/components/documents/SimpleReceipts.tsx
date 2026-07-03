'use client'

/**
 * 간이영수증 대장 — 사진 업로드 + 항목 선택 + 변동비/고정비 처리.
 * 분기별 관리, 종소세·법인세 신고용 엑셀(날짜/상호/적요/금액) 다운로드.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ReceiptText, Loader2, Plus, Trash2, Download, Camera, ImageIcon,
} from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

const ITEM_OPTIONS = ['운송료', '퀵비', '주차·교통', '식대', '소모품', '접대비', '수선비', '기타']
const CUSTOM = '__custom__'

interface ReceiptRow {
  id: number
  receipt_date: string
  vendor: string
  item: string
  amount: number
  cost_type: 'variable' | 'fixed'
  memo: string | null
  imageUrl: string | null
}

function todayYmd(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

export default function SimpleReceipts() {
  const nowQ = Math.floor(new Date().getMonth() / 3) + 1
  const year = new Date().getFullYear()
  const [q, setQ] = useState(nowQ)
  const [rows, setRows] = useState<ReceiptRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [f, setF] = useState({
    date: todayYmd(),
    vendor: '',
    itemPick: ITEM_OPTIONS[0] as string,
    itemCustom: '',
    amount: '',
    cost_type: 'variable' as 'variable' | 'fixed',
  })

  const load = useCallback(async (quarter: number) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/receipts?year=${year}&q=${quarter}`)
      const j = await r.json()
      setRows(Array.isArray(j.receipts) ? j.receipts : [])
      setTotal(j.total ?? 0)
      setTableMissing(!!j.tableMissing)
    } catch {
      setError('조회 실패')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load(q) }, [q, load])

  const add = async () => {
    const item = f.itemPick === CUSTOM ? f.itemCustom.trim() : f.itemPick
    const amount = Number(f.amount) || 0
    if (!f.vendor.trim() || !item || amount <= 0) {
      setError('상호·항목·금액을 입력하세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('receipt_date', f.date)
      form.append('vendor', f.vendor.trim())
      form.append('item', item)
      form.append('amount', String(amount))
      form.append('cost_type', f.cost_type)
      const file = fileRef.current?.files?.[0]
      if (file) form.append('image', file)
      const r = await fetch('/api/receipts', { method: 'POST', body: form })
      const j = await r.json()
      if (!j.ok) { setError(j.error ?? '등록 실패'); return }
      setF({ ...f, vendor: '', amount: '' })
      setFileName('')
      if (fileRef.current) fileRef.current.value = ''
      // 등록한 분기로 이동해 새로고침
      const regQ = Math.floor((Number(f.date.slice(5, 7)) - 1) / 3) + 1
      if (regQ === q) await load(q)
      else setQ(regQ)
    } catch {
      setError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('이 영수증을 삭제할까요? (사진도 함께 삭제)')) return
    setBusyId(id)
    try {
      const r = await fetch(`/api/receipts?id=${id}`, { method: 'DELETE' })
      const j = await r.json()
      if (j.ok) setRows((prev) => prev.filter((x) => x.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <ReceiptText className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
          간이영수증 대장
          <span className="text-xs font-normal text-slate-400">
            · 사진 + 항목 분류 · 분기별 관리 · 신고용 엑셀 다운로드
          </span>
          <span className="ml-auto inline-flex overflow-hidden rounded border border-slate-200">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQ(n)}
                className="h-7 px-2.5 text-[11px] font-bold transition-colors"
                style={{
                  backgroundColor: q === n ? 'var(--nv-primary, #76b900)' : 'white',
                  color: q === n ? '#000' : '#64748b',
                }}
              >
                {n}분기
              </button>
            ))}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tableMissing ? (
          <p className="text-xs text-rose-600 bg-rose-50 rounded p-3">
            영수증 테이블이 없습니다 — <code>supabase/migrations/2026-07-03_simple_receipts.sql</code>{' '}
            을 실행해 주세요.
          </p>
        ) : (
          <>
            {error && <p className="text-xs text-rose-600 bg-rose-50 rounded p-2">⚠ {error}</p>}

            {/* 등록 폼 */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-8 px-2.5 inline-flex items-center gap-1.5 text-[12px] font-bold border rounded text-slate-600 hover:border-slate-400"
                title="영수증 사진 선택 (선택사항)"
              >
                <Camera className="w-3.5 h-3.5" />
                {fileName ? fileName.slice(0, 14) + (fileName.length > 14 ? '…' : '') : '사진'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              />
              <input
                type="date"
                className="h-8 px-2 text-[12px] border rounded outline-none"
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
              <input
                placeholder="상호 (예: ㈜일신항공해운)"
                className="h-8 px-2 text-[12px] border rounded outline-none w-44"
                value={f.vendor}
                onChange={(e) => setF({ ...f, vendor: e.target.value })}
              />
              <select
                className="h-8 px-1.5 text-[12px] border rounded outline-none"
                value={f.itemPick}
                onChange={(e) => setF({ ...f, itemPick: e.target.value })}
              >
                {ITEM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                <option value={CUSTOM}>직접 입력</option>
              </select>
              {f.itemPick === CUSTOM && (
                <input
                  placeholder="항목명"
                  className="h-8 px-2 text-[12px] border rounded outline-none w-24"
                  value={f.itemCustom}
                  onChange={(e) => setF({ ...f, itemCustom: e.target.value })}
                />
              )}
              <input
                type="number"
                placeholder="금액"
                className="h-8 px-2 text-[12px] border rounded outline-none w-24"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
              />
              <span className="inline-flex overflow-hidden rounded border border-slate-200">
                {(
                  [
                    { v: 'variable', label: '변동비' },
                    { v: 'fixed', label: '고정비' },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setF({ ...f, cost_type: o.v })}
                    className="h-8 px-2.5 text-[11px] font-bold"
                    style={{
                      backgroundColor: f.cost_type === o.v ? 'var(--nv-primary, #76b900)' : 'white',
                      color: f.cost_type === o.v ? '#000' : '#64748b',
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </span>
              <button
                type="button"
                onClick={add}
                disabled={saving}
                className="h-8 px-3 text-[12px] font-bold inline-flex items-center gap-1"
                style={{ backgroundColor: 'var(--nv-primary, #76b900)', color: '#000', borderRadius: '4px' }}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                등록
              </button>
            </div>

            {/* 분기 목록 */}
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold text-slate-700">
                {year}년 {q}분기 · {rows.length}건 ·{' '}
                <span className="tabular-nums">{formatKRW(total)}</span>
              </p>
              <a
                href={`/api/receipts/export?year=${year}&q=${q}`}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-bold border rounded text-slate-600 hover:border-slate-400"
                title="이 분기 엑셀 다운로드 (신고용 양식)"
              >
                <Download className="w-3.5 h-3.5" />
                엑셀
              </a>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400 py-3 text-center">
                <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
                불러오는 중...
              </p>
            ) : rows.length === 0 ? (
              <p className="text-[12px] italic text-slate-400 py-1">
                이 분기 영수증이 없습니다. 사진과 함께 등록해 보세요.
              </p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-[12px]">
                    <span className="w-12 shrink-0 tabular-nums text-slate-400">
                      {r.receipt_date.slice(5).replace('-', '.')}
                    </span>
                    {r.imageUrl ? (
                      <a
                        href={r.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-blue-500 hover:text-blue-700"
                        title="영수증 사진 보기"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{r.vendor}</span>
                    <span className="shrink-0 text-slate-500">{r.item}</span>
                    <span
                      className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: r.cost_type === 'fixed' ? '#eef2ff' : 'rgba(118,185,0,0.12)',
                        color: r.cost_type === 'fixed' ? '#4338ca' : '#4a7c00',
                        borderRadius: '2px',
                      }}
                    >
                      {r.cost_type === 'fixed' ? '고정' : '변동'}
                    </span>
                    <span className="shrink-0 tabular-nums font-bold text-slate-900">
                      {formatKRW(r.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      disabled={busyId === r.id}
                      className="p-1 shrink-0 text-slate-300 hover:text-slate-500"
                      title="삭제"
                    >
                      {busyId === r.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-400">
              간이영수증은 부가세 공제 대상이 아니라 종소세·법인세 경비로 관리됩니다. 연간 전체
              다운로드는{' '}
              <a href={`/api/receipts/export?year=${year}`} className="underline">
                여기
              </a>
              .
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
