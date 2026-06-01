/**
 * POST /api/cycle/ai-summary
 *
 * 사이클 데이터를 Claude 에게 보내 한 줄 요약 + 권장 사항 생성.
 *
 * body:
 *   cycle_id: number  (없으면 활성 사이클)
 *   regenerate: boolean  (기존 ai_summary 있어도 재생성)
 *
 * 응답:
 *   ai_summary: string  (한 줄)
 *   ai_analysis: { highlights: string[], improvements: string[], next_focus: string[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropic, MODEL, extractText, parseJsonResponse } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const supabase = await createClient()

    // 사이클 조회
    let cycleQuery = supabase.from('cycles').select('*')
    if (body.cycle_id) {
      cycleQuery = cycleQuery.eq('id', body.cycle_id)
    } else {
      cycleQuery = cycleQuery.eq('status', 'active').order('cycle_number', { ascending: false }).limit(1)
    }
    const { data: cycle, error: ce } = await cycleQuery.maybeSingle()
    if (ce || !cycle) {
      return NextResponse.json({ error: ce?.message ?? '사이클 없음' }, { status: 404 })
    }

    // 캐시: regenerate=false 면 기존 ai_summary 반환
    if (!body.regenerate && cycle.ai_summary) {
      return NextResponse.json({
        ai_summary: cycle.ai_summary,
        ai_analysis: cycle.ai_analysis,
        cached: true,
      })
    }

    // 사이클 데이터 수집 — 직원·KR·진행률
    const { data: goals } = await supabase
      .from('employee_goals')
      .select(
        'id, title, business_track, is_big_goal, employees!inner(name, role_label, department)',
      )
      .eq('cycle_id', cycle.id)

    interface GoalRow {
      id: string
      title: string
      business_track: string
      is_big_goal: boolean
      employees: { name: string; role_label: string | null; department: string | null }
    }
    const goalRows = (goals ?? []) as unknown as GoalRow[]
    const goalIds = goalRows.map((g) => g.id)

    let krs: Array<{
      goal_id: string
      title: string
      unit: string
      start_value: number
      target_value: number
      current_value: number
      metric_code: string | null
      lag_metric_code: string | null
      lag_start_value: number | null
      lag_target_value: number | null
      lag_current_value: number | null
    }> = []
    if (goalIds.length > 0) {
      const { data } = await supabase
        .from('key_results')
        .select(
          'goal_id, title, unit, start_value, target_value, current_value, metric_code, lag_metric_code, lag_start_value, lag_target_value, lag_current_value',
        )
        .in('goal_id', goalIds)
      krs = (data ?? []).map((k) => ({
        goal_id: k.goal_id,
        title: k.title,
        unit: k.unit,
        start_value: Number(k.start_value ?? 0),
        target_value: Number(k.target_value ?? 0),
        current_value: Number(k.current_value ?? 0),
        metric_code: k.metric_code,
        lag_metric_code: k.lag_metric_code,
        lag_start_value: k.lag_start_value != null ? Number(k.lag_start_value) : null,
        lag_target_value: k.lag_target_value != null ? Number(k.lag_target_value) : null,
        lag_current_value:
          k.lag_current_value != null ? Number(k.lag_current_value) : null,
      }))
    }

    // 진행률 계산 함수
    const prog = (s: number, t: number, c: number) => {
      const sp = t - s
      if (sp === 0) return c >= t ? 1 : 0
      return Math.max(0, Math.min(1, (c - s) / sp))
    }

    // 사이클 기간 매출
    const { data: tx } = await supabase
      .from('transactions')
      .select('total_amount, margin_amount')
      .gte('transaction_date', cycle.start_date)
      .lte('transaction_date', cycle.end_date)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid'])
    const totalRevenue = (tx ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0)
    const totalMargin = (tx ?? []).reduce((s, t) => s + Number(t.margin_amount || 0), 0)

    // 직원별 데이터 정리 (프롬프트용)
    const empData: Record<
      string,
      {
        role: string
        goals: Array<{
          title: string
          track: string
          is_big: boolean
          krs: Array<{
            title: string
            lead_progress: number
            lag_progress: number | null
            unit: string
            lead_current: number
            lead_target: number
          }>
        }>
      }
    > = {}
    for (const g of goalRows) {
      const empKey = g.employees.name
      if (!empData[empKey]) {
        empData[empKey] = {
          role: g.employees.role_label ?? '',
          goals: [],
        }
      }
      const goalKrs = krs.filter((k) => k.goal_id === g.id).map((k) => ({
        title: k.title,
        lead_progress: prog(k.start_value, k.target_value, k.current_value),
        lag_progress:
          k.lag_target_value != null
            ? prog(
                k.lag_start_value ?? 0,
                k.lag_target_value,
                k.lag_current_value ?? 0,
              )
            : null,
        unit: k.unit,
        lead_current: k.current_value,
        lead_target: k.target_value,
      }))
      empData[empKey].goals.push({
        title: g.title,
        track: g.business_track,
        is_big: g.is_big_goal,
        krs: goalKrs,
      })
    }

    // 프롬프트 작성
    const dataJson = JSON.stringify(
      {
        cycle_number: cycle.cycle_number,
        vision: cycle.vision_statement,
        start: cycle.start_date,
        end: cycle.end_date,
        status: cycle.status,
        total_revenue: totalRevenue,
        total_margin: totalMargin,
        employees: empData,
      },
      null,
      2,
    )

    const prompt = `당신은 디안(Dian) 인테리어 원단 유통 회사의 CFO 코치입니다.
B2B + B2C 멀티티어 비즈니스. 6명 소규모 팀.

아래는 12주 사이클 #${cycle.cycle_number} 의 데이터입니다 (진행률은 0~1 비율).

\`\`\`json
${dataJson}
\`\`\`

다음 JSON 형식으로 답변해주세요. 다른 설명은 절대 추가하지 말고 JSON 만:

{
  "summary": "이번 사이클을 한 문장으로 요약 (한국어, 30자~50자, '~했다/~다' 종결)",
  "highlights": ["잘된 점 1 (한 줄, 20자 내외)", "잘된 점 2", "잘된 점 3"],
  "improvements": ["미흡한 점 1 (한 줄)", "미흡한 점 2"],
  "next_focus": ["다음 사이클 권장 집중 1 (실행 가능한 한 줄)", "다음 사이클 권장 집중 2", "다음 사이클 권장 집중 3"]
}`

    const anthropic = getAnthropic()
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = extractText(msg)
    const parsed = parseJsonResponse<{
      summary: string
      highlights: string[]
      improvements: string[]
      next_focus: string[]
    }>(text)
    if (!parsed) {
      return NextResponse.json(
        { error: 'Claude 응답 파싱 실패', raw: text.slice(0, 500) },
        { status: 500 },
      )
    }

    // DB 캐싱
    await supabase
      .from('cycles')
      .update({
        ai_summary: parsed.summary,
        ai_analysis: {
          highlights: parsed.highlights,
          improvements: parsed.improvements,
          next_focus: parsed.next_focus,
          generated_at: new Date().toISOString(),
        },
        total_revenue: totalRevenue,
        total_margin: totalMargin,
      })
      .eq('id', cycle.id)

    return NextResponse.json({
      ai_summary: parsed.summary,
      ai_analysis: parsed,
      cached: false,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'AI 요약 실패' },
      { status: 500 },
    )
  }
}
