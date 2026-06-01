/**
 * POST /api/cycle/finalize
 *
 * 활성 사이클을 종료하고 (status='completed'), 새 사이클을 시작합니다.
 * 옵션:
 *   carryover_unfinished: true  - 미완료 KR (진행률 < 100%) 을 새 사이클로 이월
 *   start_date: '...'           - 새 사이클 시작일 (default: 활성 사이클 end_date + 1)
 *   end_date: '...'             - 새 사이클 종료일 (default: 시작일 + 12주 - 1)
 *   vision_statement: '...'     - 새 사이클의 큰 목표 (default: 이전과 동일)
 *
 * carryover 동작:
 *   - 새 cycle 생성
 *   - 각 직원의 빅 목표 + KR 복사 (start_value = 이전 final current_value)
 *   - weekly_targets 새로 12주 자동 분할
 *   - 일일 투두는 복사 안 함 (각 주 시작 시 새로 작성)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const carryover = body.carryover_unfinished !== false
    const supabase = await createClient()

    // 활성 사이클
    const { data: oldCycle, error: ce } = await supabase
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (ce || !oldCycle) {
      return NextResponse.json({ error: '활성 사이클 없음' }, { status: 404 })
    }

    // 사이클 누적 매출 스냅샷
    const { data: tx } = await supabase
      .from('transactions')
      .select('total_amount, margin_amount')
      .gte('transaction_date', oldCycle.start_date)
      .lte('transaction_date', oldCycle.end_date)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid'])
    const totalRevenue = (tx ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )
    const totalMargin = (tx ?? []).reduce(
      (s, t) => s + Number(t.margin_amount || 0),
      0,
    )

    // 1) 이전 사이클 종료
    await supabase
      .from('cycles')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_revenue: totalRevenue,
        total_margin: totalMargin,
      })
      .eq('id', oldCycle.id)

    // 2) 새 사이클 시작일·종료일 결정
    const oldEnd = new Date(String(oldCycle.end_date) + 'T00:00:00')
    const defaultNewStart = new Date(oldEnd)
    defaultNewStart.setDate(oldEnd.getDate() + 1)
    const newStart = body.start_date
      ? new Date(String(body.start_date) + 'T00:00:00')
      : defaultNewStart
    const newEnd = body.end_date
      ? new Date(String(body.end_date) + 'T00:00:00')
      : (() => {
          const e = new Date(newStart)
          e.setDate(newStart.getDate() + 11 * 7 + 4) // 12주차 금요일
          return e
        })()

    const fmt = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    // 3) 새 사이클 생성
    const { data: newCycle, error: nce } = await supabase
      .from('cycles')
      .insert({
        cycle_number: Number(oldCycle.cycle_number) + 1,
        start_date: fmt(newStart),
        end_date: fmt(newEnd),
        vision_statement: body.vision_statement ?? oldCycle.vision_statement,
        status: 'active',
        previous_cycle_id: oldCycle.id,
      })
      .select('*')
      .single()
    if (nce || !newCycle) {
      return NextResponse.json({ error: nce?.message ?? '새 사이클 생성 실패' }, { status: 500 })
    }

    // 4) Carryover (선택)
    let carryoverCount = 0
    if (carryover) {
      // 이전 사이클 빅 목표 + KR 복사
      const { data: oldGoals } = await supabase
        .from('employee_goals')
        .select(
          'id, employee_id, title, business_track, status, display_order, is_big_goal',
        )
        .eq('cycle_id', oldCycle.id)

      for (const g of oldGoals ?? []) {
        // 새 cycle 에 같은 직원으로 goal 복사
        const { data: newGoal } = await supabase
          .from('employee_goals')
          .insert({
            cycle_id: newCycle.id,
            employee_id: g.employee_id,
            title: g.title,
            business_track: g.business_track,
            status: 'active',
            display_order: g.display_order,
            is_big_goal: g.is_big_goal,
          })
          .select('*')
          .single()
        if (!newGoal) continue

        // 그 goal 의 KR 들 복사
        const { data: oldKrs } = await supabase
          .from('key_results')
          .select('*')
          .eq('goal_id', g.id)
          .order('display_order')

        for (const kr of oldKrs ?? []) {
          // 미완료 KR — current_value 를 새 start_value 로
          const oldCurrent = Number(kr.current_value ?? 0)
          const oldTarget = Number(kr.target_value ?? 0)
          const completed = oldTarget !== 0 && oldCurrent >= oldTarget
          if (completed) continue // 이미 달성된 건 carryover 안 함

          // 미완료 분만큼 새 KR 의 목표 (예: 600 목표 / 480 달성 → 새 사이클 480→600)
          // 또는 같은 목표값으로 새로 시작 (사용자가 결정)
          // 단순: 같은 목표값 + start_value = 이전 current_value
          const { data: newKr } = await supabase
            .from('key_results')
            .insert({
              goal_id: newGoal.id,
              title: kr.title,
              unit: kr.unit,
              is_leading: kr.is_leading,
              start_value: oldCurrent,
              target_value: oldTarget,
              current_value: oldCurrent,
              metric_code: kr.metric_code,
              auto_sync: kr.auto_sync,
              expected_lag_impact: kr.expected_lag_impact,
              started_date: fmt(newStart),
              // 후행 페어
              lag_metric_code: kr.lag_metric_code,
              lag_unit: kr.lag_unit,
              lag_start_value: kr.lag_current_value,
              lag_target_value: kr.lag_target_value,
              lag_current_value: kr.lag_current_value,
              lag_auto_sync: kr.lag_auto_sync,
              display_order: kr.display_order,
              is_company_pinned: kr.is_company_pinned,
              pinned_order: kr.pinned_order,
            })
            .select('*')
            .single()
          if (!newKr) continue

          // weekly_targets 12개 자동 분할
          const ns = Number(newKr.start_value ?? 0)
          const nt = Number(newKr.target_value ?? 0)
          const span = nt - ns
          const weeklyRows = Array.from({ length: 12 }).map((_, i) => ({
            key_result_id: newKr.id,
            week_number: i + 1,
            target_value: Number((ns + (span * (i + 1)) / 12).toFixed(2)),
            actual_value: 0,
          }))
          await supabase.from('weekly_targets').insert(weeklyRows)
          carryoverCount++
        }
      }
    }

    return NextResponse.json({
      old_cycle: oldCycle.id,
      new_cycle: newCycle,
      carryover_kr_count: carryoverCount,
      total_revenue: totalRevenue,
      total_margin: totalMargin,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '사이클 종료 실패' },
      { status: 500 },
    )
  }
}
