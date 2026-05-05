'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save, Loader2, AlertCircle } from 'lucide-react'
import { updateTelegramSettings, type TelegramInput } from '@/app/finance/cockpit/actions'

export default function TelegramForm({ defaults }: { defaults: TelegramInput }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [chatId, setChatId] = useState(defaults.telegram_chat_id ?? '')
  const [enabled, setEnabled] = useState(defaults.telegram_enabled ?? false)
  const [morning, setMorning] = useState(defaults.morning_briefing_time ?? '07:00')
  const [evening, setEvening] = useState(defaults.evening_note_time ?? '21:00')

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updateTelegramSettings({
        telegram_chat_id: chatId || null,
        telegram_enabled: enabled,
        morning_briefing_time: morning || null,
        evening_note_time: evening || null,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      setSavedAt(new Date())
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">봇 연결</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="chat">Chat ID</Label>
            <Input
              id="chat"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="예: 123456789"
            />
            <p className="text-[11px] text-slate-500">
              BotFather로 봇 만든 후, 본인 텔레그램에서 봇과 1회 대화하면 chat_id 발급
            </p>
          </div>

          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>
              <strong>텔레그램 발송 활성화</strong> — 활성 시 브리핑·노트가 텔레그램으로 발송됩니다
              (실제 발송은 추후 구현)
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">발송 시각</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="space-y-1.5">
              <Label className="text-[11px]">모닝 브리핑</Label>
              <Input type="time" value={morning} onChange={(e) => setMorning(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">이브닝 노트</Label>
              <Input type="time" value={evening} onChange={(e) => setEvening(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {savedAt && (
          <span className="text-[11px] text-emerald-600">
            저장됨 ({savedAt.toLocaleTimeString('ko-KR')})
          </span>
        )}
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Save className="mr-1 h-3.5 w-3.5" />
              저장
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
