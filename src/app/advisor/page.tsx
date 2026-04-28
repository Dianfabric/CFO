'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bot, Send, User, Loader2, Lightbulb } from 'lucide-react'
import { formatKRW, formatPercent } from '@/lib/formatters'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_QUESTIONS = [
  '이번 달 경영 현황을 브리핑해주세요',
  '미수금이 많은 거래처를 분석하고 대응 방안을 알려주세요',
  '어떤 제품에 더 집중해야 하나요?',
  '비용 절감할 수 있는 부분이 있을까요?',
  '가격 인상을 고려하고 있는데, 어떤 제품부터 올려야 할까요?',
  '손익분기점은 얼마인가요?',
]

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [contextSummary, setContextSummary] = useState<Record<string, unknown> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => { scrollToBottom() }, [messages])

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.response || data.error || '응답 오류' }])
      if (data.context) setContextSummary(data.context)
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: '연결에 실패했습니다. API 키를 확인해주세요.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* 채팅 영역 */}
      <div className="flex-1 flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="w-7 h-7 text-blue-600" /> AI CFO 자문
          </h1>
          <p className="text-sm text-slate-500">실시간 재무 데이터를 기반으로 전략적 자문을 받습니다</p>
        </div>

        {/* 메시지 목록 */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="w-16 h-16 text-blue-200 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">AI CFO에게 물어보세요</h3>
                <p className="text-sm text-slate-400 mb-6 max-w-md">
                  실시간 재무 데이터(매출, 미수금, 비용, 제품 분석)를 기반으로<br />
                  전략적 경영 자문을 제공합니다
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)}
                      className="text-left text-sm p-3 rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition-colors text-slate-600">
                      <Lightbulb className="w-3.5 h-3.5 inline mr-1 text-yellow-500" />{q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="bg-slate-100 rounded-lg p-3">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </CardContent>

          {/* 입력 */}
          <div className="p-4 border-t">
            <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
              <Input value={input} onChange={e => setInput(e.target.value)}
                placeholder="경영 관련 질문을 입력하세요..." disabled={loading} className="flex-1" />
              <Button type="submit" disabled={loading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>

      {/* 재무 컨텍스트 사이드패널 */}
      <div className="w-72 hidden xl:block space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">참고 재무 데이터</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-3">
            {contextSummary ? (
              <>
                <div>
                  <p className="text-slate-400 mb-1">이번 달 매출</p>
                  <p className="font-bold text-lg">{formatKRW((contextSummary as { currentPeriod?: { totalSales?: number } }).currentPeriod?.totalSales || 0)}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">순이익</p>
                  <p className="font-bold">{formatKRW((contextSummary as { currentPeriod?: { netProfit?: number } }).currentPeriod?.netProfit || 0)}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">미수금</p>
                  <p className="font-bold text-red-600">{formatKRW((contextSummary as { cashFlowHealth?: { totalReceivable?: number } }).cashFlowHealth?.totalReceivable || 0)}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">월 고정비</p>
                  <p className="font-bold">{formatKRW((contextSummary as { profitDrivers?: { fixedCost?: number } }).profitDrivers?.fixedCost || 0)}</p>
                </div>
              </>
            ) : (
              <p className="text-slate-400">AI에게 질문하면 참고 데이터가 표시됩니다</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">분석 프레임워크</CardTitle></CardHeader>
          <CardContent className="text-xs text-slate-500 space-y-2">
            <p><strong>이익 드라이버</strong>: 가격, 판매량, 고정비, 변동비 분석</p>
            <p><strong>제품 등급</strong>: A(효자) B(육성) C(관리) D(정리)</p>
            <p><strong>현금흐름</strong>: 미수금 회수율, 연체 관리</p>
            <p><strong>손익분기</strong>: 최소 필요 매출액 계산</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
