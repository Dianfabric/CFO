/**
 * 자기경영 5가지 점검 (Phase 7 #7 ⑤, 드러커)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, Lock, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SelfCheckinForm from '@/components/v11/cockpit/SelfCheckinForm'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const today = new Date().toISOString().split('T')[0]
    const [todayCheckin, history] = await Promise.all([
      supabase
        .from('self_mgmt_checkins')
        .select('*')
        .eq('user_id', user.id)
        .eq('checkin_date', today)
        .eq('period_type', 'weekly')
        .maybeSingle(),
      supabase
        .from('self_mgmt_checkins')
        .select('*')
        .eq('user_id', user.id)
        .order('checkin_date', { ascending: false })
        .limit(20),
    ])

    return {
      today: todayCheckin.data,
      history: history.data ?? [],
      errors: [todayCheckin.error, history.error].filter(Boolean) as Array<{
        message: string
      }>,
    }
  } catch (e) {
    return null
  }
}

export default async function SelfMgmtPage() {
  const data = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/cockpit"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        코크핏
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #7 ⑤ 자기경영 5가지 (개인)
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Lock className="h-5 w-5 text-emerald-600" />
          자기경영 5가지 점검 — 드러커
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          시간 관리 · 기여 · 강점 · 우선순위 · 의사결정 — 본인만 조회 (RLS 강제)
        </p>
      </div>

      <SelfCheckinForm
        defaults={
          data?.today ?? {
            checkin_date: new Date().toISOString().split('T')[0],
            period_type: 'weekly',
          }
        }
      />

      {/* 점검 이력 */}
      {data?.history && data.history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">점검 이력</CardTitle>
            <CardDescription>최근 20회</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="px-3 py-2 text-left">날짜</th>
                    <th className="px-3 py-2 text-left">주기</th>
                    <th className="px-3 py-2 text-center">시간 관리</th>
                    <th className="px-3 py-2 text-center">기여</th>
                    <th className="px-3 py-2 text-center">강점</th>
                    <th className="px-3 py-2 text-center">우선순위</th>
                    <th className="px-3 py-2 text-center">의사결정</th>
                    <th className="px-3 py-2 text-center">평균</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h) => {
                    const scores = [
                      h.time_management_score,
                      h.contribution_score,
                      h.strengths_score,
                      h.priorities_score,
                      h.decisions_score,
                    ].filter((s): s is number => s != null)
                    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
                    return (
                      <tr key={h.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-medium text-slate-700">
                          {h.checkin_date}
                        </td>
                        <td className="px-3 py-1.5 text-slate-500">{h.period_type}</td>
                        <td className="px-3 py-1.5 text-center">
                          <ScoreCell score={h.time_management_score} />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <ScoreCell score={h.contribution_score} />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <ScoreCell score={h.strengths_score} />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <ScoreCell score={h.priorities_score} />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <ScoreCell score={h.decisions_score} />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                              avg >= 4
                                ? 'bg-emerald-100 text-emerald-700'
                                : avg >= 3
                                ? 'bg-amber-100 text-amber-700'
                                : avg > 0
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-500',
                            )}
                          >
                            {avg > 0 ? avg.toFixed(1) : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 드러커 자기경영 5가지</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-700">
            "효과적인 경영자는 5가지 습관을 가진다. 시간 관리 / 기여 / 강점 / 우선순위 / 의사결정.
            이는 타고난 게 아니라 <strong>훈련</strong>으로 얻어진다."
          </p>
          <p className="mt-2 text-xs text-slate-700">
            — 매주 1회 점검만 해도 12주(1사이클) 누적 시 평균 점수 0.5점 이상 향상되는 효과가
            많이 보고됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-300">—</span>
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: score }).map((_, i) => (
        <Star key={i} className="h-2.5 w-2.5 fill-current" />
      ))}
    </span>
  )
}
