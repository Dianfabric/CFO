'use server'
/**
 * 팀 공유 (#8) Server Actions
 * - 공지 CRUD
 * - 슬랙 설정 업데이트
 * - 슬랙 즉시 발송 (Webhook POST)
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  buildDailyDigest,
  buildWeeklyDigest,
  buildMonthlyDigest,
  type ChannelKind,
  type DigestKind,
} from '@/lib/v11-team/digestBuilder'

// ── Announcements ──────────────────────────────────────────────
export interface AnnouncementInput {
  id?: number
  title: string
  body?: string | null
  importance?: 'normal' | 'important' | 'urgent'
  target_channel?: 'employees' | 'executives' | 'ceo'
  include_in_daily?: boolean
  include_in_weekly?: boolean
  scheduled_date?: string | null
  expires_at?: string | null
}

export async function upsertAnnouncement(
  input: AnnouncementInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const payload = {
      title: input.title,
      body: input.body ?? null,
      importance: input.importance ?? 'normal',
      target_channel: input.target_channel ?? 'employees',
      include_in_daily: input.include_in_daily ?? true,
      include_in_weekly: input.include_in_weekly ?? false,
      scheduled_date:
        input.scheduled_date ?? new Date().toISOString().slice(0, 10),
      expires_at: input.expires_at ?? null,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await supabase
        .from('team_announcements')
        .update(payload)
        .eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/team/announcements')
      revalidatePath('/finance/team')
      return { ok: true, id: input.id }
    }

    const { data, error } = await supabase
      .from('team_announcements')
      .insert({ ...payload, created_by: user.id })
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/team/announcements')
    revalidatePath('/finance/team')
    return { ok: true, id: data.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteAnnouncement(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase
      .from('team_announcements')
      .delete()
      .eq('id', id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/team/announcements')
    revalidatePath('/finance/team')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Slack Settings ─────────────────────────────────────────────
export interface SlackSettingsInput {
  enabled?: boolean
  employees_webhook?: string | null
  executives_webhook?: string | null
  ceo_webhook?: string | null
  daily_time?: string
  weekly_time?: string
  monthly_time?: string
  daily_enabled?: boolean
  weekly_enabled?: boolean
  monthly_enabled?: boolean
  alerts_enabled?: boolean
  big_deal_threshold?: number
  overdue_alert_days?: number
}

export async function updateSlackSettings(
  input: SlackSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase
      .from('slack_settings')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', 1)

    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/team/slack')
    revalidatePath('/finance/team')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Send to Slack (Webhook POST) ──────────────────────────────
export interface SendDigestInput {
  kind: DigestKind
  channel: ChannelKind
}

export async function sendDigestToSlack(
  input: SendDigestInput,
): Promise<{ ok: boolean; error?: string; preview?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    // 설정 조회
    const { data: settings, error: settingsError } = await supabase
      .from('slack_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (settingsError) return { ok: false, error: settingsError.message }
    if (!settings) return { ok: false, error: '슬랙 설정을 찾을 수 없습니다.' }
    if (!settings.enabled)
      return { ok: false, error: '슬랙 발송이 비활성화 상태입니다. 설정을 켜주세요.' }

    const webhookKey =
      input.channel === 'employees'
        ? 'employees_webhook'
        : input.channel === 'executives'
          ? 'executives_webhook'
          : 'ceo_webhook'
    const webhook = settings[webhookKey] as string | null
    if (!webhook)
      return {
        ok: false,
        error: `${input.channel} 채널의 Webhook URL이 설정되지 않았습니다.`,
      }

    // 메시지 빌드
    let digest
    if (input.kind === 'daily') digest = await buildDailyDigest(input.channel)
    else if (input.kind === 'weekly') digest = await buildWeeklyDigest(input.channel)
    else digest = await buildMonthlyDigest(input.channel)

    // 발송
    let status = 'sent'
    let statusCode: number | null = null
    let errorMsg: string | null = null

    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: digest.text }),
      })
      statusCode = res.status
      if (!res.ok) {
        status = 'failed'
        errorMsg = await res.text()
      }
    } catch (e) {
      status = 'failed'
      errorMsg = e instanceof Error ? e.message : String(e)
    }

    // 로그 저장
    await supabase.from('slack_send_log').insert({
      target_channel: input.channel,
      message_type: input.kind,
      payload: { text: digest.text },
      status,
      status_code: statusCode,
      error: errorMsg,
      triggered_by: user.id,
    })

    // include_in_daily 공지 — 오늘 발송된 것으로 마킹
    if (input.kind === 'daily' && status === 'sent') {
      const today = new Date().toISOString().slice(0, 10)
      await supabase
        .from('team_announcements')
        .update({ sent_at: new Date().toISOString() })
        .eq('include_in_daily', true)
        .lte('scheduled_date', today)
        .is('sent_at', null)
    }

    revalidatePath('/finance/team')
    revalidatePath('/finance/team/slack')

    if (status === 'failed') {
      return {
        ok: false,
        error: `발송 실패 (${statusCode}): ${errorMsg ?? '알 수 없는 오류'}`,
      }
    }
    return { ok: true, preview: digest.preview }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Test webhook (간단 "Hello" 발송) ──────────────────────────
export async function testWebhook(
  channel: ChannelKind,
): Promise<{ ok: boolean; error?: string; status?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { data: settings } = await supabase
      .from('slack_settings')
      .select('employees_webhook, executives_webhook, ceo_webhook')
      .eq('id', 1)
      .maybeSingle()
    if (!settings) return { ok: false, error: '설정 없음.' }

    const url =
      channel === 'employees'
        ? settings.employees_webhook
        : channel === 'executives'
          ? settings.executives_webhook
          : settings.ceo_webhook
    if (!url) return { ok: false, error: 'Webhook URL이 비어있습니다.' }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🧪 *디안 CFO — 연결 테스트*\n채널: \`${channel}\`\n시간: ${new Date().toLocaleString('ko-KR')}\n_이 메시지가 보이면 Webhook이 정상 작동 중입니다._`,
      }),
    })

    await supabase.from('slack_send_log').insert({
      target_channel: channel,
      message_type: 'test',
      status: res.ok ? 'sent' : 'failed',
      status_code: res.status,
      triggered_by: user.id,
    })

    revalidatePath('/finance/team/slack')
    if (!res.ok) {
      const txt = await res.text()
      return { ok: false, error: `${res.status}: ${txt}`, status: res.status }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
