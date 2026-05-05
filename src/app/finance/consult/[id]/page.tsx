/**
 * AI 컨설팅 세션 상세 (채팅 화면)
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Sparkles, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ChatInterface, { type ChatMessage } from '@/components/v11/consult/ChatInterface'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ConsultDetailPage({ params }: PageProps) {
  const { id } = await params
  const sessionId = parseInt(id, 10)
  if (!Number.isFinite(sessionId)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data, error } = await supabase
    .from('ai_consulting_sessions')
    .select('id, topic, started_at, messages')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/finance/consult"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-3 w-3" />
          목록으로
        </Link>
        <p className="text-sm text-rose-600">
          세션을 찾을 수 없습니다 (본인 세션만 조회 가능). {error?.message}
        </p>
      </div>
    )
  }

  const messages = (data.messages ?? []) as ChatMessage[]

  return (
    <div className="flex h-full flex-col gap-3">
      <Link
        href="/finance/consult"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        목록으로
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · Phase 1 ⑧ · 세션 #{data.id}
          </span>
        </div>
        <h1 className="truncate text-xl font-bold text-slate-900">
          {data.topic ?? '제목 없음'}
        </h1>
      </div>

      <ChatInterface sessionId={sessionId} initialMessages={messages} />
    </div>
  )
}
