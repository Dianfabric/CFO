'use client'
/**
 * 슬랙 설정 폼 + Webhook 테스트 + 즉시 발송
 */
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  updateSlackSettings,
  testWebhook,
  sendDigestToSlack,
} from '@/app/finance/team/actions'
import {
  Save,
  Loader2,
  Send,
  TestTube2,
  CheckCircle2,
  AlertCircle,
  Power,
} from 'lucide-react'
import type { ChannelKind, DigestKind } from '@/lib/v11-team/digestBuilder'

interface Settings {
  enabled: boolean
  employees_webhook: string | null
  executives_webhook: string | null
  ceo_webhook: string | null
  daily_time: string
  weekly_time: string
  monthly_time: string
  daily_enabled: boolean
  weekly_enabled: boolean
  monthly_enabled: boolean
  alerts_enabled: boolean
  big_deal_threshold: number
  overdue_alert_days: number
}

interface Props {
  settings: Settings
}

const channels: { key: ChannelKind; label: string; field: keyof Settings; desc: string }[] = [
  {
    key: 'employees',
    label: '직원 채널',
    field: 'employees_webhook',
    desc: '일일·주간 지표 + 공지 (#dian-team 등)',
  },
  {
    key: 'executives',
    label: '임원 채널',
    field: 'executives_webhook',
    desc: '주간·월간 + 위험 신호 (#dian-leaders 등)',
  },
  {
    key: 'ceo',
    label: 'CEO 채널',
    field: 'ceo_webhook',
    desc: '대표 전용 알림 (#dian-ceo 등, 본인만 접근)',
  },
]

