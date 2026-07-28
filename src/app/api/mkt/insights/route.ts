/**
 * 마케팅 채널 성과 (대표 지시 2026-07-28)
 * GET — 색동 인스타(IG Graph API) 팔로워를 실시간 조회해 오늘 스냅샷으로 저장하고,
 *       채널별 최근 90일 추이를 반환. (유튜브는 API 키 등록 시 추가)
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sb = createServiceClient()
    const today = new Date().toLocaleDateString('sv-SE')
    const live: Record<string, { followers: number; extra?: Record<string, unknown>; error?: string }> = {}

    // 색동 인스타 — IG Graph API
    const igToken = process.env.IG_GRAPH_TOKEN
    const igId = process.env.IG_BUSINESS_ACCOUNT_ID
    if (igToken && igId) {
      try {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${igId}?fields=followers_count,media_count,username&access_token=${igToken}`,
          { signal: AbortSignal.timeout(10000) },
        )
        const j = await r.json()
        if (j.followers_count != null) {
          live.saek_insta = { followers: j.followers_count, extra: { media_count: j.media_count, username: j.username } }
          await sb.from('mkt_channel_stats').upsert(
            { channel: 'saek_insta', stat_date: today, followers: j.followers_count, extra: live.saek_insta.extra },
            { onConflict: 'channel,stat_date' },
          )
        } else {
          live.saek_insta = { followers: 0, error: j.error?.message ?? '조회 실패 (토큰 만료 가능)' }
        }
      } catch (e) {
        live.saek_insta = { followers: 0, error: e instanceof Error ? e.message : '연결 실패' }
      }
    }

    // 추이 (전 채널 90일)
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const { data: history } = await sb
      .from('mkt_channel_stats')
      .select('channel, stat_date, followers')
      .gte('stat_date', since.toLocaleDateString('sv-SE'))
      .order('stat_date')
      .limit(1000)

    return NextResponse.json({ live, history: history ?? [] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 500 })
  }
}
