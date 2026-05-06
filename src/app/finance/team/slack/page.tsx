/**
 * 슬랙 설정 페이지 (#8)
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
  ChevronLeft,
  Send as SlackIcon,
  ExternalLink,
  Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SlackSettingsForm from '@/components/v11/team/SlackSettingsForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEFAULTS = {
  enabled: false,
  employees_webhook: null,
  executives_webhook: null,
  ceo_webhook: null,
  daily_time: '09:00:00',
  weekly_time: '10:00:00',
  monthly_time: '10:00:00',
  daily_enabled: true,
  weekly_enabled: true,
  monthly_enabled: true,
  alerts_enabled: true,
  big_deal_threshold: 10000000,
  overdue_alert_days: 90,
}

async function loadData() {
  try {
    const supabase = await createClient()
    const [settings, logs] = await Promise.all([
      supabase.from('slack_settings').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('slack_send_log')
        .select('id, target_channel, message_type, status, status_code, sent_at, error')
        .order('sent_at', { ascending: false })
        .limit(20),
    ])

    return {
      settings: settings.data ?? DEFAULTS,
      logs: logs.data ?? [],
      error: settings.error?.message,
    }
  } catch (e) {
    return {
      settings: DEFAULTS,
      logs: [],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function SlackSettingsPage() {
  const { settings, logs, error } = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/team"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        팀 공유 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #8 팀 공유
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <SlackIcon className="h-5 w-5 text-slate-500" />
          슬랙 설정
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          채널별 Webhook URL · 발송 시간 · 알림 임계값
        </p>
      </div>

      {/* 안내 */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-xs text-blue-900">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">Incoming Webhooks 설정 절차</p>
              <ol className="list-inside list-decimal space-y-0.5 text-blue-800">
                <li>
                  Slack 워크스페이스 → Apps →{' '}
                  <a
                    href="https://my.slack.com/services/new/incoming-webhook/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 underline hover:text-blue-700"
                  >
                    Incoming Webhooks <ExternalLink className="h-3 w-3" />
                  </a>{' '}
                  추가
                </li>
                <li>대상 채널(예: #dian-team) 선택 → "Add Incoming WebHooks integration"</li>
                <li>생성된 Webhook URL 을 아래 필드에 붙여넣기</li>
                <li>채널마다 별도 Webhook을 만들어주세요 (직원/임원/CEO)</li>
              </ol>
              <p className="mt-1 text-[11px] italic text-blue-700">
                ※ Webhook URL은 비밀번호와 같습니다. 노출되지 않도록 주의하세요. 데이터베이스에는 저장되지만 화면에는 마스킹되어 표시됩니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-200 bg-rose-50/30">
          <CardContent className="py-3 text-xs text-rose-700">
            ⚠ 데이터 로드 실패: {error}
          </CardContent>
        </Card>
      )}

      <SlackSettingsForm settings={settings} />

      {/* 발송 이력 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">발송 이력 (최근 20건)</CardTitle>
          <CardDescription className="text-xs">
            성공·실패 여부 및 응답 코드를 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm italic text-slate-400">발송 이력이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-slate-200 text-xs">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center gap-2 py-2"
                >
                  <span className="text-[10px] text-slate-400 w-32 shrink-0">
                    {l.sent_at
                      ? new Date(l.sent_at).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                    {l.message_type}
                  </span>
                  <span className="text-slate-600">→ {l.target_channel}</span>
                  <span
                    className={`ml-auto rounded px-2 py-0.5 text-[10px] font-semibold ${
                      l.status === 'sent'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {l.status}
                    {l.status_code ? ` (${l.status_code})` : ''}
                  </span>
                  {l.error && (
                    <span className="w-full text-[10px] text-rose-600 mt-0.5 truncate">
                      ⚠ {l.error}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
