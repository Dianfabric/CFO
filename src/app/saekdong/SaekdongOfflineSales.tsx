'use client'

/**
 * 색동 오프라인 매출 섹션 — 경영 계기판 일계표 업로드에서 색동 품목만 집계.
 * 온라인 쇼핑몰 매출과 동일한 형식(오늘/이번주/이번달 + 월별 추이 + 올해 제품별)
 * + 입금 완료 / 세금계산서 발행 완료 현황 + 미입금·미발행 내역.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Store, RefreshCw, Loader2, Banknote, FileText, CheckCircle2, Undo2 } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { fetchSharedOffline } from './sharedFetch'
import { setSaekdongOfflineOverride } from './actions'

interface MonthlyPoint { month: string; revenue: number; orders: number }
interface ProductSales { prodName: string; revenue: number; qty: number }
interface StatusItem {
  id: string; date: string; client: string; productNames: string[]; amount: number
  paid: boolean; issued: boolean
  manualPaid?: boolean; manualIssued?: boolean
}
interface OfflineData {
  today: number; thisWeek: number; thisMonth: number
  monthly: MonthlyPoint[]; products: ProductSales[]; productYear: string
  paidAmount: number; unpaidAmount: number; issuedAmount: number; unissuedAmount: number
  unpaid: StatusItem[]; unissued: StatusItem[]
  manualPaid: StatusItem[]; manualIssued: StatusItem[]
  orderCount: number; fetchedAt: string; error?: string
}

export default function SaekdongOfflineSales() {
  const [data, setData] = useState<OfflineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [ovError, setOvError] = useState<string | null>(null)

  const fetchData = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    try {
      const j = await fetchSharedOffline<OfflineData>(force)
      setData(j)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // 수동 완료 처리 / 되돌리기 (자동 대사가 서류를 못 찾은 경우)
  const setOverride = useCallback(
    async (txId: string, patch: { paid?: boolean; issued?: boolean }) => {
      setBusyId(txId)
      setOvError(null)
      const res = await setSaekdongOfflineOverride(txId, patch)
      if (!res.ok) {
        setOvError(res.error ?? '처리 실패')
      } else {
        await fetchData(true) // 서버 재집계 반영
      }
      setBusyId(null)
    },
    [fetchData],
  )

  if (loading) {
    return (
      <div
        className="bg-white p-6 text-center text-[12px]"
        style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px', color: 'var(--nv-mute)' }}
      >
        <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
        색동 오프라인 매출 불러오는 중...
      </div>
    )
  }

  if (!data || data.error) {
    return (
      <div
        className="p-4 text-[12px]"
        style={{ border: '1px solid var(--nv-error)', backgroundColor: '#fef2f2', color: 'var(--nv-error)', borderRadius: '2px' }}
      >
        ⚠ 오프라인 매출 조회 실패{data?.error ? `: ${data.error}` : ''}
      </div>
    )
  }

  const chartData = data.monthly.map((m) => {
    const [y, mo] = m.month.split('-')
    return { label: `${y.slice(2)}.${Number(mo)}`, 매출: m.revenue }
  })
  const maxProdRevenue = Math.max(1, ...data.products.map((p) => p.revenue))

  const paidTotal = data.paidAmount + data.unpaidAmount
  const issuedTotal = data.issuedAmount + data.unissuedAmount
  const paidRate = paidTotal > 0 ? (data.paidAmount / paidTotal) * 100 : 0
  const issuedRate = issuedTotal > 0 ? (data.issuedAmount / issuedTotal) * 100 : 0

  return (
    <div className="space-y-4">
      {/* 헤더 + 새로고침 */}
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />
        <h2 className="text-base font-semibold" style={{ color: 'var(--nv-ink)' }}>
          색동 오프라인 매출
        </h2>
        <span className="text-xs" style={{ color: 'var(--nv-stone)' }}>
          · 일계표 업로드 · 품목명 매칭
        </span>
        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="ml-auto h-7 px-2 text-[11px] font-bold inline-flex items-center gap-1 bg-white transition-colors"
          style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px', color: 'var(--nv-mute)' }}
          title="지금 다시 불러오기"
        >
          {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          새로고침
        </button>
      </div>

      {/* 오늘 / 이번주 / 이번달 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SalesCard label="오늘 매출" value={data.today} accent />
        <SalesCard label="이번 주 매출" value={data.thisWeek} />
        <SalesCard label="이번 달 매출" value={data.thisMonth} accent />
      </div>

      {/* 월별 추이 + 올해 제품별 — 한 줄 (2열) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="bg-white p-4" style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}>
          <h3 className="text-[13px] font-bold mb-3" style={{ color: 'var(--nv-ink)' }}>
            월별 매출 추이{' '}
            <span className="text-[11px] font-normal" style={{ color: 'var(--nv-stone)' }}>· 최근 12개월</span>
          </h3>
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#999' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#999' }}
                  tickFormatter={(v: number) => (v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`)}
                  width={44}
                />
                <Tooltip
                  formatter={(v) => formatKRW(Number(v))}
                  labelStyle={{ fontSize: 11 }}
                  contentStyle={{ fontSize: 12, borderRadius: 2 }}
                />
                <Bar dataKey="매출" fill="#76b900" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4" style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}>
          <h3 className="text-[13px] font-bold mb-3" style={{ color: 'var(--nv-ink)' }}>
            {data.productYear}년 제품 매출{' '}
            <span className="text-[11px] font-normal" style={{ color: 'var(--nv-stone)' }}>· 올해 오프라인 총합</span>
          </h3>
          {data.products.length === 0 ? (
            <p className="text-[12px] italic" style={{ color: 'var(--nv-stone)' }}>
              {data.productYear}년 오프라인 색동 매출이 없습니다.
            </p>
          ) : (
            <div className="space-y-1.5">
              {data.products.map((p) => {
                const rate = (p.revenue / maxProdRevenue) * 100
                return (
                  <div key={p.prodName} className="flex items-center gap-2 text-[12px]">
                    <span className="w-24 shrink-0 truncate font-medium" style={{ color: 'var(--nv-ink)' }} title={p.prodName}>
                      {p.prodName}
                    </span>
                    <div className="flex-1 h-4 relative overflow-hidden" style={{ backgroundColor: 'var(--nv-surface-soft)', borderRadius: '2px' }}>
                      <div className="h-full" style={{ width: `${rate}%`, backgroundColor: 'var(--nv-primary)' }} />
                    </div>
                    <span className="w-20 shrink-0 text-right tabular-nums font-bold" style={{ color: 'var(--nv-ink)' }}>
                      {formatKRW(p.revenue)}
                    </span>
                    <span className="w-10 shrink-0 text-right tabular-nums" style={{ color: 'var(--nv-stone)' }}>
                      {p.qty}개
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 입금 / 발행 현황 요약 — 한 줄 (2열) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <StatusSummary
          icon={<Banknote className="w-4 h-4" />}
          title="입금 현황"
          rate={paidRate}
          doneLabel="입금 완료"
          doneAmount={data.paidAmount}
          pendingLabel="미입금"
          pendingAmount={data.unpaidAmount}
        />
        <StatusSummary
          icon={<FileText className="w-4 h-4" />}
          title="세금계산서 발행 현황"
          rate={issuedRate}
          doneLabel="발행 완료"
          doneAmount={data.issuedAmount}
          pendingLabel="미발행"
          pendingAmount={data.unissuedAmount}
        />
      </div>

      {/* 수동 처리 오류 안내 */}
      {ovError && (
        <div
          className="px-3 py-2 text-[12px]"
          style={{ border: '1px solid var(--nv-error)', backgroundColor: '#fef2f2', color: 'var(--nv-error)', borderRadius: '2px' }}
        >
          ⚠ {ovError}
        </div>
      )}

      {/* 미입금 / 미발행 내역 — 한 줄 (2열), 수동 완료 처리 가능 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <StatusList
          title="미입금 내역"
          items={data.unpaid}
          manualItems={data.manualPaid ?? []}
          busyId={busyId}
          completeLabel="입금 완료 처리"
          onComplete={(id) => setOverride(id, { paid: true })}
          onUndo={(id) => setOverride(id, { paid: false })}
        />
        <StatusList
          title="미발행 내역"
          items={data.unissued}
          manualItems={data.manualIssued ?? []}
          busyId={busyId}
          completeLabel="발행 완료 처리"
          onComplete={(id) => setOverride(id, { issued: true })}
          onUndo={(id) => setOverride(id, { issued: false })}
        />
      </div>

      <p className="text-[10px] text-right" style={{ color: 'var(--nv-stone)' }}>
        갱신: {new Date(data.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · 색동 거래 {data.orderCount}건
      </p>
    </div>
  )
}

function SalesCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-white p-4" style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--nv-mute)' }}>
        {label}
      </p>
      <p className="mt-2 text-[24px] font-bold tabular-nums leading-none" style={{ color: accent ? 'var(--nv-primary)' : 'var(--nv-ink)' }}>
        {formatKRW(value)}
      </p>
    </div>
  )
}

function StatusSummary({
  icon, title, rate, doneLabel, doneAmount, pendingLabel, pendingAmount,
}: {
  icon: React.ReactNode; title: string; rate: number
  doneLabel: string; doneAmount: number; pendingLabel: string; pendingAmount: number
}) {
  return (
    <div className="bg-white p-4" style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: 'var(--nv-ink)' }}>
        {icon}
        <h3 className="text-[13px] font-bold">{title}</h3>
        <span className="ml-auto text-[13px] font-bold tabular-nums" style={{ color: 'var(--nv-primary)' }}>
          {rate.toFixed(0)}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden mb-2.5" style={{ backgroundColor: 'var(--nv-surface-soft)', borderRadius: '9999px' }}>
        <div className="h-full" style={{ width: `${rate}%`, backgroundColor: 'var(--nv-primary)', borderRadius: '9999px' }} />
      </div>
      <div className="flex items-center justify-between text-[12px]">
        <span style={{ color: 'var(--nv-mute)' }}>{doneLabel}</span>
        <span className="tabular-nums font-bold" style={{ color: 'var(--nv-ink)' }}>{formatKRW(doneAmount)}</span>
      </div>
      <div className="flex items-center justify-between text-[12px] mt-0.5">
        <span style={{ color: 'var(--nv-error)' }}>{pendingLabel}</span>
        <span className="tabular-nums font-bold" style={{ color: 'var(--nv-error)' }}>{formatKRW(pendingAmount)}</span>
      </div>
    </div>
  )
}

function StatusList({
  title, items, manualItems, busyId, completeLabel, onComplete, onUndo,
}: {
  title: string
  items: StatusItem[]
  manualItems: StatusItem[]
  busyId: string | null
  completeLabel: string
  onComplete: (id: string) => void
  onUndo: (id: string) => void
}) {
  const total = items.reduce((s, it) => s + it.amount, 0)
  return (
    <div className="bg-white p-4" style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-bold" style={{ color: 'var(--nv-ink)' }}>
          {title}{' '}
          <span className="text-[11px] font-normal" style={{ color: 'var(--nv-stone)' }}>· {items.length}건</span>
        </h3>
        {items.length > 0 && (
          <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--nv-error)' }}>
            {formatKRW(total)}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>
          모두 완료되었습니다.
        </p>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-1.5">
          {items.map((it) => (
            <div key={it.id} className="flex items-start gap-2 text-[12px]">
              <span className="w-14 shrink-0 tabular-nums" style={{ color: 'var(--nv-stone)' }}>
                {it.date.slice(5)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate" style={{ color: 'var(--nv-ink)' }} title={it.client}>
                  {it.client}
                </div>
                <div className="truncate" style={{ color: 'var(--nv-mute)' }} title={it.productNames.join(', ')}>
                  {it.productNames.join(', ')}
                </div>
              </div>
              <span className="shrink-0 text-right tabular-nums font-bold" style={{ color: 'var(--nv-error)' }}>
                {formatKRW(it.amount)}
              </span>
              {/* 수동 완료 처리 — 자동 대사가 서류를 못 찾은 경우 */}
              <button
                type="button"
                onClick={() => onComplete(it.id)}
                disabled={busyId === it.id}
                className="shrink-0 p-1 transition-colors"
                title={`${completeLabel} (자동 매칭이 서류를 못 찾은 경우 수동 처리)`}
                style={{ color: 'var(--nv-stone)' }}
              >
                {busyId === it.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 hover:stroke-[#76b900]" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 수동 완료 처리된 내역 — 되돌리기 가능 */}
      {manualItems.length > 0 && (
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--nv-hairline)' }}>
          <p className="mb-1.5 text-[11px] font-bold" style={{ color: 'var(--nv-mute)' }}>
            수동 완료 처리 {manualItems.length}건
          </p>
          <div className="space-y-1">
            {manualItems.map((it) => (
              <div key={it.id} className="flex items-center gap-2 text-[12px]" style={{ opacity: 0.75 }}>
                <span className="w-14 shrink-0 tabular-nums" style={{ color: 'var(--nv-stone)' }}>
                  {it.date.slice(5)}
                </span>
                <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--nv-mute)' }}>
                  {it.client} · {it.productNames.join(', ')}
                </span>
                <span className="shrink-0 tabular-nums font-bold" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>
                  {formatKRW(it.amount)} ✓
                </span>
                <button
                  type="button"
                  onClick={() => onUndo(it.id)}
                  disabled={busyId === it.id}
                  className="shrink-0 p-1"
                  title="되돌리기 (자동 판정으로 복귀)"
                  style={{ color: 'var(--nv-stone)' }}
                >
                  {busyId === it.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Undo2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
