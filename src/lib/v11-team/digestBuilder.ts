/**
 * 팀 공유 디지스트 빌더 (#8)
 * Supabase 데이터를 채널별 슬랙 메시지로 변환.
 */
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { calculateCycleProgress, daysUntilNextMonday } from '@/lib/v11-cycle'
import { formatKRW } from '@/lib/formatters'

export type ChannelKind = 'employees' | 'executives' | 'ceo'
export type DigestKind = 'daily' | 'weekly' | 'monthly'

export interface BuiltDigest {
  text: string
  preview: string
  channel: ChannelKind
  kind: DigestKind
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function bigDealLabel(amount: number): string {
  if (amount >= 100_000_000) return '🎉 대형 거래'
  if (amount >= 10_000_000) return '🎊 큰 거래'
  return '💼'
}

// ── 일일 디지스트 (직원 채널) ──
export async function buildDailyDigest(channel: ChannelKind = 'employees'): Promise<BuiltDigest> {
  const supabase = await createClient()
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toDateStr(yesterday)
  const todayStr = toDateStr(today)

  const [yTx, todayTx, samplesPending, deliveryToday, newClients, anns] = await Promise.all([
    supabase
      .from('transactions')
      .select('total_amount, client_id, clients(name)')
      .eq('transaction_date', yesterdayStr)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
    supabase
      .from('transactions')
      .select('client_id')
      .eq('transaction_date', todayStr)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
    supabase
      .from('sample_requests')
      .select('id')
      .eq('request_date', todayStr)
      .eq('status', 'pending'),
    supabase
      .from('transactions')
      .select('id, total_amount, clients(name)')
      .eq('delivery_date', todayStr)
      .in('stage', ['confirmed', 'shipping']),
    supabase
      .from('clients')
      .select('id, name, created_at')
      .gte('created_at', yesterdayStr + 'T00:00:00')
      .lt('created_at', todayStr + 'T00:00:00'),
    supabase
      .from('team_announcements')
      .select('title, body, importance')
      .eq('include_in_daily', true)
      .lte('scheduled_date', todayStr)
      .or(`expires_at.is.null,expires_at.gte.${todayStr}`)
      .is('sent_at', null)
      .order('importance', { ascending: false })
      .limit(3),
  ])

  const yRevenue = (yTx.data ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const yCount = yTx.data?.length ?? 0
  const yClients = new Set((yTx.data ?? []).map((t) => t.client_id).filter(Boolean) as number[]).size

  // 큰 거래 (1천만+)
  const bigDeals = (yTx.data ?? [])
    .filter((t) => Number(t.total_amount || 0) >= 10_000_000)
    .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))

