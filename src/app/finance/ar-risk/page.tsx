/**
 * 미수금 위험 신호 분석 (Phase 5 #3 ⑥)
 * 단순 aging이 아닌 패턴 기반 위험 점수.
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CLIENT_TIER_COLOR, CLIENT_TIER_LABEL } from '@/lib/v11-labels'
import { formatKRW } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RiskRow {
  client_id: number
  client_name: string
  tier: string | null
  total_outstanding: number
  overdue_count: number
  overdue_amount: number
  oldest_overdue_days: number
  last_payment_date: string | null
  risk_score: number // 0-100
  risk_level: 'critical' | 'high' | 'medium' | 'low'
  signals: string[]
}

async function loadData() {
  try {
    const supabase = await createClient()

    const [arRes, txRes, clientsRes] = await Promise.all([
      supabase
        .from('outstanding_payments')
        .select('client_id, client_name, tier, outstanding, days_overdue, transaction_date'),
      supabase
        .from('transactions')
        .select('client_id, transaction_date, payment_received_date, total_amount, payment_received_amount')
        .order('transaction_date', { ascending: false })
        .limit(2000),
      supabase
        .from('clients')
        .select('id, last_contact_date, lifecycle_stage')
        .eq('active', true),
    ])

    const arData = arRes.data ?? []
    const txData = txRes.data ?? []
    const clientsData = clientsRes.data ?? []

    // Aggregate by client
    const byClient = new Map<number, RiskRow>()

    for (const a of arData) {
      const cid = a.client_id as number
      if (!cid) continue
      const cur =
        byClient.get(cid) ??
        ({
          client_id: cid,
          client_name: a.client_name,
          tier: a.tier,
          total_outstanding: 0,
          overdue_count: 0,
          overdue_amount: 0,
          oldest_overdue_days: 0,
          last_payment_date: null,
          risk_score: 0,
          risk_level: 'low',
          signals: [],
        } as RiskRow)
      cur.total_outstanding += Number(a.outstanding || 0)
      const dso = Number(a.days_overdue || 0)
      if (dso > 0) {
        cur.overdue_count++
        cur.overdue_amount += Number(a.outstanding || 0)
        if (dso > cur.oldest_overdue_days) cur.oldest_overdue_days = dso
      }
      byClient.set(cid, cur)
    }

    // Add last payment date
    const lastPaymentByClient = new Map<number, string>()
    for (const t of txData) {
      const cid = t.client_id as number | null
      if (!cid) continue
      if (!t.payment_received_date) continue
      const existing = lastPaymentByClient.get(cid)
      if (!existing || t.payment_received_date > existing) {
        lastPaymentByClient.set(cid, t.payment_received_date)
      }
    }

    const clientLifecycle = new Map<number, string | null>()
    for (const c of clientsData) {
      clientLifecycle.set(c.id, c.lifecycle_stage)
    }

    // Compute risk score
    const rows: RiskRow[] = []
    for (const [cid, row] of byClient) {
      row.last_payment_date = lastPaymentByClient.get(cid) ?? null

      // Risk components
      let score = 0
      const signals: string[] = []

      // 1) Oldest overdue days
      if (row.oldest_overdue_days > 90) {
        score += 40
        signals.push(`${row.oldest_overdue_days}일 연체 (90일 초과)`)
      } else if (row.oldest_overdue_days > 60) {
        score += 25
        signals.push(`${row.oldest_overdue_days}일 연체 (60~90일)`)
      } else if (row.oldest_overdue_days > 30) {
        score += 15
        signals.push(`${row.oldest_overdue_days}일 연체 (30~60일)`)
      } else if (row.oldest_overdue_days > 0) {
        score += 5
        signals.push(`${row.oldest_overdue_days}일 연체`)
      }

      // 2) Multiple overdue items
      if (row.overdue_count >= 5) {
        score += 20
        signals.push(`연체 거래 ${row.overdue_count}건 (다수)`)
      } else if (row.overdue_count >= 3) {
        score += 10
        signals.push(`연체 거래 ${row.overdue_count}건`)
      }

      // 3) Outstanding amount
      if (row.overdue_amount > 10_000_000) {
        score += 20
        signals.push('연체 금액 1천만원 초과')
      } else if (row.overdue_amount > 5_000_000) {
        score += 10
        signals.push('연체 금액 5백만원 초과')
      }

      // 4) Lifecycle stage
      const lifecycle = clientLifecycle.get(cid)
      if (lifecycle === 'at_risk') {
        score += 10
        signals.push('이탈 위험 라이프사이클')
      } else if (lifecycle === 'churned') {
        score += 15
        signals.push('이미 이탈한 거래처')
      }

      // 5) No recent payment
      if (row.last_payment_date) {
        const daysSincePay = Math.floor(
          (Date.now() - new Date(row.last_payment_date).getTime()) / (1000 * 60 * 60 * 24),
        )
        if (daysSincePay > 180) {
          score += 10
          signals.push(`${daysSincePay}일째 결제 없음`)
        }
      } else if (row.total_outstanding > 0) {
        score += 5
        signals.push('결제 이력 없음')
      }

      row.risk_score = Math.min(100, score)
      row.risk_level =
        row.risk_score >= 60
          ? 'critical'
          : row.risk_score >= 40
          ? 'high'
          : row.risk_score >= 20
          ? 'medium'
          : 'low'
      row.signals = signals
      rows.push(row)
    }

    rows.sort((a, b) => b.risk_score - a.risk_score)

    return {
      rows,
      errors: [arRes.error, txRes.error, clientsRes.error].filter(Boolean) as Array<{
        message: string
      }>,
    }
  } catch (e) {
    return {
      rows: [] as RiskRow[],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

const RISK_INFO = {
  critical: { label: '극히 위험', color: 'bg-rose-200 text-rose-900 border-rose-300', icon: AlertTriangle },
  high: { label: '위험', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: AlertCircle },
  medium: { label: '주의', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  low: { label: '정상', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
}

export default async function ARRiskPage() {
  const { rows, errors } = await loadData()

  const counts = {
    critical: rows.filter((r) => r.risk_level === 'critical').length,
    high: rows.filter((r) => r.risk_level === 'high').length,
    medium: rows.filter((r) => r.risk_level === 'medium').length,
    low: rows.filter((r) => r.risk_level === 'low').length,
  }
  const totalAtRisk = rows
    .filter((r) => r.risk_level !== 'low')
    .reduce((s, r) => s + r.total_outstanding, 0)

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #3 ⑥ 미수금 위험 신호
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">미수금 위험 신호 분석</h1>
        <p className="mt-1 text-sm text-slate-500">
          단순 aging을 넘어 패턴 기반 위험 점수 (0~100) — 우선 회수해야 할 거래처
        </p>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {errors[0].message}
        </div>
      )}

      {/* 위험 등급 분포 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(['critical', 'high', 'medium', 'low'] as const).map((lvl) => {
          const info = RISK_INFO[lvl]
          const Icon = info.icon
          return (
            <Card key={lvl} className={cn('border', info.color.split(' ').filter((c) => c.startsWith('border-')).join(' '))}>
              <CardContent className="space-y-1 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{info.label}</span>
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      lvl === 'critical' || lvl === 'high'
                        ? 'text-rose-500'
                        : lvl === 'medium'
                        ? 'text-amber-500'
                        : 'text-emerald-500',
                    )}
                  />
                </div>
                <div className="text-2xl font-bold tabular-nums text-slate-900">
                  {counts[lvl]}
                </div>
                <p className="text-[11px] text-slate-400">거래처</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-rose-200 bg-rose-50/30">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-700">즉시 조치 필요 (위험·극위험) 미수금</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-rose-700">
                {formatKRW(totalAtRisk)}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>전체 거래처 {rows.length}곳</div>
              <div>위험 이상 {counts.critical + counts.high}곳</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 거래처 리스트 */}
      <Card>
        <CardHeader>
          <CardTitle>위험 점수 랭킹</CardTitle>
          <CardDescription>위험 점수 100점 만점 · 즉시 조치 우선순위</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">
              미수금 위험 데이터가 없습니다 — 모든 거래가 결제 완료
            </p>
          ) : (
            <ul className="divide-y">
              {rows.slice(0, 50).map((r) => {
                const info = RISK_INFO[r.risk_level]
                const Icon = info.icon
                return (
                  <li key={r.client_id} className="px-4 py-3 hover:bg-slate-50">
                    <Link
                      href={`/finance/sales/clients/${r.client_id}`}
                      className="flex items-start gap-3"
                    >
                      <Icon
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          r.risk_level === 'critical' || r.risk_level === 'high'
                            ? 'text-rose-500'
                            : r.risk_level === 'medium'
                            ? 'text-amber-500'
                            : 'text-emerald-500',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{r.client_name}</span>
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              info.color,
                            )}
                          >
                            {info.label} · {r.risk_score}점
                          </span>
                          {r.tier && (
                            <span
                              className={cn(
                                'rounded px-1 py-0.5 text-[10px] font-semibold',
                                CLIENT_TIER_COLOR[r.tier] ?? 'bg-slate-100',
                              )}
                            >
                              {CLIENT_TIER_LABEL[r.tier] ?? r.tier}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.signals.map((sig, i) => (
                            <span
                              key={i}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700"
                            >
                              {sig}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right text-xs">
                        <div className="font-bold tabular-nums text-rose-700">
                          {formatKRW(r.total_outstanding)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          연체 {formatKRW(r.overdue_amount)}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 위험 점수 산정 기준</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>가장 오래된 연체 (40점)</strong>: 90일+ → 40점 / 60-90일 → 25점 / 30-60일 → 15점
            </li>
            <li>
              <strong>연체 건수 (20점)</strong>: 5건+ → 20점 / 3-4건 → 10점
            </li>
            <li>
              <strong>연체 금액 (20점)</strong>: 1천만원+ → 20점 / 5백만원+ → 10점
            </li>
            <li>
              <strong>라이프사이클 (15점)</strong>: 이탈 → 15점 / 이탈 위험 → 10점
            </li>
            <li>
              <strong>최근 결제 부재 (10점)</strong>: 180일+ 결제 없음 → 10점
            </li>
            <li>
              <strong>등급 분류</strong>: 60+ 극위험 / 40+ 위험 / 20+ 주의 / 0-19 정상
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