export default function SlackSettingsForm({ settings }: Props) {
  const [pending, startTransition] = useTransition()
  const [testPending, setTestPending] = useState<ChannelKind | null>(null)
  const [sendPending, setSendPending] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = {
      enabled: fd.get('enabled') === 'on',
      employees_webhook: (fd.get('employees_webhook') as string) || null,
      executives_webhook: (fd.get('executives_webhook') as string) || null,
      ceo_webhook: (fd.get('ceo_webhook') as string) || null,
      daily_time: (fd.get('daily_time') as string) || '09:00',
      weekly_time: (fd.get('weekly_time') as string) || '10:00',
      monthly_time: (fd.get('monthly_time') as string) || '10:00',
      daily_enabled: fd.get('daily_enabled') === 'on',
      weekly_enabled: fd.get('weekly_enabled') === 'on',
      monthly_enabled: fd.get('monthly_enabled') === 'on',
      alerts_enabled: fd.get('alerts_enabled') === 'on',
      big_deal_threshold: Number(fd.get('big_deal_threshold')) || 10000000,
      overdue_alert_days: Number(fd.get('overdue_alert_days')) || 90,
    }

    startTransition(async () => {
      const res = await updateSlackSettings(input)
      setMsg({ ok: res.ok, text: res.ok ? '저장 완료' : res.error ?? '저장 실패' })
    })
  }

  const handleTest = (channel: ChannelKind) => {
    setMsg(null)
    setTestPending(channel)
    ;(async () => {
      const res = await testWebhook(channel)
      setTestPending(null)
      setMsg({
        ok: res.ok,
        text: res.ok
          ? `${channel} 채널 테스트 메시지 발송 완료 (${res.status})`
          : res.error ?? '테스트 실패',
      })
    })()
  }

  const handleSendNow = (kind: DigestKind, channel: ChannelKind) => {
    setMsg(null)
    const id = `${kind}-${channel}`
    setSendPending(id)
    ;(async () => {
      const res = await sendDigestToSlack({ kind, channel })
      setSendPending(null)
      setMsg({
        ok: res.ok,
        text: res.ok
          ? `${kind} → ${channel} 발송 완료`
          : res.error ?? '발송 실패',
      })
    })()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 마스터 토글 */}
      <Card
        className={
          settings.enabled
            ? 'border-emerald-200 bg-emerald-50/30'
            : 'border-slate-200 bg-slate-50/30'
        }
      >
        <CardContent className="py-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={settings.enabled}
              className="h-5 w-5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Power
                  className={`h-4 w-4 ${
                    settings.enabled ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <span className="text-sm font-semibold text-slate-900">
                  슬랙 발송 마스터 스위치
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">
                꺼져 있으면 자동·수동 발송 모두 차단됩니다.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">채널별 Webhook URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[11px] text-slate-500">
            Slack → Apps → Incoming Webhooks → Add to Slack → 채널 선택 → Webhook URL 복사
          </p>
          {channels.map((c) => (
            <div key={c.key}>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">
                  <span className="font-semibold">{c.label}</span>{' '}
                  <span className="font-normal text-slate-500">— {c.desc}</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleTest(c.key)}
                  disabled={testPending !== null}
                >
                  {testPending === c.key ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <TestTube2 className="mr-1 h-3 w-3" />
                      테스트
                    </>
                  )}
                </Button>
              </div>
              <Input
                name={c.field}
                type="password"
                defaultValue={settings[c.field] as string ?? ''}
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                className="mt-1 font-mono text-xs"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 발송 시간 + 활성화 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">자동 발송 스케줄</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-slate-500">
            ※ 자동 발송은 별도 cron 워커 또는 Vercel Scheduled Functions 가 필요합니다 (다음 단계). 현재는
            수동 발송만 작동합니다.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="daily_enabled"
                  defaultChecked={settings.daily_enabled}
                />
                📅 일일 디지스트
              </label>
              <Input
                type="time"
                name="daily_time"
                defaultValue={settings.daily_time?.slice(0, 5) ?? '09:00'}
                className="mt-2"
              />
              <p className="mt-1 text-[10px] text-slate-500">매일 평일 → 직원 채널</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="weekly_enabled"
                  defaultChecked={settings.weekly_enabled}
                />
                📈 주간 디지스트
              </label>
              <Input
                type="time"
                name="weekly_time"
                defaultValue={settings.weekly_time?.slice(0, 5) ?? '10:00'}
                className="mt-2"
              />
              <p className="mt-1 text-[10px] text-slate-500">월요일 → 직원·임원</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="monthly_enabled"
                  defaultChecked={settings.monthly_enabled}
                />
                📊 월간 결산
              </label>
              <Input
                type="time"
                name="monthly_time"
                defaultValue={settings.monthly_time?.slice(0, 5) ?? '10:00'}
                className="mt-2"
              />
              <p className="mt-1 text-[10px] text-slate-500">매월 1일 → 임원·CEO</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 알림 임계값 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">실시간 알림 임계값</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              name="alerts_enabled"
              defaultChecked={settings.alerts_enabled}
            />
            실시간 알림 활성화 (이상치/큰 거래/연체)
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">큰 거래 알림 기준 (원)</Label>
              <Input
                type="number"
                name="big_deal_threshold"
                defaultValue={settings.big_deal_threshold}
                step={1000000}
                min={0}
              />
              <p className="mt-0.5 text-[10px] text-slate-500">
                기본 1천만 원 — 이상의 거래는 직원 채널에 즉시 알림
              </p>
            </div>
            <div>
              <Label className="text-xs">연체 알림 기준 (일)</Label>
              <Input
                type="number"
                name="overdue_alert_days"
                defaultValue={settings.overdue_alert_days}
                min={0}
              />
              <p className="mt-0.5 text-[10px] text-slate-500">
                기본 90일 — 이상 연체 발생 시 임원·CEO 채널 알림
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 즉시 발송 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">즉시 발송</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[11px] text-slate-500">
            현재 데이터 기준으로 디지스트를 즉시 슬랙에 발송합니다. 마스터 스위치가 켜져
            있어야 동작합니다.
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSendNow('daily', 'employees')}
              disabled={sendPending !== null || !settings.enabled}
            >
              {sendPending === 'daily-employees' ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1 h-3 w-3" />
              )}
              일일 → 직원
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSendNow('weekly', 'employees')}
              disabled={sendPending !== null || !settings.enabled}
            >
              {sendPending === 'weekly-employees' ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1 h-3 w-3" />
              )}
              주간 → 직원
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSendNow('monthly', 'executives')}
              disabled={sendPending !== null || !settings.enabled}
            >
              {sendPending === 'monthly-executives' ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1 h-3 w-3" />
              )}
              월간 → 임원
            </Button>
          </div>
        </CardContent>
      </Card>

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
            msg.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="mr-1 h-3.5 w-3.5" />
              설정 저장
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
