'use client'

/**
 * 대출·이자 — 원금/이자 상환 현황 + 통장(관리회계 원장) 크로스체크.
 * 이자 = 영업외비용 (세전이익 정확도), 종소세·법인세 신고 자료.
 */
import { useCallback, useEffect, useState } from 'react'
import { Landmark, Loader2, AlertTriangle } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

const box: React.CSSProperties = { border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }

interface LoanData {
  years: string[]
  year: string
  entity: 'dian' | 'naid'
  totalInterest: number
  totalPrincipal: number
  needsReview: number
  lenders: { lender: string; interest: number; principal: number; review: number; last: string }[]
  months: string[]
  monthlyInterest: number[]
  monthlyPrincipal: number[]
  crosscheck: { month: string; loan: number; ledger: number; diff: number }[]
  ledgerAvailable: boolean
  tableMissing?: boolean
  error?: string
}

export default function LoanSection() {
  const [year, setYear] = useState<string | null>(null)
  const [entity, setEntity] = useState<'dian' | 'naid'>('dian')
  const [data, setData] = useState<LoanData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (y: string | null, e: string) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/loan-intel?entity=${e}${y ? `&year=${y}` : ''}`)
      const j = (await r.json()) as LoanData
      setData(j)
      if (!y && j.year) setYear(j.year)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(year, entity) }, [year, entity, load])

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 flex-wrap">
        <Landmark className="w-4 h-4" style={{ color: 'var(--nv-primary, #76b900)' }} />
        <h2 className="text-base font-semibold text-slate-900">대출·이자</h2>
        <span className="text-xs text-slate-400">
          · 이자 = 영업외비용 · 종소세·법인세 신고 자료 · 통장과 크로스체크
        </span>
        <span className="ml-auto inline-flex gap-1.5">
          <span className="inline-flex overflow-hidden rounded-sm border border-slate-200">
            {(
              [
                { v: 'dian', label: '디안' },
                { v: 'naid', label: '법인' },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => { setEntity(o.v); setYear(null) }}
                className="h-8 px-3 text-[12px] font-bold"
                style={{
                  backgroundColor: entity === o.v ? 'var(--nv-primary, #76b900)' : 'white',
                  color: entity === o.v ? '#000' : '#64748b',
                }}
              >
                {o.label}
              </button>
            ))}
          </span>
          {data && data.years.length > 0 && (
            <select
              className="h-8 px-2 text-[12px] border rounded outline-none bg-white"
              value={data.year}
              onChange={(e) => setYear(e.target.value)}
            >
              {data.years.map((y) => <option key={y} value={y}>{y}년</option>)}
            </select>
          )}
        </span>
      </div>

      {loading ? (
        <div className="bg-white p-5 text-center text-[12px] text-slate-400" style={box}>
          <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
          집계 중...
        </div>
      ) : !data || data.years.length === 0 ? (
        <div className="bg-white p-4 text-[12px] text-slate-500" style={box}>
          {data?.error ?? '데이터가 없습니다.'}{' '}
          <span className="text-slate-400">
            — &lsquo;대출원금,이자상환내역&rsquo; 엑셀을 업로드하면 채워집니다.
            {entity === 'naid' && ' (법인 파일은 파일명에 "법인"을 포함해 주세요)'}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 연간 요약 3카드 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="bg-white p-4" style={box}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {data.year}년 이자 합계
              </p>
              <p className="mt-2 text-[22px] font-bold tabular-nums leading-none" style={{ color: '#c2410c' }}>
                {formatKRW(data.totalInterest)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">월평균 {formatKRW(Math.round(data.totalInterest / 12))}</p>
            </div>
            <div className="bg-white p-4" style={box}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                원금 상환 합계
              </p>
              <p className="mt-2 text-[22px] font-bold tabular-nums leading-none text-slate-900">
                {formatKRW(data.totalPrincipal)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">원금 상환은 비용 아님 (현금흐름)</p>
            </div>
            <div className="bg-white p-4" style={box}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                확인 필요 (OCR 추정)
              </p>
              <p
                className="mt-2 text-[22px] font-bold tabular-nums leading-none"
                style={{ color: data.needsReview > 0 ? '#c2410c' : 'var(--nv-success-deep, #4a7c00)' }}
              >
                {data.needsReview}건
              </p>
              <p className="mt-1 text-[11px] text-slate-400">원본 명세서와 대조 후 확정</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 items-start">
            {/* 은행별 현황 */}
            <div className="bg-white p-4" style={box}>
              <p className="mb-2 text-[12px] font-bold text-slate-800">은행별 현황</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]" style={{ minWidth: 380 }}>
                  <thead>
                    <tr className="text-left text-slate-400" style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <th className="py-1.5 pr-2 font-medium">은행</th>
                      <th className="pr-2 font-medium text-right">이자</th>
                      <th className="pr-2 font-medium text-right">원금</th>
                      <th className="font-medium text-right">확인필요</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lenders.map((l) => (
                      <tr key={l.lender} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td className="py-1.5 pr-2 font-medium text-slate-800">{l.lender}</td>
                        <td className="pr-2 text-right tabular-nums" style={{ color: '#c2410c' }}>
                          {formatKRW(l.interest)}
                        </td>
                        <td className="pr-2 text-right tabular-nums">{formatKRW(l.principal)}</td>
                        <td className="text-right tabular-nums" style={{ color: l.review > 0 ? '#c2410c' : '#94a3b8' }}>
                          {l.review > 0 ? `⚠ ${l.review}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* 월별 이자 미니 바 */}
              <div className="mt-3 flex items-end gap-1" style={{ height: 44 }}>
                {data.monthlyInterest.map((v, i) => {
                  const max = Math.max(...data.monthlyInterest, 1)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${data.months[i]} 이자 ${formatKRW(v)}`}>
                      <div
                        className="w-full"
                        style={{
                          height: Math.max(v > 0 ? 3 : 1, (v / max) * 34),
                          backgroundColor: '#f59e0b',
                          borderRadius: 1,
                        }}
                      />
                      <span className="text-[8px] text-slate-400">{i + 1}</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">월별 이자 추이</p>
            </div>

            {/* 크로스체크 */}
            <div className="bg-white p-4" style={box}>
              <p className="mb-1 text-[12px] font-bold text-slate-800">
                통장 크로스체크{' '}
                <span className="font-normal text-[11px] text-slate-400">· 원리금(상환내역) vs 통장 지출(관리회계)</span>
              </p>
              {!data.ledgerAvailable ? (
                <p className="text-[12px] text-slate-400">
                  관리회계 원장이 아직 없어 비교할 수 없습니다 — 관리회계 파일을 업로드하면 자동
                  비교됩니다.
                </p>
              ) : data.crosscheck.length === 0 ? (
                <p className="text-[12px] text-slate-400">비교할 데이터가 없습니다 (연도 불일치).</p>
              ) : (
                <div className="space-y-1">
                  {data.crosscheck.map((c) => {
                    const mismatch = Math.abs(c.diff) > 1000
                    return (
                      <div key={c.month} className="flex items-center gap-2 text-[12px]">
                        <span className="w-14 shrink-0 tabular-nums text-slate-400">{c.month.slice(2)}</span>
                        <span className="flex-1 tabular-nums text-slate-600">
                          상환 {formatKRW(c.loan)} <span className="text-slate-300">vs</span> 통장 {formatKRW(c.ledger)}
                        </span>
                        {mismatch ? (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: '#c2410c' }}>
                            <AlertTriangle className="w-3 h-3" />
                            차이 {formatKRW(Math.abs(c.diff))}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] font-bold" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>
                            일치
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <p className="mt-2 text-[10px] text-slate-400">
                차이가 크면 개인통장 납부 등 통장 매칭이 안 된 것 — 해당 달 자료를 확인해 주세요.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
