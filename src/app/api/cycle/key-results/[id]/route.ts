/**
 * PATCH  /api/cycle/key-results/[id]
 *   - is_company_pinned 토글: 자동으로 pinned_order 가장 마지막 부여
 *   - target_value / start_value 변경 시 weekly_targets 재분배 (옵션: ?redistribute=true)
 * DELETE /api/cycle/key-results/[id]  — CASCADE 로 주간/투두까지
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

const EDITABLE = [
  'title',
  'unit',
  'is_leading',
  'start_value',
  'target_value',
  'current_value',
  'is_company_pinned',
  'pinned_order',
  'display_order',
  'metric_code',
  'auto_sync',
  'expected_lag_impact',
  'started_date',
  // 후행 페어
  'lag_metric_code',
  'lag_unit',
  'lag_start_value',
  'lag_target_value',
  'lag_current_value',
  'lag_auto_sync',
] as const

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const redistribute = searchParams.get('redistribute') === 'true'

  try {
    const body = await request.json()
    const patch: Record<string, unknown> = {}
    for (const k of EDITABLE) {
      if (body[k] !== undefined) patch[k] = body[k]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: '수정할 내용 없음' }, { status: 400 })
    }

    const supabase = await createClient()

    // 핀 토글 시 pinned_order 자동
    if (patch.is_company_pinned === true && body.pinned_order === undefined) {
      const { data: last } = await supabase
        .from('key_results')
        .select('pinned_order')
        .eq('is_company_pinned', true)
        .order('pinned_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      patch.pinned_order = (last?.pinned_order ?? 0) + 1
    } else if (patch.is_company_pinned === false) {
      patch.pinned_order = null
    }

    const { data, error } = await supabase
      .from('key_results')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 사용자가 직접 보낸 주간 타겟 (KrForm 인라인) — upsert
    if (Array.isArray(body.weekly_targets) && body.weekly_targets.length > 0) {
      interface UserWeekly {
        week_number?: number
        target_value?: unknown
        actual_value?: unknown
        note?: string | null
      }
      const rows = (body.weekly_targets as UserWeekly[])
        .filter((w) => w.week_number && w.target_value !== undefined)
        .map((w) => {
          const row: Record<string, unknown> = {
            key_result_id: id,
            week_number: w.week_number,
            target_value: Number(w.target_value),
          }
          // actual_value 는 null/빈 칸을 무시하지 않고 NULL 로 클리어 가능하게 처리
          if (w.actual_value !== undefined) {
            row.actual_value =
              w.actual_value === null || w.actual_value === ''
                ? 0
                : Number(w.actual_value)
          }
          if (w.note !== undefined) {
            row.note = w.note ?? null
          }
          return row
        })
      if (rows.length > 0) {
        await supabase
          .from('weekly_targets')
          .upsert(rows, { onConflict: 'key_result_id,week_number' })
      }
    } else if (redistribute && data) {
      // 자동 재분배 (start/target 변경 시 — query param redistribute=true)
      const startV = Number(data.start_value ?? 0)
      const targetV = Number(data.target_value)
      const span = targetV - startV
      const rows = Array.from({ length: 12 }).map((_, i) => ({
        key_result_id: id,
        week_number: i + 1,
        target_value: Number((startV + (span * (i + 1)) / 12).toFixed(2)),
      }))
      await supabase
        .from('weekly_targets')
        .upsert(rows, { onConflict: 'key_result_id,week_number' })
    }

    return NextResponse.json({ key_result: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '수정 실패' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('key_results').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '삭제 실패' },
      { status: 500 },
    )
  }
}
