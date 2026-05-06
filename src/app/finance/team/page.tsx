/**
 * 팀 공유 허브 (#8)
 * - 일일/주간/월간 디지스트 미리보기 + 즉시 발송
 * - 슬랙 설정 상태 카드
 * - 공지·발송 이력 요약
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  Send as SlackIcon,
  Megaphone,
  History,
  AlertCircle,
  CheckCircle2,
  Settings as SettingsIcon,
  Bell,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  buildDailyDigest,
  buildWeeklyDigest,
  buildMonthlyDigest,
} from '@/lib/v11-team/digestBuilder'
import DigestTabs from '@/components/v11/team/DigestTabs'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const [settings, anns, logs, daily, weekly, monthly] = await Promise.all([
      supabase.from('slack_settings').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('team_announcements')
        .select('id, title, importance, scheduled_date, sent_at')
        .gte(
          'scheduled_date',
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        )
        .order('scheduled_date', { ascending: false })
        .limit(5),
      supabase
        .from('slack_send_log')
        .select('id, target_channel, message_type, status, sent_at')
        .order('sent_at', { ascending: false })
        .limit(5),
      buildDailyDigest('employees').catch((e) => ({
        text: `(미리보기 생성 실패: ${e instanceof Error ? e.message : String(e)})`,
        preview: '',
        channel: 'employees' as const,
        kind: 'daily' as const,
      })),
      buildWeeklyDigest('employees').catch((e) => ({
        text: `(미리보기 생성 실패: ${e instanceof Error ? e.message : String(e)})`,
        preview: '',
        channel: 'employees' as const,
        kind: 'weekly' as const,
      })),
      buildMonthlyDigest('executives').catch((e) => ({
        text: `(미리보기 생성 실패: ${e instanceof Error ? e.message : String(e)})`,
        preview: '',
        channel: 'executives' as const,
        kind: 'monthly' as const,
      })),
    ])

    return {
      settings: settings.data,
      anns: anns.data ?? [],
      logs: logs.data ?? [],
      daily: daily.text,
      weekly: weekly.text,
      monthly: monthly.text,
    }
  } catch (e) {
    return {
      settings: null,
      anns: [],
      logs: [],
      daily: `(불러오기 실패: ${e instanceof Error ? e.message : String(e)})`,
      weekly: '',
      monthly: '',
    }
  }
}

export default async function TeamHubPage() {
  const data = await loadData()
  const s = data.settings
  const isReady = !!(
    s?.enabled &&
    (s?.employees_webhook || s?.executives_webhook || s?.ceo_webhook)
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #8 팀 공유
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <SlackIcon className="h-5 w-5 text-slate-500" />
          팀 공유 허브
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          일일·주간·월간 지표를 슬랙으로 자동 공유 — 직원·임원·CEO 채널 분리
        </p>
      </div>

      {/* 상태 카드 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card
          className={
            isReady
              ? 'border-emerald-200 bg-emerald-50/30'
              : 'border-amber-200 bg-amber-50/30'
          }
        >
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              {isReady ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              )}
              <span className={isReady ? 'text-emerald-700' : 'text-amber-700'}>
                {isReady ? '슬랙 발송 준비 완료' : '슬랙 설정 필요'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {isReady
                ? '설정된 채널로 즉시 발송할 수 있습니다.'
                : 'Webhook URL을 등록하고 활성화 토글을 켜주세요.'}
            </p>
            <Link
              href="/finance/team/slack"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:underline"
            >
              <SettingsIcon className="h-3 w-3" />
              슬랙 설정 →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Megaphone className="h-3.5 w-3.5" />
              최근 공지
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {data.anns.length}
              <span className="ml-1 text-xs font-normal text-slate-500">건 (7일)</span>
            </p>
            <Link
              href="/finance/team/announcements"
              className="mt-1 inline-flex text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline"
            >
              공지 관리 →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <History className="h-3.5 w-3.5" />
              최근 발송 (5건)
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {data.logs.length}
              <span className="ml-1 text-xs font-normal text-slate-500">
                · 성공{' '}
                {data.logs.filter((l) => l.status === 'sent').length}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 미리보기 + 발송 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-amber-500" />
            슬랙 디지스트 미리보기
          </CardTitle>
          <CardDescription>
            현재 데이터로 생성한 메시지 — 즉시 발송은 채널 선택 후 버튼 클릭
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DigestTabs
            daily={data.daily}
            weekly={data.weekly}
            monthly={data.monthly}
          />
        </CardContent>
      </Card>

      {/* 최근 공지 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-slate-500" />
            최근 공지
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.anns.length === 0 ? (
            <p className="text-sm italic text-slate-400">최근 7일 공지 없음.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.anns.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-slate-400">
                      {a.scheduled_date}
                    </span>
                    {a.importance === 'urgent' && (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                        긴급
                      </span>
                    )}
                    {a.importance === 'important' && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        중요
                      </span>
                    )}
                    <span className="text-slate-800">{a.title}</span>
                  </div>
                  <span
                    className={`text-[10px] ${
                      a.sent_at ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {a.sent_at ? '✓ 발송' : '대기'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 발송 이력 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-slate-500" />
            최근 발송 이력
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.logs.length === 0 ? (
            <p className="text-sm italic text-slate-400">발송 이력 없음.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {data.logs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">
                      {l.sent_at
                        ? new Date(l.sent_at).toLocaleString('ko-KR', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </span>
                    <span className="font-medium text-slate-700">
                      {l.message_type}
                    </span>
                    <span className="text-slate-500">→ {l.target_channel}</span>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                      l.status === 'sent'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {l.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
