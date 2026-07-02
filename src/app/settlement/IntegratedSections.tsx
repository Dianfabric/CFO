'use client'

/**
 * 경영 계기판 — 통합 섹션 1차 (색동 방식의 디안 전체 확장).
 *
 * ① 매입 / 고정비 / 변동비 — 이번 달, 본체(일계표·v1.0) + 색동(수기) 합산
 * ② 쇼핑몰 입금 확인 + 세금계산서·입금(오프라인) — 미확인·미발행 요약
 * ③ 재고 (색동 완제품) — 입고·판매·선물·남은 재고 미니 표
 *
 * 데이터는 기존 API·공유 fetch 재사용 (추가 아임웹 호출 없음).
 * 본체 스와치·샘플 재고, 엔에이아이디는 다음 단계.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Package, Lock, Shuffle, Banknote, FileCheck2, Boxes, ArrowRight, AlertTriangle, Loader2,
} from 'lucide-react'
import { formatKRW } from '@/lib/formatters'
import { listSaekdongCosts } from '@/app/saekdong/actions'
import type { SaekdongPurchase, SaekdongExpense, SaekdongGift } from '@/app/saekdong/actions'
import { fetchSharedSales, fetchSharedOffline } from '@/app/saekdong/sharedFetch'

const box: React.CSSProperties = { border: '1px solid var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }

function kstToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

function normName(s: string): string {
  return String(s || '').replace(/\[[^\]]*\]/g, '').toLowerCase().replace(/\s+/g, '')
}

interface SettlementMonth {
  totalPurchases?: number
  monthlyFixedCost?: number
  variableCostBreakdown?: { expenses?: { amount?: number } }
}
interface PayCheck {
  totalSales: number
  imwebPaidCount: number
  confirmedCount: number
  pgConfirmedCount: number
  unconfirmed: { amount: number }[]
  error?: string
}
interface OfflineLite {
  unpaid?: { amount: number }[]
  unissued?: { amount: number }[]
  error?: string
}
interface SalesLite {
  products?: { prodName: string; qty: number }[]
  error?: string
}

export default function IntegratedSections() {
  const [settle, setSettle] = useState<SettlementMonth | null>(null)
  const [saek, setSaek] = useState<{
    purchases: SaekdongPurchase[]
    expenses: SaekdongExpense[]
    gifts: SaekdongGift[]
  } | null>(null)
  const [paycheck, setPaycheck] = useState<PayCheck | null>(null)
  const [offline, setOffline] = useState<OfflineLite | null>(null)
  const [soldMap, setSoldMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = kstToday()
    const monthStart = today.slice(0, 7) + '-01'
    Promise.all([
      fetch(`/api/settlement/daily?startDate=${monthStart}&endDate=${today}`)
        .then((r) => r.json())
        .catch(() => null),
      listSaekdongCosts().catch(() => null),
      fetch('/api/saekdong/payment-check').then((r) => r.json()).catch(() => null),
      fetchSharedOffline<OfflineLite>().catch(() => null),
      fetchSharedSales<SalesLite>().catch(() => null),
    ])
      .then(([st, sc, pc, off, sales]) => {
        setSettle(st)
        if (sc) setSaek({ purchases: sc.purchases, expenses: sc.expenses, gifts: sc.gifts })
        setPaycheck(pc)
        setOffline(off)
        // 판매수량 (온라인 + 오프라인, 올해) — 재고 계산용
        const map = new Map<string, number>()
        const offP = (off as { products?: { prodName: string; qty: number }[] } | null)?.products
        for (const list of [sales?.products, offP]) {
          for (const p of list ?? []) {
            const k = normName(p.prodName)
            map.set(k, (map.get(k) ?? 0) + (Number(p.qty) || 0))
          }
        }
        setSoldMap(map)
      })
      .finally(() => setLoading(false))
  }, [])

  const monthKey = kstToday().slice(0, 7)

  // ── 비용 합산 (이번 달) ──
  const cost = useMemo(() => {
    const monthlyActive = (e: SaekdongExpense) =>
      (!e.start_month || e.start_month <= monthKey) && (!e.end_month || e.end_month >= monthKey)
    const saekExp = (filter: (e: SaekdongExpense) => boolean) =>
      (saek?.expenses ?? []).reduce(
        (s, e) =>
          s +
          (e.is_monthly
            ? monthlyActive(e) && filter(e) ? e.amount : 0
            : (e.expense_date ?? '').startsWith(monthKey) && filter(e) ? e.amount : 0),
        0,
      )
    const saekPurch = (saek?.purchases ?? [])
      .filter((p) => p.purchase_date.startsWith(monthKey))
      .reduce((s, p) => s + p.amount, 0)
    const bodyPurch = settle?.totalPurchases ?? 0
    const bodyFixed = settle?.monthlyFixedCost ?? 0
    const bodyVar = settle?.variableCostBreakdown?.expenses?.amount ?? 0
    const saekFixed = saekExp((e) => e.cost_type === 'fixed' && e.nature === '판관비')
    const saekVar = saekExp((e) => e.cost_type === 'variable' && e.nature === '판관비')
    const unpaidCnt = (saek?.purchases ?? []).filter((p) => !p.paid).length
    const noInvoiceCnt = (saek?.purchases ?? []).filter(
      (p) => !p.invoice_received && p.supplier_tax_type === 'general',
    ).length
    return {
      purch: { total: bodyPurch + saekPurch, body: bodyPurch, saek: saekPurch },
      fixed: { total: bodyFixed + saekFixed, body: bodyFixed, saek: saekFixed },
      variable: { total: bodyVar + saekVar, body: bodyVar, saek: saekVar },
      unpaidCnt,
      noInvoiceCnt,
    }
  }, [settle, saek, monthKey])

  // ── 재고 (색동) ──
  const stockRows = useMemo(() => {
    const stocked = new Map<string, { name: string; stocked: number; gifted: number }>()
    for (const p of saek?.purchases ?? []) {
      const k = normName(p.item_name)
      const cur = stocked.get(k) ?? { name: p.item_name, stocked: 0, gifted: 0 }
      cur.stocked += Number(p.qty) || 0
      stocked.set(k, cur)
    }
    for (const g of saek?.gifts ?? []) {
      const k = normName(g.item_name)
      const cur = stocked.get(k) ?? { name: g.item_name, stocked: 0, gifted: 0 }
      cur.gifted += Number(g.qty) || 0
      stocked.set(k, cur)
    }
    return [...stocked.entries()]
      .map(([k, v]) => {
        const sold = soldMap.get(k) ?? 0
        return { key: k, name: v.name, stocked: v.stocked, sold, gifted: v.gifted, remaining: v.stocked - sold - v.gifted }
      })
      .sort((a, b) => b.stocked - a.stocked)
      .slice(0, 6)
  }, [saek, soldMap])

  const unconfirmedSum = (paycheck?.unconfirmed ?? []).reduce((s, u) => s + u.amount, 0)
  const unpaidSum = (offline?.unpaid ?? []).reduce((s, u) => s + u.amount, 0)
  const unissuedSum = (offline?.unissued ?? []).reduce((s, u) => s + u.amount, 0)

  if (loading) {
    return (
      <div className="bg-white p-5 text-center text-[12px] text-slate-400" style={box}>
        <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
        통합 섹션 불러오는 중...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── 매입 / 고정비 / 변동비 (이번 달, 본체+색동) ── */}
      <div>
        <h2 className="mb-1 text-base font-semibold text-slate-900">비용 구조 — 이번 달</h2>
        <p className="mb-3 text-xs text-slate-400">
          본체(일계표·비용 관리) + 색동(수기 입력) 합산 · 엔에이아이디 연동 예정
        </p>
        {(cost.unpaidCnt > 0 || cost.noInvoiceCnt > 0) && (
          <div
            className="mb-3 flex items-center gap-2 px-3 py-2 text-[12px] font-medium"
            style={{ ...box, backgroundColor: '#fff7ed', color: '#c2410c' }}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            색동 매입 {cost.unpaidCnt > 0 && `미송금 ${cost.unpaidCnt}건`}
            {cost.unpaidCnt > 0 && cost.noInvoiceCnt > 0 && ' · '}
            {cost.noInvoiceCnt > 0 && `계산서 미수취 ${cost.noInvoiceCnt}건`}
            <Link href="/saekdong" className="ml-auto inline-flex items-center gap-1 font-bold underline">
              처리하러 가기 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CostCard
            icon={<Package className="w-4 h-4" />}
            label="매입"
            total={cost.purch.total}
            body={cost.purch.body}
            saek={cost.purch.saek}
            href="/saekdong"
          />
          <CostCard
            icon={<Lock className="w-4 h-4" />}
            label="고정비 (월)"
            total={cost.fixed.total}
            body={cost.fixed.body}
            saek={cost.fixed.saek}
            href="/costs"
          />
          <CostCard
            icon={<Shuffle className="w-4 h-4" />}
            label="변동비"
            total={cost.variable.total}
            body={cost.variable.body}
            saek={cost.variable.saek}
            href="/costs"
          />
        </div>
      </div>

      {/* ── 입금 확인 + 세금계산서 발행 ── */}
      <div>
        <h2 className="mb-1 text-base font-semibold text-slate-900">입금 · 발행 확인</h2>
        <p className="mb-3 text-xs text-slate-400">
          자동 대사에서 확인 안 된 것만 표시 — 상세 처리(수동 완료 등)는 색동 페이지에서
        </p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <CheckCard
            icon={<Banknote className="w-4 h-4" />}
            title="쇼핑몰 입금 확인"
            ok={!paycheck || !!paycheck.error ? null : (paycheck.unconfirmed?.length ?? 0) === 0}
            summary={
              paycheck && !paycheck.error
                ? `매출 ${paycheck.totalSales}건 · 통장 확인 ${paycheck.confirmedCount + paycheck.pgConfirmedCount}건`
                : '조회 실패 — 새로고침 필요'
            }
            pendingLabel="통장 미확인"
            pendingCount={paycheck?.unconfirmed?.length ?? 0}
            pendingSum={unconfirmedSum}
            href="/saekdong"
          />
          <CheckCard
            icon={<Banknote className="w-4 h-4" />}
            title="오프라인 입금 (색동)"
            ok={!offline || !!offline.error ? null : (offline.unpaid?.length ?? 0) === 0}
            summary="일계표 색동 거래 기준"
            pendingLabel="미입금"
            pendingCount={offline?.unpaid?.length ?? 0}
            pendingSum={unpaidSum}
            href="/saekdong"
          />
          <CheckCard
            icon={<FileCheck2 className="w-4 h-4" />}
            title="세금계산서 발행 (색동)"
            ok={!offline || !!offline.error ? null : (offline.unissued?.length ?? 0) === 0}
            summary="본체 전체 미수금은 미수금 관리에서"
            pendingLabel="미발행"
            pendingCount={offline?.unissued?.length ?? 0}
            pendingSum={unissuedSum}
            href="/saekdong"
          />
        </div>
      </div>

      {/* ── 재고 (색동 완제품 — 스와치·샘플은 다음 단계) ── */}
      <div>
        <h2 className="mb-1 text-base font-semibold text-slate-900">재고</h2>
        <p className="mb-3 text-xs text-slate-400">
          색동 완제품 재고 (입고 − 판매 − 선물) · 본체 스와치·샘플 재고는 연동 예정
        </p>
        <div className="bg-white p-4" style={box}>
          {stockRows.length === 0 ? (
            <p className="text-[12px] italic text-slate-400">
              색동 매입을 입력하면 재고가 표시됩니다.{' '}
              <Link href="/saekdong" className="underline">색동 신사업 →</Link>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]" style={{ minWidth: 520 }}>
                <thead>
                  <tr className="text-left text-slate-400" style={{ borderBottom: '1px solid var(--nv-hairline, #e2e8f0)' }}>
                    <th className="py-1.5 pr-2 font-medium">품목</th>
                    <th className="pr-2 font-medium text-right">입고</th>
                    <th className="pr-2 font-medium text-right">판매</th>
                    <th className="pr-2 font-medium text-right">선물</th>
                    <th className="pr-2 font-medium text-right">남은 재고</th>
                    <th className="font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((r) => (
                    <tr key={r.key} style={{ borderBottom: '1px solid var(--nv-hairline, #e2e8f0)' }}>
                      <td className="py-1.5 pr-2 font-medium text-slate-800">{r.name}</td>
                      <td className="pr-2 text-right tabular-nums">{r.stocked}</td>
                      <td className="pr-2 text-right tabular-nums">{r.sold}</td>
                      <td className="pr-2 text-right tabular-nums text-slate-400">{r.gifted}</td>
                      <td
                        className="pr-2 text-right tabular-nums font-bold"
                        style={{ color: r.remaining < 0 ? '#dc2626' : r.remaining <= 5 ? '#c2410c' : undefined }}
                      >
                        {r.remaining}
                      </td>
                      <td className="text-right">
                        <Boxes className="w-3.5 h-3.5 inline text-slate-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-slate-400">
                선물 기록·상세 관리는{' '}
                <Link href="/saekdong" className="underline">색동 신사업 → 매입·비용 → 재고 현황</Link>
                에서
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CostCard({
  icon, label, total, body, saek, href,
}: {
  icon: React.ReactNode
  label: string
  total: number
  body: number
  saek: number
  href: string
}) {
  return (
    <div className="bg-white p-4" style={box}>
      <div className="flex items-center gap-1.5 text-slate-500">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</p>
      </div>
      <p className="mt-2 text-[22px] font-bold tabular-nums leading-none text-slate-900">
        {formatKRW(total)}
      </p>
      <div className="mt-2 space-y-0.5 text-[11px] text-slate-500 tabular-nums">
        <div className="flex justify-between">
          <span>디안 본체</span>
          <span>{formatKRW(body)}</span>
        </div>
        <div className="flex justify-between">
          <span>색동</span>
          <span>{formatKRW(saek)}</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>엔에이아이디</span>
          <span>연동 예정</span>
        </div>
      </div>
      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium"
        style={{ color: 'var(--nv-success-deep, #4a7c00)' }}
      >
        입력·관리 <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}

function CheckCard({
  icon, title, ok, summary, pendingLabel, pendingCount, pendingSum, href,
}: {
  icon: React.ReactNode
  title: string
  ok: boolean | null
  summary: string
  pendingLabel: string
  pendingCount: number
  pendingSum: number
  href: string
}) {
  return (
    <Link href={href} className="block">
      <div className="bg-white p-4 h-full" style={box}>
        <div className="flex items-center gap-1.5 text-slate-500">
          {icon}
          <p className="text-[12px] font-bold text-slate-800">{title}</p>
          {ok != null && (
            <span
              className="ml-auto px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: ok ? 'rgba(118,185,0,0.12)' : '#fef2f2',
                color: ok ? 'var(--nv-success-deep, #4a7c00)' : '#dc2626',
                borderRadius: '2px',
              }}
            >
              {ok ? '모두 확인' : `${pendingLabel} ${pendingCount}건`}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">{summary}</p>
        {!ok && pendingCount > 0 && (
          <p className="mt-1.5 text-[16px] font-bold tabular-nums" style={{ color: '#dc2626' }}>
            {formatKRW(pendingSum)}
          </p>
        )}
      </div>
    </Link>
  )
}
