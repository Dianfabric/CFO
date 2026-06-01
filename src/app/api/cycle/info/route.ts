/**
 * GET   /api/cycle/info  — 활성 사이클 메타 조회
 * PATCH /api/cycle/info  — 사이클 메타 수정 (start_date / end_date / vision_statement)
 *
 * 시작일이 변경되면:
 *   - 활성 사이클의 모든 KR 의 started_date 도 자동 동기화 (delta 만큼 shift)
 *   - 이미 직원별로 다른 시작일을 가진 KR 은 같은 delta 만큼 shift (개별 차이 유지)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ cycle: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '사이클 조회 실패' },
      { status: 500 },
    )
  }
}

const EDITABLE = ['start_date', 'end_date', 'vision_statement', 'status'] as const

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createClient()

    // 활성 사이클 조회
    const { data: cycle, error: ce } = await supabase
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (ce || !cycle) {
      return NextResponse.json(
        { error: ce?.message ?? '활성 사이클 없음' },
        { status: 404 },
      )
    }

    const patch: Record<string, unknown> = {}
    for (const k of EDITABLE) {
      if (body[k] !== undefined) patch[k] = body[k]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: '수정할 내용 없음' }, { status: 400 })
    }

    // 시작일 변경 시 delta 계산 → 모든 KR.started_date 동기화
    let dayDelta = 0
    if (patch.start_date && cycle.start_date !== patch.start_date) {
      const oldStart = new Date(String(cycle.start_date) + 'T00:00:00')
      const newStart = new Date(String(patch.start_date) + 'T00:00:00')
      dayDelta = Math.round(
        (newStart.getTime() - oldStart.getTime()) / (1000 * 60 * 60 * 24),
      )
    }

    // cycle 업데이트
    const { data: updated, error: ue } = await supabase
      .from('cycles')
      .update(patch)
      .eq('id', cycle.id)
      .select('*')
      .single()
    if (ue) return NextResponse.json({ error: ue.message }, { status: 500 })

    // KR.started_date 동기화 (delta 만큼 shift)
    let synced = 0
    if (dayDelta !== 0) {
      // 활성 사이클 안의 모든 KR 조회
      const { data: goals } = await supabase
        .from('employee_goals')
        .select('id')
        .eq('cycle_id', cycle.id)
      const gIds = (goals ?? []).map((g) => g.id)
      if (gIds.length > 0) {
        const { data: krs } = await supabase
          .from('key_results')
          .select('id, started_date')
          .in('goal_id', gIds)
        for (const kr of krs ?? []) {
          // KR 의 started_date 가 null 이면 cycle.start_date 로 채움 + delta 적용
          // 있으면 그 날짜에 delta 만큼 shift
          const base = kr.started_date ?? cycle.start_date
          const d = new Date(String(base) + 'T00:00:00')
          d.setDate(d.getDate() + dayDelta)
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          await supabase
            .from('key_results')
            .update({ started_date: `${y}-${m}-${day}` })
            .eq('id', kr.id)
          synced++
        }
      }
    }

    return NextResponse.json({ cycle: updated, day_delta: dayDelta, kr_synced: synced })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '수정 실패' },
      { status: 500 },
    )
  }
}
