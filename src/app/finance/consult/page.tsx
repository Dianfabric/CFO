/**
 * AI 컨설팅 세션 목록 (Phase 1 ⑧, PRD #7 ②)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  Plus,
  Bot,
  AlertCircle,
  ChevronRight,
  MessageSquare,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createSession } from '@/app/finance/consult/actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SessionRow {
  id: number
  topic: string | null
  started_at: string
  messages: Array<{ role: string; content: string }> | null
}

async function loadData() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { sessions: [] as SessionRow[], error: null }

    const { data, error } = await supabase
      .from('ai_consulting_sessions')
      .select('id, topic, started_at, messages')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(30)

    return {
      sessions: (data ?? []) as SessionRow[],
      error: error?.message ?? null,
    }
  } catch (e) {
    return {
      sessions: [] as SessionRow[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function ConsultListPage() {
  const { sessions, error } = await loadData()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · Phase 1 ⑧ · AI
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">라이브 컨설팅</h1>
          <p className="mt-1 text-sm text-slate-500">
            Claude Sonnet 4.5와 디안 데이터 기반 의사결정 채팅. 본인 세션만 조회 가능.
          </p>
        </div>
        <form action={createSession}>
          <Button type="submit">
            <Plus className="mr-1 h-4 w-4" />새 세션 시작
          </Button>
        </form>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>{error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>대화 이력</CardTitle>
          <CardDescription>최근 30개 세션</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Bot className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">
                아직 컨설팅 세션이 없습니다
              </p>
              <p className="mt-1 text-xs text-slate-400">
                첫 세션을 시작하면 디안 데이터(매출·미수금·12주 진행)가 자동으로 컨텍스트에
                추가됩니다.
              </p>
              <form action={createSession} className="mt-4">
                <Button type="submit" size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" />첫 세션 시작
                </Button>
              </form>
            </div>
          ) : (
            <ul className="divide-y">
              {sessions.map((s) => {
                const msgCount = (s.messages ?? []).length
                const lastMsg = (s.messages ?? [])[msgCount - 1]
                return (
                  <li key={s.id}>
                    <Link
                      href={`/finance/consult/${s.id}`}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-slate-800">
                            {s.topic ?? '제목 없음'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(s.started_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {msgCount}개 메시지
                          {lastMsg && (
                            <span>
                              {' · '}
                              마지막: <span className="text-slate-600">{lastMsg.role === 'user' ? '나' : 'AI'}</span>{' '}
                              <span className="line-clamp-1 inline">
                                {lastMsg.content.slice(0, 60)}
                                {lastMsg.content.length > 60 ? '…' : ''}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 안내 */}
      <Card className="border-amber-100 bg-amber-50/40">
        <CardContent className="py-3">
          <p className="text-[11px] text-amber-900">
            💡 <strong>비용 안내</strong>: 세션당 평균 메시지 10개 기준 Claude Sonnet 4.5 사용료 약 USD
            $0.10. 본인(user_id) 세션만 조회 가능 — 권한 위계 보호.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
