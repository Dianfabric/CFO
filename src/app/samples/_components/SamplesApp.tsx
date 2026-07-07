'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '../_lib/helpers'
import RentTab from './RentTab'
import ReturnTab from './ReturnTab'
import ClientsTab from './ClientsTab'
import BooksTab from './BooksTab'

const TABS = [
  { key: 'rent', label: '대여', icon: '📦' },
  { key: 'return', label: '반납', icon: '↩️' },
  { key: 'clients', label: '거래처', icon: '👥' },
  { key: 'books', label: '샘플북', icon: '📚' },
] as const
type TabKey = (typeof TABS)[number]['key']

type Stats = { total: number; rented: number; overdue: number; dueToday: number }

export default function SamplesApp() {
  const [tab, setTab] = useState<TabKey>('rent')
  const [stats, setStats] = useState<Stats | null>(null)
  const [toastMsg, setToastMsg] = useState('')

  const loadStats = useCallback(() => {
    api<Stats>('/api/samples/stats').then(setStats).catch(() => {})
  }, [])
  useEffect(loadStats, [loadStats])

  const toast = useCallback((m: string) => {
    setToastMsg(m)
    setTimeout(() => setToastMsg((cur) => (cur === m ? '' : cur)), 2600)
  }, [])

  return (
    <div className="pb-20 md:pb-0">
      {/* 헤더 */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">샘플 관리</h1>
        <p className="text-sm text-slate-500">샘플북 대여·반납·거래처를 관리합니다</p>
      </div>

      {/* 통계 타일 */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: '전체 샘플북', v: stats?.total, cls: 'text-slate-900' },
          { l: '대여중', v: stats?.rented, cls: 'text-blue-600' },
          { l: '연체중', v: stats?.overdue, cls: 'text-red-600' },
          { l: '오늘 반납 예정', v: stats?.dueToday, cls: 'text-slate-900' },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
            <div className="text-xs text-slate-500">{s.l}</div>
            <div className={`mt-0.5 text-2xl font-extrabold tabular-nums ${s.cls}`}>
              {s.v == null ? '—' : s.v.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* 데스크탑 탭 */}
      <div className="mb-5 hidden border-b border-slate-200 md:flex">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label} {t.key === 'return' ? '처리' : t.key === 'rent' ? '처리' : ''}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      {tab === 'rent' && <RentTab onDone={loadStats} toast={toast} />}
      {tab === 'return' && <ReturnTab onDone={loadStats} toast={toast} />}
      {tab === 'clients' && <ClientsTab toast={toast} />}
      {tab === 'books' && <BooksTab toast={toast} />}

      {/* 모바일 하단 탭바 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 md:hidden">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); window.scrollTo({ top: 0 }) }}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold ${tab === t.key ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}>
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* 토스트 */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 z-[60] max-w-[88%] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-center text-[13px] font-semibold text-white shadow-xl md:bottom-10">
          {toastMsg}
        </div>
      )}
    </div>
  )
}
