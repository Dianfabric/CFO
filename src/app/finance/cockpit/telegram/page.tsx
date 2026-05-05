/**
 * 텔레그램봇 설정 (Phase 7 #7 ⑧)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, Send, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import TelegramForm from '@/components/v11/cockpit/TelegramForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'telegram_chat_id, telegram_enabled, morning_briefing_time, evening_note_time',
      )
      .eq('id', user.id)
      .maybeSingle()

    return { profile: data, error: error?.message ?? null }
  } catch (e) {
    return null
  }
}

export default async function TelegramPage() {
  const data = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/cockpit"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        코크핏
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #7 ⑧ 텔레그램봇
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Send className="h-5 w-5 text-blue-500" />
          텔레그램봇 설정
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          모닝 브리핑·이브닝 노트를 텔레그램으로 자동 발송 (Phase 1.5 — 수동 발송 권장)
        </p>
      </div>

      {data?.error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {data.error}
        </div>
      )}

      <TelegramForm
        defaults={{
          telegram_chat_id: data?.profile?.telegram_chat_id ?? '',
          telegram_enabled: data?.profile?.telegram_enabled ?? false,
          morning_briefing_time: data?.profile?.morning_briefing_time ?? '07:00',
          evening_note_time: data?.profile?.evening_note_time ?? '21:00',
        }}
      />

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            현재 단계 안내
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-700">
            현재 v1.1에는 <strong>설정 저장만 구현</strong>되어 있습니다. 실제 자동 발송은 다음
            단계에서 추가 예정:
          </p>
          <ol className="ml-4 mt-2 list-decimal space-y-1 text-xs text-slate-700">
            <li>
              <strong>BotFather에서 봇 생성</strong> → BOT_TOKEN 받기 → Vercel 환경변수에 추가
            </li>
            <li>
              <strong>봇과 1회 대화</strong> 후 chat_id 확인 → 이 페이지에 입력
            </li>
            <li>
              <strong>Vercel Cron</strong>이 설정한 시각에 모닝/이브닝 자동 생성 + 텔레그램 발송
            </li>
            <li>
              <strong>봇이 답장 받기</strong> — 라이브 컨설팅을 텔레그램에서 직접 사용
            </li>
          </ol>
          <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-800">
            💡 지금은 매일{' '}
            <Link href="/finance/briefing" className="underline">
              브리핑 페이지
            </Link>
            에 직접 접속해 생성하시면 됩니다. 텔레그램 자동화는 사용 패턴 안정화 후 도입.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
