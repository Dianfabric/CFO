/**
 * 모닝/이브닝 브리핑 (Phase 1 ⑦, PRD #7 ① ③)
 *
 * Claude AI로 오늘의 브리핑 생성. 본인 user_id의 데이터만 표시 (RLS 적용).
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  Sunrise,
  Sunset,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Brain,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  GenerateBriefingButton,
  DeleteBriefingButton,
} from '@/components/v11/briefing/BriefingActions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface BriefingRow {
  id: number
  briefing_date: string
  type: string
  top_changes: string[] | null
  priorities: string[] | null
  alerts: string[] | null
  coaching_message: string | null
  drucker_question: string | null
  daily_summary: string | null
  variance_analysis: { plan?: string; actual?: string; gap?: string } | null
  five_habits_check: Record<string, string> | null
  decisions_made: string[] | null
  ai_feedback: string | null
  generated_at: string
  user_reviewed: boolean
}

async function loadData() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { briefings: [] as BriefingRow[], userId: null, error: null }

    const { data, error } = await supabase
      .from('ai_briefings')
      .select('*')
      .eq('user_id', user.id)
      .order('briefing_date', { ascending: false })
      .order('type', { ascending: true })
      .limit(20)

    return {
      briefings: (data ?? []) as BriefingRow[],
      userId: user.id,
      error: error?.message ?? null,
    }
  } catch (e) {
    return {
      briefings: [] as BriefingRow[],
      userId: null,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function BriefingPage() {
  const { briefings, error } = await loadData()

  const todayStr = new Date().toISOString().split('T')[0]
  const todayMorning = briefings.find(
    (b) => b.briefing_date === todayStr && b.type === 'morning',
  )
  const todayEvening = briefings.find(
    (b) => b.briefing_date === todayStr && b.type === 'evening',
  )
  const past = briefings.filter((b) => !(b.briefing_date === todayStr))

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · Phase 1 ⑦ · AI
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">모닝 브리핑 / 이브닝 노트</h1>
        <p className="mt-1 text-sm text-slate-500">
          Claude Sonnet 4.5가 어제 데이터·미수금·12주 진행을 보고 매일 코칭 메시지를 생성합니다.
        </p>
      </div>

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

      {/* 오늘 브리핑 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 모닝 */}
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sunrise className="h-5 w-5 text-amber-500" />
              모닝 브리핑 — 오늘
            </CardTitle>
            <CardDescription>아침 시작 시 30초 안에 어제와 오늘 점검</CardDescription>
          </CardHeader>
          <CardContent>
            {todayMorning ? (
              <BriefingDisplay b={todayMorning} />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  오늘({todayStr})의 모닝 브리핑이 아직 없습니다.
                </p>
                <GenerateBriefingButton type="morning" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 이브닝 */}
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sunset className="h-5 w-5 text-purple-500" />
              이브닝 노트 — 오늘
            </CardTitle>
            <CardDescription>하루 마무리 시 회고와 내일 준비</CardDescription>
          </CardHeader>
          <CardContent>
            {todayEvening ? (
              <EveningDisplay b={todayEvening} />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  오늘({todayStr})의 이브닝 노트가 아직 없습니다.
                </p>
                <GenerateBriefingButton type="evening" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 지난 브리핑 */}
      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">지난 브리핑</CardTitle>
            <CardDescription>최근 20개 (날짜 내림차순)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {past.map((b) => (
                <div
                  key={b.id}
                  className="rounded-md border border-slate-200 bg-white p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {b.type === 'morning' ? (
                        <Sunrise className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Sunset className="h-4 w-4 text-purple-500" />
                      )}
                      <span className="font-semibold text-slate-700">
                        {b.briefing_date} ·{' '}
                        {b.type === 'morning' ? '모닝' : '이브닝'}
                      </span>
                      {b.user_reviewed && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle className="h-2.5 w-2.5" />
                          리뷰함
                        </span>
                      )}
                    </div>
                    <DeleteBriefingButton id={b.id} />
                  </div>
                  {b.type === 'morning' ? <BriefingDisplay b={b} /> : <EveningDisplay b={b} />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 안내 */}
      <Card className="border-amber-100 bg-amber-50/40">
        <CardContent className="py-3">
          <p className="text-[11px] text-amber-900">
            💡 <strong>AI 비용 안내</strong>: 브리핑 1회 생성에 Claude Sonnet 4.5 토큰 약 1,500개 사용
            (월 30회 기준 약 USD $0.50). 같은 날짜·타입 중복 생성은 자동 차단됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function BriefingDisplay({ b }: { b: BriefingRow }) {
  return (
    <div className="space-y-3 text-sm">
      {/* 어제 변화 */}
      {b.top_changes && b.top_changes.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <TrendingUp className="h-3 w-3" />
            어제 핵심 변화
          </div>
          <ul className="ml-4 list-disc space-y-1 text-slate-700">
            {b.top_changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 오늘 우선순위 */}
      {b.priorities && b.priorities.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <Lightbulb className="h-3 w-3" />
            오늘 우선순위
          </div>
          <ol className="ml-4 list-decimal space-y-1 text-slate-700">
            {b.priorities.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </div>
      )}

      {/* 위기·기회 신호 */}
      {b.alerts && b.alerts.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
            <AlertTriangle className="h-3 w-3" />
            위기·기회 신호
          </div>
          <ul className="ml-4 list-disc space-y-0.5 text-amber-900">
            {b.alerts.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 코칭 메시지 */}
      {b.coaching_message && (
        <div className="rounded-md border border-blue-100 bg-blue-50/50 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-700">
            <Brain className="h-3 w-3" />
            오늘의 코칭
          </div>
          <p className="text-slate-700 italic">{b.coaching_message}</p>
        </div>
      )}

      {/* 드러커 질문 (월요일만) */}
      {b.drucker_question && (
        <div className="rounded-md border border-purple-200 bg-purple-50/50 p-3">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-purple-700">
            🌟 드러커 질문 (이번 주)
          </div>
          <p className="text-slate-700">{b.drucker_question}</p>
        </div>
      )}
    </div>
  )
}

function EveningDisplay({ b }: { b: BriefingRow }) {
  return (
    <div className="space-y-3 text-sm">
      {b.daily_summary && (
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            오늘 요약
          </div>
          <p className="text-slate-700">{b.daily_summary}</p>
        </div>
      )}

      {b.variance_analysis &&
        (b.variance_analysis.plan ||
          b.variance_analysis.actual ||
          b.variance_analysis.gap) && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
              계획 vs 실제 (그로브)
            </div>
            <div className="space-y-1 text-xs text-slate-700">
              {b.variance_analysis.plan && (
                <div>
                  <strong>계획:</strong> {b.variance_analysis.plan}
                </div>
              )}
              {b.variance_analysis.actual && (
                <div>
                  <strong>실제:</strong> {b.variance_analysis.actual}
                </div>
              )}
              {b.variance_analysis.gap && (
                <div className="text-amber-700">
                  <strong>차이:</strong> {b.variance_analysis.gap}
                </div>
              )}
            </div>
          </div>
        )}

      {b.five_habits_check && Object.keys(b.five_habits_check).length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            드러커 5가지 점검
          </div>
          <ul className="ml-4 list-disc space-y-1 text-slate-700">
            {Object.entries(b.five_habits_check).map(([k, v]) => (
              <li key={k}>
                <span className="font-medium">{k}:</span> {v}
              </li>
            ))}
          </ul>
        </div>
      )}

      {b.decisions_made && b.decisions_made.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            오늘 의사결정
          </div>
          <ul className="ml-4 list-disc space-y-0.5 text-slate-700">
            {b.decisions_made.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {b.ai_feedback && (
        <div className="rounded-md border border-purple-200 bg-purple-50/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-purple-700">
            <Brain className="h-3 w-3" />
            AI 피드백
          </div>
          <p className="text-slate-700 italic">{b.ai_feedback}</p>
        </div>
      )}
    </div>
  )
}
