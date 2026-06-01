/**
 * GET /api/cycle/kpis  — 활성 사이클의 모든 KR (KPI) 데이터
 *
 * 진행률 차트용. 모든 직원의 모든 KR.
 * - 선행/후행 그룹
 * - 각 KR 의 진행률·current·target·unit
 * - 직원 정보 (이름·색상·트랙)
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface KpiKr {
  kr_id: string
  kr_title: string
  // 선행
  lead_metric: string | null
  lead_unit: string
  lead_start: number
  lead_target: number
  lead_current: number
  lead_progress: number // 0~1
  // 후행
  lag_metric: string | null
  lag_unit: string | null
  lag_start: number | null
  lag_target: number | null
  lag_current: number | null
  lag_progress: number | null
  // 메타
  is_big_goal: boolean
  goal_title: string
  goal_business_track: string
  employee_id: string
  employee_name: string
  employee_color: string
  employee_track: string
}

function progress(start: number, target: number, current: number): number {
  const span = target - start
  if (span === 0) return current >= target ? 1 : 0
  return Math.max(0, Math.min(1, (current - start) / span))
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: cycle } = await supabase
      .from('cycles')
      .select('id')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cycle) return NextResponse.json({ kpis: [], cycle: null })

    // 활성 사이클의 모든 goal + KR + employee 정보
    const { data: rows, error } = await supabase
      .from('key_results')
      .select(
        `
        id, title, unit, start_value, target_value, current_value, metric_code,
        lag_unit, lag_start_value, lag_target_value, lag_current_value, lag_metric_code,
        employee_goals!inner (
          id, title, is_big_goal, business_track, cycle_id, employee_id,
          employees!inner ( id, name, color, business_track )
        )
        `,
      )
      .eq('employee_goals.cycle_id', cycle.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    interface Row {
      id: string
      title: string
      unit: string
      start_value: number | string
      target_value: number | string
      current_value: number | string
      metric_code: string | null
      lag_unit: string | null
      lag_start_value: number | string | null
      lag_target_value: number | string | null
      lag_current_value: number | string | null
      lag_metric_code: string | null
      employee_goals: {
        id: string
        title: string
        is_big_goal: boolean
        business_track: string
        employees: {
          id: string
          name: string
          color: string
          business_track: string
        }
      }
    }
    const krs = (rows ?? []) as unknown as Row[]

    const kpis: KpiKr[] = krs.map((kr) => {
      const ls = Number(kr.start_value ?? 0)
      const lt = Number(kr.target_value ?? 0)
      const lc = Number(kr.current_value ?? 0)
      const leadProgress = progress(ls, lt, lc)

      let lagProgress: number | null = null
      if (kr.lag_target_value != null) {
        const gs = Number(kr.lag_start_value ?? 0)
        const gt = Number(kr.lag_target_value)
        const gc = Number(kr.lag_current_value ?? gs)
        lagProgress = progress(gs, gt, gc)
      }

      const goal = kr.employee_goals
      const emp = goal.employees

      return {
        kr_id: kr.id,
        kr_title: kr.title,
        lead_metric: kr.metric_code,
        lead_unit: kr.unit,
        lead_start: ls,
        lead_target: lt,
        lead_current: lc,
        lead_progress: leadProgress,
        lag_metric: kr.lag_metric_code,
        lag_unit: kr.lag_unit,
        lag_start: kr.lag_start_value != null ? Number(kr.lag_start_value) : null,
        lag_target: kr.lag_target_value != null ? Number(kr.lag_target_value) : null,
        lag_current:
          kr.lag_current_value != null ? Number(kr.lag_current_value) : null,
        lag_progress: lagProgress,
        is_big_goal: goal.is_big_goal,
        goal_title: goal.title,
        goal_business_track: goal.business_track,
        employee_id: emp.id,
        employee_name: emp.name,
        employee_color: emp.color,
        employee_track: emp.business_track,
      }
    })

    return NextResponse.json({ kpis, cycle })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'KPI 조회 실패' },
      { status: 500 },
    )
  }
}
