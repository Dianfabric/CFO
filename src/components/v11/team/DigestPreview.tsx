'use client'
/**
 * 슬랙 디지스트 미리보기 + 즉시 발송 버튼
 */
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { sendDigestToSlack } from '@/app/finance/team/actions'
import type { ChannelKind, DigestKind } from '@/lib/v11-team/digestBuilder'

interface Props {
  kind: DigestKind
  text: string
  defaultChannel?: ChannelKind
  channels?: ChannelKind[]
}

const channelLabel: Record<ChannelKind, string> = {
  employees: '직원',
  executives: '임원',
  ceo: 'CEO',
}

export default function DigestPreview({
  kind,
  text,
  defaultChannel = 'employees',
  channels = ['employees', 'executives', 'ceo'],
}: Props) {
  const [pending, startTransition] = useTransition()
  const [channel, setChannel] = useState<ChannelKind>(defaultChannel)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const handleSend = () => {
    setResult(null)
    startTransition(async () => {
      const res = await sendDigestToSlack({ kind, channel })
      setResult({
        ok: res.ok,
        msg: res.ok ? '발송 완료 — 슬랙 채널을 확인하세요.' : res.error ?? '발송 실패',
      })
    })
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-slate-700">
            {text}
          </pre>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">채널:</span>
        {channels.map((ch) => (
          <button
            key={ch}
            onClick={() => setChannel(ch)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              channel === ch
                ? 'border-amber-400 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
            type="button"
          >
            {channelLabel[ch]}
          </button>
        ))}

        <Button
          size="sm"
          onClick={handleSend}
          disabled={pending}
          className="ml-auto"
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              발송 중...
            </>
          ) : (
            <>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {channelLabel[channel]} 채널로 발송
            </>
          )}
        </Button>
      </div>

      {result && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
            result.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{result.msg}</span>
        </div>
      )}
    </div>
  )
}
