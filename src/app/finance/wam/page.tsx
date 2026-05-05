/**
 * WAM (주간 회의) 목록 (Phase 1 ⑫, PRD #1 ④)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  Plus,
  CalendarCheck,
  AlertCircle,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createWAM } from '@/app/finance/wam/actions'
import { daysUntilNextMonday } from '@/lib/v11-cycle'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface WAMListRow {
  id: number
  cycle_id: number | null
  meeting_date: string
  week_number: number
  attendees: string[] | null
  next_week_priorities: string[] | null
  blockers: string | null
  scorecard: Record<string, { current: number; status: string }> | null
}

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('weekly_action_meetings')
      .select(
        'id, cycle_id, meeting_date, week_number, attendees, next_week_priorities, blockers, scorecard',
      )
      .order('meeting_date', { ascending: false })
      .limit(50)

    return {
      meetings: (data ?? []) as WAMListRow[],
      error: error?.message ?? null,
    }
  } catch (e) {
    return {
      meetings: [] as WAMListRow[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function WAMListPage() {
  const { meetings, error } = await loadData()
  const wamDday = daysUntilNextMonday()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · Phase 1 ⑫
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">WAM (주간 회의)</h1>
          <p className="mt-1 text-sm text-slate-500">
            매주 월요일 — 12주 목표 점수표 갱신 + 다음 주 우선순위 결정
          </p>
        </div>
        <form action={createWAM}>
          <Button type="submit">
            <Plus className="mr-1 h-4 w-4" />새 WAM 시작
          </Button>
        </form>
      </div>

      {/* 다음 WAM 알림 */}
      {wamDday <= 7 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-3 text-sm text-blue-900">
              <Clock className="h-5 w-5 shrink-0" />
              <div>
                <strong>다음 WAM</strong>:{' '}
                {wamDday === 0
                  ? '오늘! (월요일) 회의록 작성 시작하세요'
                  : `D-${wamDday} (다음 월요일)`}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>{error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>회의록 이력</CardTitle>
          <CardDescription>최근 50건. 클릭 시 점수표·메모 편집</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {meetings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CalendarCheck className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">
                아직 WAM 회의록이 없습니다
              </p>
              <p className="mt-1 text-xs text-slate-400">
                위대한 12주는 매주 월요일 1시간 이내의 짧은 회의를 권장합니다
              </p>
              <form action={createWAM} className="mt-4">
                <Button type="submit" size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  첫 WAM 시작
                </Button>
              </form>
            </div>
          ) : (
            <ul className="divide-y">
              {meetings.map((m) => {
                const goalsScored = m.scorecard ? Object.keys(m.scorecard).length : 0
                const passed =
                  m.scorecard
                    ? Object.values(m.scorecard).filter(
                        (s) => s.status === 'on_track',
                      ).length
                    : 0
                const priorityCount = m.next_week_priorities?.length ?? 0
                const hasBlocker = m.blockers && m.blockers.trim().length > 0

                return (
                  <li key={m.id}>
                    <Link
                      href={`/finance/wam/${m.id}`}
                      className="flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        W{m.week_number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {m.meeting_date}
                          </span>
                          {m.attendees && m.attendees.length > 0 && (
                            <span className="text-[11px] text-slate-500">
                              · {m.attendees.join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>
                            점수표 <strong className="text-slate-700">{goalsScored}개</strong>
                            {goalsScored > 0 && (
                              <span className="text-emerald-600"> ({passed} on track)</span>
                            )}
                          </span>
                          <span>·</span>
                          <span>
                            다음 주 우선순위 <strong className="text-slate-700">{priorityCount}개</strong>
                          </span>
                          {hasBlocker && (
                            <>
                              <span>·</span>
                              <span className="text-amber-700">⚠ 블로커 있음</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 가이드 */}
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-sm">📌 WAM 진행 가이드</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>매주 월요일</strong> 1시간 이내 — 짧고 집중된 회의
            </li>
            <li>
              <strong>점수표</strong>: 12주 목표 각각의 진행률 + 상태(진행중/주의/지연) 평가
            </li>
            <li>
              <strong>다음 주 우선순위</strong>: 3~5개 행동만 (단순화)
            </li>
            <li>
              <strong>블로커</strong>: 진행 막힘이나 위기 신호 명시 — 다음 회의 전까지 해결 책임자
              지정
            </li>
            <li>
              점수표 갱신 시 <code className="rounded bg-white px-1">goals.current_value</code> 도
              자동 동기화 → 12주 대시보드에 즉시 반영
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
