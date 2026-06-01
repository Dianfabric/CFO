/**
 * GET /api/cron/wam-weekly
 *
 * Vercel Cron — 매주 월요일 오전 8시 KST (UTC 일요일 23:00) 자동 실행.
 * 활성 사이클의 이번 주 WAM 회의 자료를 Claude AI 로 자동 생성.
 *
 * Vercel Cron 은 production 에서만 작동. 인증 헤더 검증.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Vercel Cron 인증 (production 에서만)
  const authHeader = request.headers.get('authorization')
  const isVercelCron =
    process.env.VERCEL === '1' &&
    authHeader === `Bearer ${process.env.CRON_SECRET ?? ''}`
  // 개발 환경 또는 인증 없으면 — production 차단
  if (process.env.NODE_ENV === 'production' && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 내부 API 호출 — WAM 자동 생성 (regenerate=true)
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const r = await fetch(`${baseUrl}/api/cycle/wam/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regenerate: true,
        triggered_by: 'cron',
      }),
    })
    const j = await r.json()

    return NextResponse.json({
      ok: r.ok,
      triggered_at: new Date().toISOString(),
      result: j,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Cron 실행 실패' },
      { status: 500 },
    )
  }
}
