'use client'

/**
 * 디안 원단 쇼핑몰 매출 (아임웹 2호점) — 색동 쇼핑몰 매출과 동일 방식.
 * 오늘/이번주/이번달/올해 카드 + 월별 추이 + 올해 제품별.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Store, RefreshCw, Loader2 } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { fetchSharedDianShop } from '@/app/saekdong/sharedFetch'

interface SalesData {
  today: number
  thisWeek: number
  thisMonth: number
  thisYear: number
  monthly: { month: string; revenue: number }[]
  products: { prodName: string; revenue: number; qty: number }[]
  productYear: string
  orderCount: number
  fetchedAt: string
  error?: string
}

export default function DianShopSales() {
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    try {
      // 경영지표(DianOverview)와 같은 요청 공유 — 페이지당 1회
      setData(await fetchSharedDianShop<SalesData>(force))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="bg-white p-6 text-center text-[12px]"
        style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px', color: '#64748b' }}>
        <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
        디안 쇼핑몰 매출 불러오는 중... (첫 조회는 1분 정도)
      </div>
    )
  }
  if (!data || data.error) {
    return (
      <div className="p-4 text-[12px]"
        style={{ border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '2px' }}>
        ⚠ 디안 쇼핑몰 매출 조회 실패{data?.error ? `: ${data.error}` : ''}
      </div>
    )
  }

  const chartData = data.monthly.map((m) => {
    const [y, mo] = m.month.split('-')
    return { label: `${y.slice(2)}.${Number(mo)}`, 매출: m.revenue }
  })
  const maxProd = Math.max(1, ...data.products.map((p) => p.revenue))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h2 className="text-base font-semibold text-slate-900">디안 쇼핑몰 매출</h2>
        <span className="text-xs text-slate-400">· 아임웹 실시간 (원단몰)</span>
        <button type="button" onClick={() => fetchData(true)} disabled={refreshing}
          className="ml-auto h-7 px-2 text-[11px] font-bold inline-flex items-center gap-1 bg-white border rounded text-slate-500">
          {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            { label: '오늘 매출', v: data.today, accent: true },
            { label: '이번 주 매출', v: data.thisWeek, accent: false },
            { label: '이번 달 매출', v: data.thisMonth, accent: false },
            { label: `${data.productYear}년 매출`, v: data.thisYear, accent: true },
          ] as const
        ).map((c) => (
          <div key={c.label} className="bg-white p-4"
            style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{c.label}</p>
            <p className="mt-2 text-[24px] font-bold tabular-nums leading-none"
              style={{ color: c.accent ? 'var(--nv-primary, #76b900)' : '#0f172a' }}>
              {formatKRW(c.v)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="bg-white p-4" style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}>
          <h3 className="text-[13px] font-bold mb-3 text-slate-900">
            월별 매출 추이 <span className="text-[11px] font-normal text-slate-400">· 최근 12개월</span>
          </h3>
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#999' }} />
                <YAxis tick={{ fontSize: 10, fill: '#999' }}
                  tickFormatter={(v: number) => (v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`)} width={44} />
                <Tooltip formatter={(v) => formatKRW(Number(v))} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                <Bar dataKey="매출" fill="#76b900" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4" style={{ border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}>
          <h3 className="text-[13px] font-bold mb-3 text-slate-900">
            {data.productYear}년 제품 매출 <span className="text-[11px] font-normal text-slate-400">· 올해 주문 총합</span>
          </h3>
          {data.products.length === 0 ? (
            <p className="text-[12px] italic text-slate-400">{data.productYear}년 제품 매출 데이터가 없습니다.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {data.products.slice(0, 12).map((p) => (
                <div key={p.prodName} className="flex items-center gap-2 text-[12px]">
                  <span className="w-28 shrink-0 truncate font-medium text-slate-800" title={p.prodName}>{p.prodName}</span>
                  <div className="flex-1 h-4 relative overflow-hidden" style={{ backgroundColor: '#f1f5f9', borderRadius: '2px' }}>
                    <div className="h-full" style={{ width: `${(p.revenue / maxProd) * 100}%`, backgroundColor: 'var(--nv-primary, #76b900)' }} />
                  </div>
                  <span className="w-20 shrink-0 text-right tabular-nums font-bold text-slate-900">{formatKRW(p.revenue)}</span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-slate-400">{p.qty}개</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-right text-slate-400">
        갱신: {new Date(data.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · 총 {data.orderCount}건
      </p>
    </div>
  )
}
