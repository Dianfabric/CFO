/**
 * GET /api/cycle/dashboard-summary
 *
 * 메인 대시보드용 합산 — 회사 핀 KR + 이번 주 전사 투두 실행률.
 *
 * Returns:
 *   pinned_krs       — 회사 핀 KR (v_company_pinned_krs)
 *   week_exec_rate   — 이번 주 모든 직원 투두 done/total
 *   week_total_todos
 *   week_done_todos
 *   week_blocked_todos
 *   b2b_kr_count
 *   b2c_kr_count
 *   employees_summary — 직원별 진행률 합산 (KR 평균)
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentWeekNumber, weekDateRange } from '@/lib/cycle-okr'

export async function GET() {
  try {
    const supabase = await createClient()

    // 활성 사이클
    const { data: cycle } = await supabase
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!cycle) {
      return NextResponse.json({
        cycle: null,
        pinned_krs: [],
        week_exec_rate: 0,
        week_total_todos: 0,
        week_done_todos: 0,
        week_blocked_todos: 0,
        b2b_kr_count: 0,
        b2c_kr_count: 0,
        employees_summary: [],
      })
    }

    // 핀 KR
    const { data: pinned } = await supabase
      .from('v_company_pinned_krs')
      .select('*')

    // 이번 주 todos
    // - 사이클 안의 모든 KR 의 weekNum 주차 weekly_target id 를 모은 뒤
    //   그 id 에 attach 된 daily_todos 를 가져옴 (KR.started_date 와 cycle.start_date 가
    //   달라도 정상 동작)
    // - free todo (weekly_target_id IS NULL) 도 cycle 의 mondayISO~sundayISO 범위로 가져옴
    const weekNum = currentWeekNumber(cycle.start_date, cycle.end_date) || 1
    const { mondayISO, sundayISO } = weekDateRange(cycle.start_date, weekNum)

    // cycle 안의 모든 KR 의 "이번 주" weekly_target id
    // - 각 KR 의 started_date 기준 currentWeek 계산
    // - 그 week_number 의 weekly_target id 만 수집
    let cycleWeeklyTargetIds: string[] = []
    {
      const { data: goalsForWt } = await supabase
        .from('employee_goals')
        .select('id')
        .eq('cycle_id', cycle.id)
      const goalIdList = (goalsForWt ?? []).map((g) => g.id)
      if (goalIdList.length > 0) {
        const { data: krsForWt } = await supabase
          .from('key_results')
          .select('id, started_date')
          .in('goal_id', goalIdList)
        const todayMs = Date.now()
        const krWeekMap = new Map<string, number>() // kr_id → currentWeek
        for (const k of krsForWt ?? []) {
          const krStart = k.started_date ?? cycle.start_date
          const [ky, km, kd] = String(krStart).split('-').map(Number)
          const dt = new Date(ky, km - 1, kd)
          const dow = dt.getDay()
          const offset = dow === 0 ? -6 : 1 - dow
          dt.setDate(dt.getDate() + offset)
          const diffDays = Math.floor(
            (todayMs - dt.getTime()) / (1000 * 60 * 60 * 24),
          )
          const cw = Math.max(1, Math.min(12, Math.floor(diffDays / 7) + 1))
          krWeekMap.set(k.id, cw)
        }
        const krIdList = Array.from(krWeekMap.keys())
        if (krIdList.length > 0) {
          const { data: wts } = await supabase
            .from('weekly_targets')
            .select('id, key_result_id, week_number')
            .in('key_result_id', krIdList)
          // KR 별 currentWeek 의 wt 만 필터
          cycleWeeklyTargetIds = (wts ?? [])
            .filter((w) => krWeekMap.get(w.key_result_id) === w.week_number)
            .map((w) => w.id)
        }
      }
    }

    // 1) weekly_target 에 attach 된 이번주 todos
    let weeklyAttached: Array<{ status: string; employee_id: string }> = []
    if (cycleWeeklyTargetIds.length > 0) {
      const { data: tds } = await supabase
        .from('daily_todos')
        .select('status, employee_id')
        .in('weekly_target_id', cycleWeeklyTargetIds)
      weeklyAttached = tds ?? []
    }
    // 2) free todos (weekly_target_id 없음) — cycle 의 mondayISO~sundayISO 범위
    const { data: freeTodos } = await supabase
      .from('daily_todos')
      .select('status, employee_id')
      .is('weekly_target_id', null)
      .gte('date', mondayISO)
      .lte('date', sundayISO)

    const todos = [...weeklyAttached, ...(freeTodos ?? [])]
    const total = todos.length
    const done = todos.filter((t) => t.status === 'done').length
    const blocked = todos.filter((t) => t.status === 'blocked').length

    // 전사 KR 트랙별 카운트
    const { data: allGoals } = await supabase
      .from('employee_goals')
      .select('id, business_track')
      .eq('cycle_id', cycle.id)
    const b2bGoals = (allGoals ?? []).filter((g) => g.business_track === 'b2b')
    const b2cGoals = (allGoals ?? []).filter((g) => g.business_track === 'b2c')
    const b2bGoalIds = b2bGoals.map((g) => g.id)
    const b2cGoalIds = b2cGoals.map((g) => g.id)

    let b2bKrCount = 0
    let b2cKrCount = 0
    if (b2bGoalIds.length > 0) {
      const { count } = await supabase
        .from('key_results')
        .select('id', { count: 'exact', head: true })
        .in('goal_id', b2bGoalIds)
      b2bKrCount = count ?? 0
    }
    if (b2cGoalIds.length > 0) {
      const { count } = await supabase
        .from('key_results')
        .select('id', { count: 'exact', head: true })
        .in('goal_id', b2cGoalIds)
      b2cKrCount = count ?? 0
    }

    // 직원별 진행률 (색동 신사업 프로젝트는 제외 — /saekdong 전용)
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, color, role_label, business_track')
      .eq('active', true)
      .neq('department', '__saekdong_project__')
      .order('display_order')

    interface BigKrDetail {
      kr_id: string
      kr_title: string
      // 선행
      lead_metric_code: string | null
      lead_unit: string
      lead_start: number
      lead_target: number
      lead_current: number
      lead_progress: number
      // 후행
      lag_metric_code: string | null
      lag_unit: string | null
      lag_start: number | null
      lag_target: number | null
      lag_current: number | null
      lag_progress: number | null
      // 이번 주
      this_week_target_id: string | null
      this_week_target_value: number
      this_week_actual_value: number
      this_week_note: string | null
      this_week_todos: Array<{
        id: string
        date: string
        title: string
        priority: number
        status: string
      }>
    }
    const empSummary: Array<{
      id: string
      name: string
      color: string
      role_label: string | null
      business_track: string
      avg_progress: number
      kr_count: number
      goal_count: number
      week_done: number
      week_total: number
      big_goal_title: string | null
      big_goal_track: string | null
      this_week_todo_titles: string[]
      big_goal_id: string | null
      big_goal_krs: BigKrDetail[]
    }> = []

    // 이번 주 todo 의 제목들 (각 직원별) — 위와 같은 방식 (weekly_target_id + free)
    let attachedFull: Array<{ employee_id: string; title: string; status: string }> = []
    if (cycleWeeklyTargetIds.length > 0) {
      const { data: tds } = await supabase
        .from('daily_todos')
        .select('employee_id, title, status')
        .in('weekly_target_id', cycleWeeklyTargetIds)
        .order('order_in_day')
      attachedFull = tds ?? []
    }
    const { data: freeTodosFull } = await supabase
      .from('daily_todos')
      .select('employee_id, title, status')
      .is('weekly_target_id', null)
      .gte('date', mondayISO)
      .lte('date', sundayISO)
      .order('order_in_day')
    const weekTodosFull = [...attachedFull, ...(freeTodosFull ?? [])]

    interface KrShape {
      id: string
      title: string
      unit: string
      start_value: number | string | null
      target_value: number | string | null
      current_value: number | string | null
      metric_code: string | null
      lag_unit: string | null
      lag_start_value: number | string | null
      lag_target_value: number | string | null
      lag_current_value: number | string | null
      lag_metric_code: string | null
      started_date: string | null
    }

    // ✨ Parallel: 8명 직원 동시 처리 + 각 직원 안의 KR 도 동시 처리
    const empResults = await Promise.all(
      (employees ?? []).map(async (e) => {
        // 직원 목표 (빅 포함)
        const { data: gs } = await supabase
          .from('employee_goals')
          .select('id, title, is_big_goal, business_track, display_order, status')
          .eq('cycle_id', cycle.id)
          .eq('employee_id', e.id)
          .order('display_order')
        const gIds = (gs ?? []).map((x) => x.id)
        const bigGoal =
          (gs ?? []).find((x) => x.is_big_goal) ??
          (gs ?? []).find((x) => x.status === 'active')

        // KR 진행률 평균 + 빅 목표 상세 — 동시 fetch (한 직원 안에서도 sequential 제거)
        const [krsForAvgRes, krsForBigRes] = await Promise.all([
          gIds.length > 0
            ? supabase
                .from('key_results')
                .select('start_value, target_value, current_value')
                .in('goal_id', gIds)
            : Promise.resolve({ data: [] as Array<{ start_value: number | string | null; target_value: number | string | null; current_value: number | string | null }> }),
          bigGoal
            ? supabase
                .from('key_results')
                .select(
                  'id, title, unit, start_value, target_value, current_value, metric_code, ' +
                    'lag_unit, lag_start_value, lag_target_value, lag_current_value, lag_metric_code, started_date',
                )
                .eq('goal_id', bigGoal.id)
                .order('display_order')
            : Promise.resolve({ data: [] as unknown[] }),
        ])

        let avgProgress = 0
        const krsForAvg = krsForAvgRes.data ?? []
        const krCount = krsForAvg.length
        if (krCount > 0) {
          const sum = krsForAvg.reduce((s, kr) => {
            const span = Number(kr.target_value) - Number(kr.start_value)
            if (span === 0)
              return s + (Number(kr.current_value) >= Number(kr.target_value) ? 1 : 0)
            const p = (Number(kr.current_value) - Number(kr.start_value)) / span
            return s + Math.max(0, Math.min(1, p))
          }, 0)
          avgProgress = sum / krCount
        }

        const myWeekTodos = todos.filter((t) => t.employee_id === e.id)
        const myWeekTodoTitles = (weekTodosFull ?? [])
          .filter((t) => t.employee_id === e.id && t.status !== 'done')
          .map((t) => t.title)
          .slice(0, 3)

        // 빅 목표 KR 들 — Promise.all 로 동시 처리
        const krs = ((krsForBigRes.data ?? []) as unknown as KrShape[])
        const bigKrs: BigKrDetail[] = bigGoal
          ? await Promise.all(
              krs.map(async (kr) => {
                const krStart = kr.started_date ?? cycle.start_date
                const [ky, km, kd] = krStart.split('-').map(Number)
                const dt = new Date(ky, km - 1, kd)
                const dow = dt.getDay()
                const offset = dow === 0 ? -6 : 1 - dow
                dt.setDate(dt.getDate() + offset)
                const today = new Date()
                const diffDays = Math.floor(
                  (today.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24),
                )
                const krCurrentWeek = Math.max(
                  1,
                  Math.min(12, Math.floor(diffDays / 7) + 1),
                )

                const { data: wt } = await supabase
                  .from('weekly_targets')
                  .select('id, target_value, actual_value, note')
                  .eq('key_result_id', kr.id)
                  .eq('week_number', krCurrentWeek)
                  .maybeSingle()

                let weekTodos: BigKrDetail['this_week_todos'] = []
                if (wt) {
                  const { data: tds } = await supabase
                    .from('daily_todos')
                    .select('id, date, title, priority, status')
                    .eq('weekly_target_id', wt.id)
                    .order('date')
                    .order('order_in_day')
                  weekTodos = (tds ?? []) as BigKrDetail['this_week_todos']
                }

                const ls = Number(kr.start_value ?? 0)
                const lt = Number(kr.target_value ?? 0)
                const lc = Number(kr.current_value ?? 0)
                const leadProgress =
                  lt === ls
                    ? lc >= lt
                      ? 1
                      : 0
                    : Math.max(0, Math.min(1, (lc - ls) / (lt - ls)))

                let lagProgress: number | null = null
                if (kr.lag_target_value != null) {
                  const lgs = Number(kr.lag_start_value ?? 0)
                  const lgt = Number(kr.lag_target_value)
                  const lgc = Number(kr.lag_current_value ?? lgs)
                  lagProgress =
                    lgt === lgs
                      ? lgc >= lgt
                        ? 1
                        : 0
                      : Math.max(0, Math.min(1, (lgc - lgs) / (lgt - lgs)))
                }

                return {
                  kr_id: kr.id,
                  kr_title: kr.title,
                  lead_metric_code: kr.metric_code,
                  lead_unit: kr.unit,
                  lead_start: ls,
                  lead_target: lt,
                  lead_current: lc,
                  lead_progress: leadProgress,
                  lag_metric_code: kr.lag_metric_code,
                  lag_unit: kr.lag_unit,
                  lag_start:
                    kr.lag_start_value != null ? Number(kr.lag_start_value) : null,
                  lag_target:
                    kr.lag_target_value != null ? Number(kr.lag_target_value) : null,
                  lag_current:
                    kr.lag_current_value != null
                      ? Number(kr.lag_current_value)
                      : null,
                  lag_progress: lagProgress,
                  this_week_target_id: wt?.id ?? null,
                  this_week_target_value: Number(wt?.target_value ?? 0),
                  this_week_actual_value: Number(wt?.actual_value ?? 0),
                  this_week_note: wt?.note ?? null,
                  this_week_todos: weekTodos,
                }
              }),
            )
          : []

        return {
          id: e.id,
          name: e.name,
          color: e.color,
          role_label: e.role_label,
          business_track: e.business_track,
          avg_progress: avgProgress,
          kr_count: krCount,
          goal_count: gIds.length,
          week_done: myWeekTodos.filter((t) => t.status === 'done').length,
          week_total: myWeekTodos.length,
          big_goal_title: bigGoal?.title ?? null,
          big_goal_track: bigGoal?.business_track ?? null,
          this_week_todo_titles: myWeekTodoTitles,
          big_goal_id: bigGoal?.id ?? null,
          big_goal_krs: bigKrs,
        }
      }),
    )
    empSummary.push(...empResults)

    return NextResponse.json({
      cycle,
      week_number: weekNum,
      week_monday: mondayISO,
      week_sunday: sundayISO,
      pinned_krs: pinned ?? [],
      week_exec_rate: total > 0 ? done / total : 0,
      week_total_todos: total,
      week_done_todos: done,
      week_blocked_todos: blocked,
      b2b_kr_count: b2bKrCount,
      b2c_kr_count: b2cKrCount,
      employees_summary: empSummary,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '요약 조회 실패' },
      { status: 500 },
    )
  }
}
