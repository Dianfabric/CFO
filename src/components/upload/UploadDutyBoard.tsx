'use client'

/**
 * 업로드 당번판 — 매일/매주/매월 올려야 하는 자료와 담당자.
 * 이번 기간에 안 올라온 항목은 빨갛게 + 누락 요약으로 전달.
 * (업로드 섹션에서 파일 처리 성공 시 자동 기록 — upload_log)
 */
import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck2, Check, X, RefreshCw, Loader2 } from 'lucide-react'

const box: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: '2px' }

interface DutyGroup {
  cadence: 'daily' | 'weekly' | 'monthly'
  title: string
  assignee: string
  items: { label: string; done: boolean }[]
  missingCount: number
  missingLabels: string[]
}

interface DutyData {
  tableMissing: boolean
  today: string
  groups: DutyGroup[]
  error?: string
}

const PERIOD_HINT: Record<DutyGroup['cadence'], string> = {
  daily: '오늘',
  weekly: '이번 주',
  monthly: '이번 달',
}

export default function UploadDutyBoard() {
  const [data, setData] = useState<DutyData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/upload-log')
      setData(await r.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalMissing = (data?.groups ?? []).reduce((s, g) => s + g.missingCount, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarCheck2 className="w-4 h-4 text-[#76b900]" />
        <h2 className="text-base font-semibold text-slate-900">업로드 당번판</h2>
        <span className="text-xs text-slate-400">
          · 올리면 자동 체크 · 안 올리면 빨간 표시 {data?.today && `· ${data.today}`}
        </span>
        {!loading && totalMissing > 0 && (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>
            누락 {totalMissing}건
          </span>
        )}
        <button
          type="button"
          onClick={load}
          className="ml-auto h-7 px-2 text-[11px] font-bold inline-flex items-center gap-1 bg-white border border-slate-200 rounded-sm text-slate-500"
        >
          <RefreshCw className="w-3 h-3" /> 새로고침
        </button>
      </div>

      {loading ? (
        <div className="bg-white p-5 text-center text-[12px] text-slate-400" style={box}>
          <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" /> 확인 중...
        </div>
      ) : !data || data.error ? (
        <div className="bg-white p-4 text-[12px] text-rose-600" style={box}>
          ⚠ 조회 실패{data?.error ? `: ${data.error}` : ''}
        </div>
      ) : (
        <>
          {data.tableMissing && (
            <p className="px-3 py-2 text-[11px] font-medium" style={{ ...box, backgroundColor: '#fff7ed', color: '#c2410c' }}>
              ⚠ upload_log 테이블 미생성 — supabase/migrations/2026-07-07_upload_log.sql 실행하면 자동 체크가 시작됩니다
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {data.groups.map((g) => (
              <div
                key={g.cadence}
                className="bg-white p-4"
                style={{ ...box, borderColor: g.missingCount > 0 ? '#fca5a5' : '#e2e8f0' }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13px] font-bold text-slate-900">{g.title}</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: '2px' }}>
                    {g.assignee}
                  </span>
                  <span className="ml-auto text-[10px] font-bold" style={{ color: g.missingCount > 0 ? '#b91c1c' : '#3d7a00' }}>
                    {g.missingCount > 0 ? `${PERIOD_HINT[g.cadence]} 누락 ${g.missingCount}` : '완료 ✓'}
                  </span>
                </div>
                <ul className="space-y-1">
                  {g.items.map((it) => (
                    <li key={it.label} className="flex items-center gap-1.5 text-[12px]">
                      {it.done ? (
                        <Check className="w-3.5 h-3.5 shrink-0" style={{ color: '#3d7a00' }} />
                      ) : (
                        <X className="w-3.5 h-3.5 shrink-0" style={{ color: '#dc2626' }} />
                      )}
                      <span className={it.done ? 'text-slate-600' : 'font-bold'} style={it.done ? undefined : { color: '#dc2626' }}>
                        {it.label}
                        {!it.done && ' — 미업로드'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            위 업로드 섹션에서 파일 처리가 성공하면 자동으로 체크됩니다 (간이영수증은 사진 등록도 인정) ·
            매일 항목은 영업일 기준으로 보세요 · 담당·주기 변경은 Claude에게 요청
          </p>
        </>
      )}
    </div>
  )
}