  const dayName = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()]
  const isMonday = today.getDay() === 1

  // 메시지 조립
  const lines: string[] = []
  lines.push(`☀️ *디안 일일 — ${todayStr} ${dayName}요일*`)
  lines.push('')
  lines.push('*📊 어제 결과*')
  lines.push(`• 매출 *${formatKRW(yRevenue)}* · 거래 ${yCount}건 · 활성 거래처 ${yClients}곳`)
  lines.push('')

  if (deliveryToday.data && deliveryToday.data.length > 0) {
    lines.push('*🎯 오늘 일정*')
    lines.push(`• 납기 예정 ${deliveryToday.data.length}건`)
  }
  if (samplesPending.data && samplesPending.data.length > 0) {
    if (!deliveryToday.data?.length) lines.push('*🎯 오늘 일정*')
    lines.push(`• 샘플 요청 대기 ${samplesPending.data.length}건`)
  }
  if (isMonday) {
    if (!deliveryToday.data?.length && !samplesPending.data?.length) lines.push('*🎯 오늘 일정*')
    lines.push(`• 📅 월요일 — WAM 회의 권장`)
  }
  if (deliveryToday.data?.length || samplesPending.data?.length || isMonday) lines.push('')

  // 하이라이트
  const highlights: string[] = []
  if (bigDeals.length > 0) {
    for (const d of bigDeals.slice(0, 2)) {
      const c = (d.clients as { name?: string } | null)?.name ?? '거래처'
      highlights.push(
        `${bigDealLabel(Number(d.total_amount))} ${c} · ${formatKRW(Number(d.total_amount))}`,
      )
    }
  }
  if (newClients.data && newClients.data.length > 0) {
    for (const c of newClients.data.slice(0, 3)) {
      highlights.push(`🎊 신규 거래처: *${c.name}*`)
    }
  }
  if (highlights.length > 0) {
    lines.push('*🌟 어제 하이라이트*')
    for (const h of highlights) lines.push(`• ${h}`)
    lines.push('')
  }

  // 공지
  if (anns.data && anns.data.length > 0) {
    lines.push('*📢 공지*')
    for (const a of anns.data) {
      const prefix = a.importance === 'urgent' ? '🚨 ' : a.importance === 'important' ? '❗️ ' : '• '
      lines.push(`${prefix}*${a.title}*${a.body ? '\n  ' + a.body : ''}`)
    }
  }

  const text = lines.join('\n').trim()
  return {
    text,
    preview: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
    channel,
    kind: 'daily',
  }
}

