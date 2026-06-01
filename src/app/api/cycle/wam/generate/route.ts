/**
 * POST /api/cycle/wam/generate
 *
 * 지난 주 데이터를 분석해 WAM (Weekly Action Meeting) 회의 자료 자동 생성.
 * Claude API 로 분석 + 다음 주 권장 액션 생성.
 *
 * body:
 *   week_number?: number   - 분석할 주차 (없으면 cycle.start_date 기준 currentWeek)
 *   regenerate?: boolean   - 기존 WAM 있어도 재생성
 *   triggered_by?: string  - 'cron' / 'manual'
 *
 * 응답:
 *   wam: { cycle_id, week_number, ai_summary, ai_analysis, previous_week_data, next_week_plan, ... }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropic, MODEL, extractText, parseJsonResponse } from '@/lib/anthropic'

interface EmpWeekData {
  name: string
  role: string | null
  track: string
  // 지난 주
  prev_week_todo_total: number
  prev_week_todo_done: number
  prev_week_kr_progress: Array<{
    kr_title: string
    metric: string
    unit: string
    target: number
    actual: number
    progress: number
  }>
  prev_week_note: string | null
  // 이번 주
  this_week_todo_total: number
  this_week_todos: string[]
  this_week_note: string | null
  // 사이클 전체
  big_goal: string | null
  avg_progress: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const triggeredBy = body.triggered_by ?? 'manual'
    const supabase = await createClient()

    // 활성 사이클
    const { data: cycle, error: ce } = await supabase
      .from('cycles')
      .select('id, cycle_number, start_date, end_date, vision_statement')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (ce || !cycle) {
      return NextResponse.json({ error: '활성 사이클 없음' }, { status: 404 })
    }

    // 현재 주차 (cycle.start_date 기준)
    const startMs = new Date(cycle.start_date + 'T00:00:00').getTime()
    const todayMs = Date.now()
    const diffDays = Math.floor((todayMs - startMs) / 86400000)
    const calcCurrentWeek = Math.max(1, Math.min(12, Math.floor(diffDays / 7) + 1))
    // 이번 주차 = 사용자 지정 또는 자동
    const thisWeek: number = Number(body.week_number ?? calcCurrentWeek)
    const prevWeek = Math.max(1, thisWeek - 1)

    // 기존 WAM 있는지
    const { data: existing } = await supabase
      .from('weekly_action_meetings')
      .select('*')
      .eq('cycle_id', cycle.id)
      .eq('week_number', thisWeek)
      .maybeSingle()

    if (existing && !body.regenerate) {
      return NextResponse.json({ wam: existing, cached: true })
    }

    // 활성 직원
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, color, role_label, department, business_track')
      .eq('active', true)
      .order('display_order')

    // 각 직원의 지난 주 / 이번 주 데이터 수집
    const empData: EmpWeekData[] = []
    for (const e of employees ?? []) {
      // 빅 목표
      const { data: bigGoal } = await supabase
        .from('employee_goals')
        .select('id, title')
        .eq('cycle_id', cycle.id)
        .eq('employee_id', e.id)
        .eq('is_big_goal', true)
        .maybeSingle()

      // 직원의 모든 KR (사이클 안)
      const { data: gs } = await supabase
        .from('employee_goals')
        .select('id')
        .eq('cycle_id', cycle.id)
        .eq('employee_id', e.id)
      const gIds = (gs ?? []).map((g) => g.id)
      if (gIds.length === 0) continue

      const { data: krs } = await supabase
        .from('key_results')
        .select('id, title, unit, start_value, target_value, current_value, metric_code, started_date')
        .in('goal_id', gIds)

      // 각 KR 의 currentWeek + prevWeek weekly_targets
      const krDataPrev: EmpWeekData['prev_week_kr_progress'] = []
      let prevTodoTotal = 0
      let prevTodoDone = 0
      let prevNote: string | null = null
      let thisTodoTotal = 0
      const thisTodos: string[] = []
      let thisNote: string | null = null

      for (const kr of krs ?? []) {
        const { data: wts } = await supabase
          .from('weekly_targets')
          .select('id, week_number, target_value, actual_value, note')
          .eq('key_result_id', kr.id)
          .in('week_number', [prevWeek, thisWeek])
        for (const wt of wts ?? []) {
          if (wt.week_number === prevWeek) {
            const target = Number(wt.target_value ?? 0)
            const actual = Number(wt.actual_value ?? 0)
            krDataPrev.push({
              kr_title: kr.title,
              metric: kr.metric_code ?? '',
              unit: kr.unit,
              target,
              actual,
              progress: target > 0 ? actual / target : 0,
            })
            if (wt.note && !prevNote) prevNote = wt.note

            // 지난 주 todos
            const { data: prevTodos } = await supabase
              .from('daily_todos')
              .select('status')
              .eq('weekly_target_id', wt.id)
            prevTodoTotal += (prevTodos ?? []).length
            prevTodoDone += (prevTodos ?? []).filter((t) => t.status === 'done').length
          }
          if (wt.week_number === thisWeek) {
            if (wt.note && !thisNote) thisNote = wt.note
            const { data: tWeekTodos } = await supabase
              .from('daily_todos')
              .select('title, status, date')
              .eq('weekly_target_id', wt.id)
              .order('date')
              .order('order_in_day')
            for (const t of tWeekTodos ?? []) {
              thisTodoTotal++
              if (thisTodos.length < 5) thisTodos.push(t.title)
            }
          }
        }
      }

      // 평균 진행률
      let avg = 0
      if (krs && krs.length > 0) {
        const sum = krs.reduce((s, kr) => {
          const span = Number(kr.target_value) - Number(kr.start_value)
          if (span === 0) return s + (Number(kr.current_value) >= Number(kr.target_value) ? 1 : 0)
          return s + Math.max(0, Math.min(1, (Number(kr.current_value) - Number(kr.start_value)) / span))
        }, 0)
        avg = sum / krs.length
      }

      empData.push({
        name: e.name,
        role: e.role_label,
        track: e.business_track,
        prev_week_todo_total: prevTodoTotal,
        prev_week_todo_done: prevTodoDone,
        prev_week_kr_progress: krDataPrev,
        prev_week_note: prevNote,
        this_week_todo_total: thisTodoTotal,
        this_week_todos: thisTodos,
        this_week_note: thisNote,
        big_goal: bigGoal?.title ?? null,
        avg_progress: avg,
      })
    }

    // Claude API 호출 — 분석 + 다음 주 권장
    const promptData = {
      cycle_number: cycle.cycle_number,
      vision: cycle.vision_statement,
      this_week_number: thisWeek,
      prev_week_number: prevWeek,
      employees: empData,
    }

    const prompt = `당신은 디안(Dian) 인테리어 원단 유통 회사의 CFO 코치입니다.
B2B + B2C 멀티티어 비즈니스. 6명 소규모 팀.
매주 월요일 오전 WAM (Weekly Action Meeting) 회의에서 사용할 자료를 자동 생성합니다.

아래는 지난 주 (W${prevWeek}) 실행 결과 + 이번 주 (W${thisWeek}) 예정 데이터입니다:

\`\`\`json
${JSON.stringify(promptData, null, 2)}
\`\`\`

다음 JSON 형식으로만 답변하세요. 다른 설명 절대 금지:

{
  "summary": "지난 주(W${prevWeek}) 회사 전체를 한 문장으로 (한국어, 30~50자)",
  "highlights": ["가장 잘된 점 (직원 이름 + 구체적 성과)", "..."],
  "concerns": ["우려 사항 (직원 이름 + 막힌 부분)", "..."],
  "recommendations": [
    {
      "employee": "직원 이름",
      "action": "이번 주 추천 핵심 액션 (구체적 한 줄)"
    }
  ],
  "this_week_focus": "이번 주(W${thisWeek}) 회사 전체 한 줄 메시지 — 모두가 한 방향"
}`

    const anthropic = getAnthropic()
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = extractText(msg)
    const parsed = parseJsonResponse<{
      summary: string
      highlights: string[]
      concerns: string[]
      recommendations: Array<{ employee: string; action: string }>
      this_week_focus: string
    }>(text)

    if (!parsed) {
      return NextResponse.json(
        { error: 'Claude 응답 파싱 실패', raw: text.slice(0, 500) },
        { status: 500 },
      )
    }

    // upsert WAM
    const today = new Date()
    const meetingDate = today.toISOString().slice(0, 10)
    const wamRow = {
      cycle_id: cycle.id,
      week_number: thisWeek,
      meeting_date: meetingDate,
      ai_summary: parsed.summary,
      ai_analysis: {
        highlights: parsed.highlights,
        concerns: parsed.concerns,
        this_week_focus: parsed.this_week_focus,
      },
      previous_week_data: { employees: empData, week: prevWeek },
      next_week_plan: { recommendations: parsed.recommendations, week: thisWeek },
      generated_at: new Date().toISOString(),
      generated_by: triggeredBy,
    }

    let wam
    if (existing) {
      const { data, error: ue } = await supabase
        .from('weekly_action_meetings')
        .update(wamRow)
        .eq('id', existing.id)
        .select('*')
        .single()
      if (ue) return NextResponse.json({ error: ue.message }, { status: 500 })
      wam = data
    } else {
      const { data, error: ie } = await supabase
        .from('weekly_action_meetings')
        .insert(wamRow)
        .select('*')
        .single()
      if (ie) return NextResponse.json({ error: ie.message }, { status: 500 })
      wam = data
    }

    return NextResponse.json({ wam, cached: false })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'WAM 생성 실패' },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: cycle } = await supabase
      .from('cycles')
      .select('id, start_date, end_date')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cycle) return NextResponse.json({ wam: null })

    // 현재 주차의 WAM
    const startMs = new Date(cycle.start_date + 'T00:00:00').getTime()
    const todayMs = Date.now()
    const diffDays = Math.floor((todayMs - startMs) / 86400000)
    const thisWeek = Math.max(1, Math.min(12, Math.floor(diffDays / 7) + 1))

    const { data: wam } = await supabase
      .from('weekly_action_meetings')
      .select('*')
      .eq('cycle_id', cycle.id)
      .eq('week_number', thisWeek)
      .maybeSingle()
    return NextResponse.json({ wam, cycle, this_week: thisWeek })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'WAM 조회 실패' },
      { status: 500 },
    )
  }
}
