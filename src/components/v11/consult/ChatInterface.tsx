'use client'
/**
 * AI 컨설팅 채팅 인터페이스
 *
 * - 메시지 리스트 (assistant / user 구분)
 * - 입력 박스 + Send 버튼
 * - 첫 메시지에 자동으로 디안 데이터 스냅샷 attach (서버에서 처리)
 */
import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, User, Bot, AlertCircle, Trash2 } from 'lucide-react'
import { sendMessage, deleteSession } from '@/app/finance/consult/actions'
import { cn } from '@/lib/utils'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export default function ChatInterface({
  sessionId,
  initialMessages,
}: {
  sessionId: number
  initialMessages: ChatMessage[]
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 새 메시지가 올 때마다 스크롤 하단으로
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed) return
    setError(null)

    // 낙관적 업데이트 (사용자 메시지 즉시 표시)
    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    startTransition(async () => {
      const res = await sendMessage(sessionId, trimmed)
      if (!res.ok) {
        setError(res.error ?? '응답을 받지 못했습니다.')
        // 사용자 메시지를 롤백 (실패 시)
        setMessages((prev) => prev.slice(0, -1))
        setInput(trimmed)
        return
      }
      // assistant 답변 추가
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.assistant ?? '',
          timestamp: new Date().toISOString(),
        },
      ])
      router.refresh()
    })
  }

  function handleKey(e: React.KeyboardEvent) {
    // Cmd/Ctrl + Enter 로 전송
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleDelete() {
    if (!confirm('이 세션을 삭제하시겠습니까?')) return
    startTransition(async () => {
      const res = await deleteSession(sessionId)
      if (!res.ok) {
        setError(res.error ?? '삭제 실패')
        return
      }
      router.push('/finance/consult')
    })
  }

  return (
    <div className="flex h-[calc(100vh-220px)] flex-col gap-3">
      {/* 메시지 영역 */}
      <Card className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <CardContent className="space-y-4 py-4">
            {messages.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                <Bot className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="font-medium">대화를 시작해 주세요</p>
                <p className="mt-1 text-xs">
                  첫 메시지에는 디안의 현재 데이터(매출·미수금·사이클·목표)가 자동 첨부됩니다.
                </p>
                <div className="mt-4 space-y-1.5 text-left max-w-md mx-auto">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    💡 예시 질문
                  </p>
                  <SuggestionButton
                    text="이번 달 매출 트렌드를 어떻게 해석해야 할까?"
                    onClick={(t) => setInput(t)}
                  />
                  <SuggestionButton
                    text="미수금 회수 우선순위를 어떻게 정해야 할까?"
                    onClick={(t) => setInput(t)}
                  />
                  <SuggestionButton
                    text="프리미엄 라인 가격을 인상하려면 어떻게 접근해야 할까?"
                    onClick={(t) => setInput(t)}
                  />
                  <SuggestionButton
                    text="12주 사이클 중반에 도달했는데 목표 진행 상황이 어떻게 보이나?"
                    onClick={(t) => setInput(t)}
                  />
                </div>
              </div>
            ) : (
              messages.map((m, i) => <MessageBubble key={i} m={m} />)
            )}
            {isPending && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Claude 응답 생성 중...
                </div>
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 입력 영역 */}
      <Card>
        <CardContent className="space-y-2 py-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={isPending}
            rows={3}
            placeholder="질문을 입력하세요... (Ctrl+Enter 또는 Cmd+Enter 로 전송)"
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {messages.length === 0
                ? '첫 메시지에 디안 데이터 스냅샷 자동 첨부'
                : `${messages.length}개 메시지`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isPending}
                className="text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                세션 삭제
              </Button>
              <Button onClick={handleSend} disabled={isPending || !input.trim()}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    응답 대기...
                  </>
                ) : (
                  <>
                    <Send className="mr-1 h-3.5 w-3.5" />
                    전송
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MessageBubble({ m }: { m: ChatMessage }) {
  const isUser = m.role === 'user'
  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
          isUser
            ? 'bg-blue-50 text-slate-800'
            : 'bg-purple-50/50 border border-purple-100 text-slate-800',
        )}
      >
        {m.content}
      </div>
    </div>
  )
}

function SuggestionButton({
  text,
  onClick,
}: {
  text: string
  onClick: (text: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(text)}
      className="block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50/30"
    >
      {text}
    </button>
  )
}
