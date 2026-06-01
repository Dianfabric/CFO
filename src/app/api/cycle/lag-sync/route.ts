/**
 * POST /api/cycle/lag-sync
 *
 * 활성 사이클의 auto_sync=true KR 들 (metric_code=revenue|margin) 의
 * current_value 를 transactions 합산으로 자동 갱신.
 *
 * body:
 *   employee_id  — (옵션) 특정 직원만
 *   key_result_id — (옵션) 특정 KR 만
 *
 * 호출 시점:
 *   - 직원별 OKR 페이지 진입 시 1회
 *   - 일일 결산 후 매일 1회 (선택)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const employeeId: string | undefined = body.employee_id
    const krId: string | undefined = body.key_result_id

    const supabase = await createClient()

    // 활성 사이클
    const { data: cycle } = await supabase
      .from('cycles')
      .select('id, start_date, end_date')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cycle) {
      return NextResponse.json({ synced: 0, message: '활성 사이클 없음' })
    }

    // 1) 활성 사이클 안의 goal_id 목록
    let goalQuery = supabase
      .from('employee_goals')
      .select('id, employee_id')
      .eq('cycle_id', cycle.id)
    if (employeeId) goalQuery = goalQuery.eq('employee_id', employeeId)
    const { data: goals, error: gErr } = await goalQuery
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    const goalIds = (goals ?? []).map((g) => g.id)
    if (goalIds.length === 0) {
      return NextResponse.json({ synced: 0, message: '대상 목표 없음' })
    }

    // 2) auto_sync 또는 lag_auto_sync KR 들
    let krQuery = supabase
      .from('key_results')
      .select(
        'id, goal_id, metric_code, current_value, start_value, auto_sync, ' +
          'lag_metric_code, lag_current_value, lag_start_value, lag_auto_sync',
      )
      .in('goal_id', goalIds)
      .or('auto_sync.eq.true,lag_auto_sync.eq.true')

    if (krId) krQuery = krQuery.eq('id', krId)

    const { data: krs, error: krErr } = await krQuery
    if (krErr) return NextResponse.json({ error: krErr.message }, { status: 500 })
    if (!krs || krs.length === 0) {
      return NextResponse.json({ synced: 0, message: '동기화 대상 KR 없음' })
    }

    // 사이클 기간 transactions 집계 (직원별 / 전체)
    // 현재 transactions 에는 employee_id 컬럼이 없으므로
    // 일단 회사 전체 합으로 모든 직원의 매출 KR 에 동일하게 적용 (단순화)
    const { data: tx } = await supabase
      .from('transactions')
      .select('total_amount, margin_amount')
      .gte('transaction_date', cycle.start_date)
      .lte('transaction_date', cycle.end_date)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid'])

    const totalRevenue = (tx ?? []).reduce(
      (s, t) => s + Number(t.total_amount || 0),
      0,
    )
    const totalMargin = (tx ?? []).reduce(
      (s, t) => s + Number(t.margin_amount || 0),
      0,
    )

    // 각 KR 갱신 — 선행 또는 후행 두 차원 모두
    let synced = 0
    interface KrSyncRow {
      id: string
      metric_code: string | null
      current_value: number | null
      start_value: number | null
      auto_sync: boolean
      lag_metric_code: string | null
      lag_current_value: number | null
      lag_start_value: number | null
      lag_auto_sync: boolean
    }
    for (const kr of krs as unknown as KrSyncRow[]) {
      const patch: Record<string, number> = {}

      // 선행 측정값 자동 집계
      if (kr.auto_sync && (kr.metric_code === 'revenue' || kr.metric_code === 'margin')) {
        const total = kr.metric_code === 'revenue' ? totalRevenue : totalMargin
        const newCurrent = Number(kr.start_value ?? 0) + total
        if (newCurrent !== Number(kr.current_value)) {
          patch.current_value = newCurrent
        }
      }

      // 후행 측정값 자동 집계
      if (
        kr.lag_auto_sync &&
        (kr.lag_metric_code === 'revenue' || kr.lag_metric_code === 'margin')
      ) {
        const total = kr.lag_metric_code === 'revenue' ? totalRevenue : totalMargin
        const newCurrent = Number(kr.lag_start_value ?? 0) + total
        if (newCurrent !== Number(kr.lag_current_value ?? 0)) {
          patch.lag_current_value = newCurrent
        }
      }

      if (Object.keys(patch).length > 0) {
        await supabase.from('key_results').update(patch).eq('id', kr.id)
        synced++
      }
    }

    return NextResponse.json({
      synced,
      cycle_id: cycle.id,
      total_revenue: totalRevenue,
      total_margin: totalMargin,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '동기화 실패' },
      { status: 500 },
    )
  }
}
