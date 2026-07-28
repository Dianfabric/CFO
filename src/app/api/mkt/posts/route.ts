/**
 * 마케팅 콘텐츠 발행 시스템 API (대표 지시 2026-07-14)
 *
 * GET  ?start=YYYY-MM-DD&end=YYYY-MM-DD — 기간 내 계획/발행 + 준수율 + 템플릿
 * POST { action: 'create', channel, content_type, planned_date, title? }
 *      { action: 'status', id, status: 'done'|'skipped'|'planned' }
 *      { action: 'update', id, title?, memo?, planned_date? }
 *      { action: 'delete', id }
 *      { action: 'template-add', channel, content_type, weekday }
 *      { action: 'template-del', id }
 *      { action: 'generate-week', monday: 'YYYY-MM-DD' } — 템플릿으로 그 주 슬롯 생성(중복 스킵)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CHANNELS = ['dian_blog', 'dian_insta', 'dian_yt', 'saek_blog', 'saek_insta', 'saek_yt']
const TYPES = ['info', 'brand', 'carousel', 'reels', 'video']

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const start = sp.get('start')
    const end = sp.get('end')
    if (!start || !end) return NextResponse.json({ error: 'start, end 필요' }, { status: 400 })
    const sb = createServiceClient()
    const [postsRes, tplRes] = await Promise.all([
      sb.from('mkt_posts').select('*').gte('planned_date', start).lte('planned_date', end)
        .order('planned_date').limit(1000),
      sb.from('mkt_slot_templates').select('*').eq('active', true).order('weekday'),
    ])
    if (postsRes.error) {
      if (/does not exist|schema cache/i.test(postsRes.error.message)) {
        return NextResponse.json({ posts: [], templates: [], tableMissing: true })
      }
      return NextResponse.json({ error: postsRes.error.message }, { status: 500 })
    }
    const posts = postsRes.data ?? []
    // 준수율 — 오늘까지 예정된 것 중 done 비율
    const today = new Date().toLocaleDateString('sv-SE')
    const due = posts.filter((p) => p.planned_date <= today && p.status !== 'skipped')
    const done = due.filter((p) => p.status === 'done')
    return NextResponse.json({
      posts,
      templates: tplRes.data ?? [],
      adherence: { due: due.length, done: done.length, pct: due.length ? Math.round((done.length / due.length) * 100) : null },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const sb = createServiceClient()
    if (b.action === 'create') {
      if (!CHANNELS.includes(b.channel) || !TYPES.includes(b.content_type) || !b.planned_date) {
        return NextResponse.json({ error: 'channel/content_type/planned_date 확인' }, { status: 400 })
      }
      const { data, error } = await sb.from('mkt_posts')
        .insert({ channel: b.channel, content_type: b.content_type, planned_date: b.planned_date, title: b.title?.trim() || null })
        .select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, post: data })
    }
    if (b.action === 'status') {
      const { error } = await sb.from('mkt_posts')
        .update({ status: b.status, done_at: b.status === 'done' ? new Date().toISOString() : null })
        .eq('id', b.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    if (b.action === 'update') {
      const patch: Record<string, unknown> = {}
      if (b.title !== undefined) patch.title = b.title?.trim() || null
      if (b.memo !== undefined) patch.memo = b.memo?.trim() || null
      if (b.planned_date) patch.planned_date = b.planned_date
      const { error } = await sb.from('mkt_posts').update(patch).eq('id', b.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    if (b.action === 'delete') {
      const { error } = await sb.from('mkt_posts').delete().eq('id', b.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    if (b.action === 'template-add') {
      if (!CHANNELS.includes(b.channel) || !TYPES.includes(b.content_type) || b.weekday == null) {
        return NextResponse.json({ error: 'channel/content_type/weekday 확인' }, { status: 400 })
      }
      const { data, error } = await sb.from('mkt_slot_templates')
        .insert({ channel: b.channel, content_type: b.content_type, weekday: b.weekday })
        .select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, template: data })
    }
    if (b.action === 'template-del') {
      const { error } = await sb.from('mkt_slot_templates').delete().eq('id', b.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    if (b.action === 'bulk-create') {
      // AI 기획 확정 → 기간 전체 계획 일괄 등록 (중복 날짜+채널+유형 스킵)
      const rows = (Array.isArray(b.rows) ? b.rows : []).filter(
        (r: { channel: string; content_type: string; planned_date: string }) =>
          CHANNELS.includes(r.channel) && TYPES.includes(r.content_type) && /^\d{4}-\d{2}-\d{2}$/.test(r.planned_date ?? ''),
      )
      if (!rows.length) return NextResponse.json({ error: '유효한 rows 없음' }, { status: 400 })
      const dates = rows.map((r: { planned_date: string }) => r.planned_date).sort()
      const { data: existing } = await sb.from('mkt_posts').select('channel, content_type, planned_date')
        .gte('planned_date', dates[0]).lte('planned_date', dates[dates.length - 1])
      const has = new Set((existing ?? []).map((p) => `${p.channel}|${p.content_type}|${p.planned_date}`))
      const fresh = rows
        .filter((r: { channel: string; content_type: string; planned_date: string }) => !has.has(`${r.channel}|${r.content_type}|${r.planned_date}`))
        .map((r: { channel: string; content_type: string; planned_date: string; title?: string }) => ({
          channel: r.channel, content_type: r.content_type, planned_date: r.planned_date, title: r.title?.trim() || null,
        }))
      if (fresh.length) {
        const { error } = await sb.from('mkt_posts').insert(fresh)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, created: fresh.length, skipped: rows.length - fresh.length })
    }
    if (b.action === 'generate-week') {
      // monday 기준 한 주 — 템플릿마다 해당 요일 날짜에 슬롯 생성 (이미 있으면 스킵)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.monday ?? '')) {
        return NextResponse.json({ error: 'monday(YYYY-MM-DD) 필요' }, { status: 400 })
      }
      const { data: tpls, error: tErr } = await sb.from('mkt_slot_templates').select('*').eq('active', true)
      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
      const weekEnd = new Date(b.monday + 'T12:00:00')
      weekEnd.setDate(weekEnd.getDate() + 6)
      const { data: existing } = await sb.from('mkt_posts').select('channel, content_type, planned_date')
        .gte('planned_date', b.monday).lte('planned_date', weekEnd.toLocaleDateString('sv-SE'))
      const has = new Set((existing ?? []).map((p) => `${p.channel}|${p.content_type}|${p.planned_date}`))
      const rows = []
      for (const t of tpls ?? []) {
        const d = new Date(b.monday + 'T12:00:00')
        d.setDate(d.getDate() + t.weekday)
        const date = d.toLocaleDateString('sv-SE')
        if (has.has(`${t.channel}|${t.content_type}|${date}`)) continue
        rows.push({ channel: t.channel, content_type: t.content_type, planned_date: date })
      }
      if (rows.length) {
        const { error } = await sb.from('mkt_posts').insert(rows)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, created: rows.length })
    }
    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '처리 실패' }, { status: 500 })
  }
}