// ── 주간 디지스트 ──
export async function buildWeeklyDigest(channel: ChannelKind = 'employees'): Promise<BuiltDigest> {
  const supabase = await createClient()
  const today = new Date()
  const dow = today.getDay()
  const lastSunday = new Date(today)
  lastSunday.setDate(today.getDate() - dow)
  const lastMonday = new Date(lastSunday)
  lastMonday.setDate(lastSunday.getDate() - 6)
  const weekStart = toDateStr(lastMonday)
  const weekEnd = toDateStr(lastSunday)

  const prevWeekEnd = new Date(lastMonday)
  prevWeekEnd.setDate(lastMonday.getDate() - 1)
  const prevWeekStart = new Date(prevWeekEnd)
  prevWeekStart.setDate(prevWeekEnd.getDate() - 6)

  const [tx, prevTx, activities, content, cycle, goals, lastWam, ar, atRiskClients] = await Promise.all([
    supabase
      .from('transactions')
      .select('total_amount, client_id, margin_amount')
      .gte('transaction_date', weekStart)
      .lte('transaction_date', weekEnd)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
    supabase
      .from('transactions')
      .select('total_amount')
      .gte('transaction_date', toDateStr(prevWeekStart))
      .lte('transaction_date', toDateStr(prevWeekEnd))
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
    supabase
      .from('sales_activities')
      .select('activity_type')
      .gte('activity_date', weekStart)
      .lte('activity_date', weekEnd),
    supabase
      .from('content_items')
      .select('id')
      .eq('status', 'published')
      .gte('publish_date', weekStart)
      .lte('publish_date', weekEnd),
    supabase
      .from('cycles')
      .select('cycle_number, start_date, end_date')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('goals').select('title, target_value, current_value, unit'),
    supabase
      .from('weekly_action_meetings')
      .select('next_week_priorities, blockers')
      .order('meeting_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    channel !== 'employees'
      ? supabase
          .from('outstanding_payments')
          .select('outstanding, days_overdue')
          .gte('days_overdue', 90)
      : Promise.resolve({ data: [] }),
    channel !== 'employees'
      ? supabase
          .from('clients')
          .select('id')
          .eq('lifecycle_stage', 'at_risk')
          .eq('active', true)
      : Promise.resolve({ data: [] }),
  ])

  const weekRevenue = (tx.data ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const prevRevenue = (prevTx.data ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const revenueDelta =
    prevRevenue > 0 ? ((weekRevenue - prevRevenue) / prevRevenue) * 100 : null
  const activeClients = new Set(
    (tx.data ?? []).map((t) => t.client_id).filter(Boolean) as number[],
  ).size

  const meetings = (activities.data ?? []).filter(
    (a) => a.activity_type === 'meeting' || a.activity_type === 'visit',
  ).length
  const samples = (activities.data ?? []).filter((a) => a.activity_type === 'sample_send').length
  const contentCount = content.data?.length ?? 0

  let cycleStr = ''
  if (cycle.data) {
    const p = calculateCycleProgress(cycle.data.start_date, cycle.data.end_date)
    cycleStr = `사이클 #${cycle.data.cycle_number} · Week ${p.weekNumber}/12 (${(p.totalProgress * 100).toFixed(0)}%)`
  }

  // 목표 진행 (top 3)
  const goalRows = (goals.data ?? [])
    .map((g) => {
      const t = Number(g.target_value) || 0
      const c = Number(g.current_value) || 0
      const r = t > 0 ? c / t : 0
      const filled = Math.round(r * 10)
      const bar = '█'.repeat(Math.min(filled, 10)) + '░'.repeat(Math.max(0, 10 - filled))
      const status = r >= 0.8 ? '✓' : r >= 0.5 ? '' : '⚠'
      return { title: g.title, ratio: r, bar, status }
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5)

  const lines: string[] = []
  lines.push(`📅 *디안 주간 — ${weekStart} ~ ${weekEnd}*`)
  if (cycleStr) lines.push(`_${cycleStr}_`)
  lines.push('')
  lines.push('*📈 지난 주 성과*')
  lines.push(
    `• 매출 *${formatKRW(weekRevenue)}*${
      revenueDelta != null
        ? ` (전주 대비 ${revenueDelta >= 0 ? '+' : ''}${revenueDelta.toFixed(0)}%)`
        : ''
    }`,
  )
  lines.push(`• 활성 거래처 ${activeClients}곳`)
  lines.push(`• 미팅 ${meetings} · 샘플 ${samples} · 콘텐츠 ${contentCount}건 발행`)
  lines.push('')

  if (goalRows.length > 0) {
    lines.push('*🎯 12주 목표 진행*')
    for (const g of goalRows) {
      lines.push(`• \`[${g.bar}]\` ${(g.ratio * 100).toFixed(0)}% — ${g.title} ${g.status}`)
    }
    lines.push('')
  }

  if (lastWam.data) {
    const priorities = (lastWam.data.next_week_priorities ?? []).slice(0, 3)
    if (priorities.length > 0) {
      lines.push('*📋 이번 주 우선순위 (WAM)*')
      priorities.forEach((p: string, i: number) => lines.push(`${i + 1}. ${p}`))
      lines.push('')
    }
    if (lastWam.data.blockers) {
      lines.push('*⚠ 블로커*')
      lines.push(lastWam.data.blockers)
      lines.push('')
    }
  }

  // 임원/CEO 채널만 — 위험 신호
  if (channel !== 'employees') {
    const overdueAmount = (ar.data ?? []).reduce(
      (s, o) => s + Number(o.outstanding || 0),
      0,
    )
    const atRiskCount = atRiskClients.data?.length ?? 0
    if (overdueAmount > 0 || atRiskCount > 0) {
      lines.push('*⚠ 주의 신호 (임원·CEO)*')
      if (overdueAmount > 0) {
        lines.push(
          `• 90일+ 연체 ${ar.data?.length}건, 합계 *${formatKRW(overdueAmount)}*`,
        )
      }
      if (atRiskCount > 0) {
        lines.push(`• 이탈 위험 거래처 ${atRiskCount}곳`)
      }
    }
  }

  const text = lines.join('\n').trim()
  return {
    text,
    preview: text.slice(0, 250) + (text.length > 250 ? '...' : ''),
    channel,
    kind: 'weekly',
  }
}

// ── 월간 디지스트 ──
export async function buildMonthlyDigest(channel: ChannelKind = 'executives'): Promise<BuiltDigest> {
  const supabase = await createClient()
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const start = toDateStr(monthStart)
  const end = toDateStr(monthEnd)

  const yearAgoStart = new Date(monthStart)
  yearAgoStart.setFullYear(yearAgoStart.getFullYear() - 1)
  const yearAgoEnd = new Date(monthEnd)
  yearAgoEnd.setFullYear(yearAgoEnd.getFullYear() - 1)

  const [tx, prevYearTx, expenses, ar, newClients, segments] = await Promise.all([
    supabase
      .from('transactions')
      .select('total_amount, total_cost, margin_amount, client_id')
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
    supabase
      .from('transactions')
      .select('total_amount')
      .gte('transaction_date', toDateStr(yearAgoStart))
      .lte('transaction_date', toDateStr(yearAgoEnd))
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
    supabase
      .from('expenses')
      .select('amount')
      .gte('expense_date', start)
      .lte('expense_date', end),
    supabase.from('outstanding_payments').select('outstanding, days_overdue'),
    supabase
      .from('clients')
      .select('id')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59'),
    supabase.from('revenue_by_segment').select('*'),
  ])

  const revenue = (tx.data ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const margin = (tx.data ?? []).reduce((s, t) => s + Number(t.margin_amount || 0), 0)
  const opex = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount || 0), 0)
  const opProfit = margin - opex
  const prevYearRevenue = (prevYearTx.data ?? []).reduce(
    (s, t) => s + Number(t.total_amount || 0),
    0,
  )
  const yoyDelta =
    prevYearRevenue > 0 ? ((revenue - prevYearRevenue) / prevYearRevenue) * 100 : null

  const overdueAmount = (ar.data ?? [])
    .filter((o) => Number(o.days_overdue) > 0)
    .reduce((s, o) => s + Number(o.outstanding || 0), 0)

  // Top 3 segments
  const topSegments = (segments.data ?? [])
    .filter((s) => Number(s.revenue) > 0)
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 3)

  const month = monthStart.getMonth() + 1
  const year = monthStart.getFullYear()

  const lines: string[] = []
  lines.push(`📊 *디안 ${year}년 ${month}월 결산*`)
  lines.push('')
  lines.push('*💰 재무*')
  lines.push(
    `• 매출 *${formatKRW(revenue)}*${
      yoyDelta != null
        ? ` (전년 동기 ${yoyDelta >= 0 ? '+' : ''}${yoyDelta.toFixed(0)}%)`
        : ''
    }`,
  )
  lines.push(
    `• 공헌이익 ${formatKRW(margin)} (마진 ${revenue > 0 ? ((margin / revenue) * 100).toFixed(1) : 0}%)`,
  )
  lines.push(`• 영업비용 ${formatKRW(opex)} → 영업이익 *${formatKRW(opProfit)}*`)
  lines.push('')

  lines.push('*🏢 거래처*')
  lines.push(`• 활성 거래처 ${new Set((tx.data ?? []).map((t) => t.client_id)).size}곳`)
  lines.push(`• 신규 거래처 ${newClients.data?.length ?? 0}곳`)
  lines.push('')

  if (topSegments.length > 0) {
    lines.push('*🎯 24셀 Top 3 매출*')
    for (const s of topSegments) {
      const pct = revenue > 0 ? (Number(s.revenue) / revenue) * 100 : 0
      lines.push(`• ${s.occupation} × ${s.division}: ${formatKRW(Number(s.revenue))} (${pct.toFixed(0)}%)`)
    }
    lines.push('')
  }

  if (channel !== 'employees' && overdueAmount > 0) {
    lines.push('*⚠ 위험 신호*')
    lines.push(`• 연체 미수금 *${formatKRW(overdueAmount)}*`)
    lines.push('')
  }

  const text = lines.join('\n').trim()
  return {
    text,
    preview: text.slice(0, 250) + (text.length > 250 ? '...' : ''),
    channel,
    kind: 'monthly',
  }
}
