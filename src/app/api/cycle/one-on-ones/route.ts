/**
 * GET    /api/cycle/one-on-ones?cycle_id=&date_from=&date_to=&status=
 * POST   /api/cycle/one-on-ones  {cycle_id, requester_id, target_id, meeting_date, meeting_time, notes, week_number_created}
 *         → 두 직원 daily_todos 자동 생성 (source_one_on_one_id 연결)
 * PATCH  /api/cycle/one-on-ones  {id, status?, notes?, meeting_date?, meeting_time?}
 * DELETE /api/cycle/one-on-ones?id=  → CASCADE 로 연결된 daily_todos 자동 삭제
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface EmployeeLite {
  id: string
  name: string
  color: string | null
  role_label: string | null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const cycleId = searchParams.get('cycle_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const status = searchParams.get('status')

    let query = supabase
      .from('cycle_one_on_ones')
      .select(
        '*, requester:employees!requester_id(id, name, color, role_label), target:employees!target_id(id, name, color, role_label)',
      )
      .order('meeting_date', { ascending: true })
      .order('meeting_time', { ascending: true })

    if (cycleId) query = query.eq('cycle_id', Number(cycleId))
    if (dateFrom) query = query.gte('meeting_date', dateFrom)
    if (dateTo) query = query.lte('meeting_date', dateTo)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ one_on_ones: data ?? [] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '조회 실패' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const {
      cycle_id,
      requester_id,
      target_id,
      meeting_date,
      meeting_time,
      notes,
      week_number_created,
    } = body as {
      cycle_id?: number
      requester_id?: string
      target_id?: string
      meeting_date?: string
      meeting_time?: string | null
      notes?: string | null
      week_number_created?: number
    }

    if (
      !cycle_id ||
      !requester_id ||
      !target_id ||
      !meeting_date ||
      !week_number_created
    ) {
      return NextResponse.json(
        { error: 'cycle_id, requester_id, target_id, meeting_date, week_number_created 필수' },
        { status: 400 },
      )
    }
    if (requester_id === target_id) {
      return NextResponse.json(
        { error: '자기 자신과의 1:1 은 안 됩니다' },
        { status: 400 },
      )
    }

    // 1) 1:1 미팅 insert
    const { data: inserted, error: insErr } = await supabase
      .from('cycle_one_on_ones')
      .insert({
        cycle_id,
        requester_id,
        target_id,
        meeting_date,
        meeting_time: meeting_time || null,
        notes: notes?.trim() || null,
        week_number_created,
        status: 'pending',
      })
      .select(
        '*, requester:employees!requester_id(id, name, color, role_label), target:employees!target_id(id, name, color, role_label)',
      )
      .single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    // 2) 두 직원 daily_todos 에 자동 todo 생성 — 날짜 + 시간 포함
    const requester = inserted.requester as EmployeeLite | null
    const target = inserted.target as EmployeeLite | null
    const dateLabel = meeting_date.slice(5) // MM-DD
    const timeStr = meeting_time ? meeting_time.slice(0, 5) : ''
    const dtLabel = timeStr ? `${dateLabel} ${timeStr}` : dateLabel
    const titleForRequester = `🤝 1:1 with ${target?.name ?? '직원'} (${dtLabel})${
      notes?.trim() ? ` — ${notes.trim()}` : ''
    }`
    const titleForTarget = `🤝 1:1 with ${requester?.name ?? '직원'} (${dtLabel})${
      notes?.trim() ? ` — ${notes.trim()}` : ''
    }`

    const todoRows = [
      {
        employee_id: requester_id,
        date: meeting_date,
        title: titleForRequester,
        priority: 1,
        status: 'todo',
        weekly_target_id: null,
        source_one_on_one_id: inserted.id,
      },
      {
        employee_id: target_id,
        date: meeting_date,
        title: titleForTarget,
        priority: 1,
        status: 'todo',
        weekly_target_id: null,
        source_one_on_one_id: inserted.id,
      },
    ]
    const { error: todoErr } = await supabase.from('daily_todos').insert(todoRows)
    if (todoErr) {
      // todo 생성 실패해도 1:1 자체는 살림 — 사용자가 미팅 정보를 잃지 않게
      return NextResponse.json({
        one_on_one: inserted,
        warning: `미팅은 등록됐지만 자동 투두 생성 실패: ${todoErr.message}`,
      })
    }

    return NextResponse.json({ one_on_one: inserted })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '등록 실패' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const {
      id,
      status,
      notes,
      meeting_date,
      meeting_time,
      target_confirmed,
    } = body as {
      id?: number
      status?: 'pending' | 'done' | 'cancelled'
      notes?: string | null
      meeting_date?: string
      meeting_time?: string | null
      target_confirmed?: boolean
    }
    if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

    const patch: Record<string, unknown> = {}
    if (status !== undefined) patch.status = status
    if (notes !== undefined) patch.notes = notes?.trim() || null
    if (meeting_date !== undefined) patch.meeting_date = meeting_date
    if (meeting_time !== undefined) patch.meeting_time = meeting_time || null
    if (target_confirmed !== undefined) {
      patch.target_confirmed_at = target_confirmed ? new Date().toISOString() : null
    }

    const { data, error } = await supabase
      .from('cycle_one_on_ones')
      .update(patch)
      .eq('id', id)
      .select(
        '*, requester:employees!requester_id(id, name, color, role_label), target:employees!target_id(id, name, color, role_label)',
      )
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 일정(meeting_date / meeting_time / notes) 변경 시 연결된 daily_todos 의 title 과 date 동기화
    if (
      meeting_date !== undefined ||
      meeting_time !== undefined ||
      notes !== undefined
    ) {
      const requester = data.requester as EmployeeLite | null
      const target = data.target as EmployeeLite | null
      const finalDate = (data.meeting_date as string) ?? meeting_date
      const finalTime = data.meeting_time as string | null
      const finalNotes = data.notes as string | null
      const dateLabel = finalDate.slice(5)
      const timeStr = finalTime ? finalTime.slice(0, 5) : ''
      const dtLabel = timeStr ? `${dateLabel} ${timeStr}` : dateLabel
      const titleForRequester = `🤝 1:1 with ${target?.name ?? '직원'} (${dtLabel})${
        finalNotes ? ` — ${finalNotes}` : ''
      }`
      const titleForTarget = `🤝 1:1 with ${requester?.name ?? '직원'} (${dtLabel})${
        finalNotes ? ` — ${finalNotes}` : ''
      }`
      // 각 직원 todo 업데이트
      if (requester) {
        await supabase
          .from('daily_todos')
          .update({ title: titleForRequester, date: finalDate })
          .eq('source_one_on_one_id', id)
          .eq('employee_id', requester.id)
      }
      if (target) {
        await supabase
          .from('daily_todos')
          .update({ title: titleForTarget, date: finalDate })
          .eq('source_one_on_one_id', id)
          .eq('employee_id', target.id)
      }
    }

    return NextResponse.json({ one_on_one: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '업데이트 실패' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

    // CASCADE — 연결된 daily_todos 도 자동 삭제됨
    const { error } = await supabase
      .from('cycle_one_on_ones')
      .delete()
      .eq('id', Number(id))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '삭제 실패' },
      { status: 500 },
    )
  }
}
