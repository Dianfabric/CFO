'use client'

/**
 * 세금 준비 (분기) — 부가세 예상 + 미발행/미수취 파악.
 *
 * 매출세액(매출 계산서) − 매입세액(매입 계산서) = 예상 부가세(근사).
 * 카드매입·현금영수증 등 기타 매입세액은 영수증 자료 연동 후 반영 예정.
 */
import { useCallback, useEffect, useState } from 'react'
import { Receipt, Loader2, AlertTriangle } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

const box: React.CSSProperties = { border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }

interface TxLite { id: string; date: string; client: string; amount: number }
interface TaxPrepData {
  year: number
  q: number
  range: { start: string; end: string }
  salesVat: number
  salesSupply: number
  salesInvoiceCount: number
  purchaseVat: number
  purchaseSupply: number
  purchaseInvoiceCount: number
  purchTableMissing?: boolean
  estVat: number
  unissued: { count: number; sum: number; top: TxLite[] }
  unreceived: { count: number; sum: number; top: TxLite[] }
  error?: string
}

export default function TaxPrep() {
  const nowQ = Math.floor(new Date().getMonth() / 3) + 1
  const year = new Date().getFullYear()
  const [q, setQ] = useState(nowQ)
  const [data, setData] = useState<TaxPrepData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (quarter: number) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/tax-prep?year=${year}&q=${quarter}`)
      setData(await r.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load(q) }, [q, load])

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 flex-wrap">
        <Receipt className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h2 className="text-base font-semibold text-slate-900">세금 준비 — 부가세 (분기)</h2>
        <div className="ml-auto inline-flex overflow-hidden rounded-sm border border-slate-200">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQ(n)}
              disabled={n > nowQ}
              className="h-8 px-3.5 text-[12px] font-bold transition-colors disabled:opacity-30"
              style={{
                backgroundColor: q === n ? 'var(--nv-primary, #76b900)' : 'white',
                color: q === n ? '#000' : '#64748b',
              }}
            >
              {n}분기
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        {year}년 {q}분기 {data?.range ? `(${data.range.start} ~ ${data.range.end})` : ''} · 세금계산서
        기준 근사치 — 카드매입·현금영수증 등은 영수증 자료 연동 후 반영, 신고 전 세무사 확인 필수
      </p>

      {loading ? (
        <div className="bg-white p-5 text-center text-[12px] text-slate-400" style={box}>
          <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
          집계 중...
        </div>
      ) : !data || data.error ? (
        <div className="bg-white p-4 text-[12px] text-rose-600" style={box}>
          ⚠ 조회 실패{data?.error ? `: ${data.error}` : ''}
        </div>
      ) : (
        <>
          {/* 부가세 3카드 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-3">
            <div className="bg-white p-4" style={box}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                매출세액 <span className="normal-case">· 계산서 {data.salesInvoiceCount}건</span>
              </p>
              <p className="mt-2 text-[22px] font-bold tabular-nums leading-none text-slate-900">
                {formatKRW(data.salesVat)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400 tabular-nums">공급가 {formatKRW(data.salesSupply)}</p>
            </div>
            <div className="bg-white p-4" style={box}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                매입세액 <span className="normal-case">· 계산서 {data.purchaseInvoiceCount}건</span>
              </p>
              <p className="mt-2 text-[22px] font-bold tabular-nums leading-none text-slate-900">
                {formatKRW(data.purchaseVat)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                {data.purchTableMissing
                  ? '매입 계산서 미연동 — SQL 실행 후 업로드'
                  : `공급가 ${formatKRW(data.purchaseSupply)}`}
              </p>
            </div>
            <div className="bg-white p-4" style={{ ...box, borderColor: 'var(--nv-primary, #76b900)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                예상 부가세 (근사)
              </p>
              <p
                className="mt-2 text-[22px] font-bold tabular-nums leading-none"
                style={{ color: data.estVat >= 0 ? 'var(--nv-success-deep, #4a7c00)' : '#2563eb' }}
              >
                {formatKRW(data.estVat)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">매출세액 − 매입세액{data.estVat < 0 ? ' (환급 예상)' : ''}</p>
            </div>
          </div>

          {/* 미발행 / 미수취 */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <MissList
              title="미발행 의심 (매출)"
              hint="분기 매출 중 계산서 확인 안 된 거래 — 대사 센터 제안도 함께 확인"
              data={data.unissued}
            />
            <MissList
              title="미수취 의심 (매입)"
              hint={
                data.purchaseInvoiceCount === 0
                  ? '매입 세금계산서 목록을 업로드하면 정확해집니다'
                  : '분기 매입 중 매입 계산서 매칭 안 된 거래'
              }
              data={data.unreceived}
            />
          </div>
        </>
      )}
    </div>
  )
}

function MissList({
  title, hint, data,
}: {
  title: string
  hint: string
  data: { count: number; sum: number; top: TxLite[] }
}) {
  return (
    <div className="bg-white p-4" style={box}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[12px] font-bold text-slate-800">
          {data.count > 0 && <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-amber-500" />}
          {title}{' '}
          <span className="font-normal text-[11px] text-slate-400">· {data.count}건</span>
        </p>
        {data.count > 0 && (
          <span className="text-[12px] font-bold tabular-nums" style={{ color: '#c2410c' }}>
            {formatKRW(data.sum)}
          </span>
        )}
      </div>
      <p className="mb-2 text-[10px] text-slate-400">{hint}</p>
      {data.count === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>
          누락 의심 거래가 없습니다.
        </p>
      ) : (
        <div className="space-y-1">
          {data.top.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-[12px]">
              <span className="w-14 shrink-0 tabular-nums text-slate-400">{t.date.slice(5)}</span>
              <span className="min-w-0 flex-1 truncate text-slate-700">{t.client}</span>
              <span className="shrink-0 tabular-nums font-bold text-slate-900">{formatKRW(t.amount)}</span>
            </div>
          ))}
          {data.count > 5 && (
            <p className="text-[10px] text-slate-400">외 {data.count - 5}건 (금액순 상위 5건 표시)</p>
          )}
        </div>
      )}
    </div>
  )
}
