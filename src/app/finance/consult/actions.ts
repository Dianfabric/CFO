'use server'
/**
 * 라이브 컨설팅 (AI 채팅) Server Actions (PRD #7 ②)
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAnthropic, MODEL, extractText } from '@/lib/anthropic'
import { calculateCycleProgress } from '@/lib/v11-cycle'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const SYSTEM_PROMPT = `당신은 디안(Dian)의 CFO AI 컨설턴트입니다.
대표(한태원)와 다양한 경영 의사결정에 대해 친근하지만 정확하게 대화합니다.

디안 컨텍스트:
- B2B 프리미엄 인테리어 원단 유통·큐레이션
- 4티어(저가/중가/프리미엄/럭셔리) × 24셀(6직업군 × 4제품군)
- 위대한 12주 사이클로 운영, 매주 월요일 WAM
- 핵심 도구: 24셀 매트릭스, 4단계 가격 워크플로우, 모닝 브리핑

응답 가이드:
- 한국어, CFO 동료 같은 친근한 톤이지만 정확하게
- 추측보다 데이터 기반 제안. 데이터가 부족하면 명시.
- 드러커, 그로브, 캠벨, 지몬 등 경영 사상 적절히 인용 가능
- 답변 끝에 다음 질문이나 행동 제안 1개 (대화 깊이 만들기)
- 길이: 보통 3-5문단, 너무 길지 않게`

async function getCurrentSnapshot(): Promise<string> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [tx, ar, cycle, goals] = await Promise.all([
    supabase
      .from('transactions')
      .select('total_amount, margin_amount, transaction_date')
      .gte(
        'transaction_date',
        new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      )
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
    supabase
      .from('outstanding_payments')
      .select('outstanding, days_overdue')
      .limit(50),
    supabase
      .from('cycles')
      .select('cycle_number, start_date, end_date, vision_statement')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('goals')
      .select('title, target_value, current_value, unit, is_leading_indicator'),
  ])

  const last30Revenue = (tx.data ?? []).reduce(
    (s, t) => s + Number(t.total_amount || 0),
    0,
  )
  const last30Margin = (tx.data ?? []).reduce(
    (s, t) => s + Number(t.margin_amount || 0),
    0,
  )
  const totalAR = (ar.data ?? []).reduce((s, o) => s + Number(o.outstanding || 0), 0)
  const overdueAR = (ar.data ?? [])
    .filter((o) => Number(o.days_overdue) > 0)
    .reduce((s, o) => s + Number(o.outstanding || 0), 0)

  let cycleStr = '활성 사이클 없음'
  if (cycle.data) {
    const p = calculateCycleProgress(cycle.data.start_date, cycle.data.end_date)
    cycleStr = `사이클 #${cycle.data.cycle_number} · Week ${p.weekNumber}/12 (D-${p.daysRemaining})${
      cycle.data.vision_statement ? ` · 비전: "${cycle.data.vision_statement}"` : ''
    }`
  }

  const goalsStr = (goals.data ?? [])
    .map((g) => {
      const r =
        g.target_value && Number(g.target_value) > 0
          ? Math.round((Number(g.current_value || 0) / Number(g.target_value)) * 100)
          : 0
      return `  ${g.title}: ${r}% (${g.is_leading_indicator ? '선행' : '후행'})`
    })
    .join('\n')

  return `[디안 현재 스냅샷 — ${today}]
- 최근 30일 매출: ${last30Revenue.toLocaleString()}원
- 최근 30일 공헌이익: ${last30Margin.toLocaleString()}원 (마진 ${
    last30Revenue > 0 ? ((last30Margin / last30Revenue) * 100).toFixed(1) : 0
  }%)
- 미수금: 총 ${totalAR.toLocaleString()}원 (연체 ${overdueAR.toLocaleString()}원)
- ${cycleStr}
- 12주 목표:
${goalsStr || '  (목표 미설정)'}`
}

/** 새 세션 생성 — redirect */
export async function createSession(): Promise<never> {
  let newId: number | null = null
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인이 필요합니다.')

    const { data, error } = await supabase
      .from('ai_consulting_sessions')
      .insert({
        user_id: user.id,
        topic: '새 컨설팅',
        messages: [],
      })
      .select('id')
      .single()
    if (error) throw error
    newId = data.id
  } catch (e) {
    throw e
  }
  redirect(`/finance/consult/${newId}`)
}

export async function sendMessage(
  sessionId: number,
  userMessage: string,
): Promise<{ ok: boolean; error?: string; assistant?: string; topic?: string }> {
  if (!userMessage.trim()) {
    return { ok: false, error: '메시지를 입력해 주세요.' }
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    // 현재 세션 로드
    const { data: session, error: loadErr } = await supabase
      .from('ai_consulting_sessions')
      .select('messages, topic')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (loadErr || !session) {
      return { ok: false, error: '세션을 찾을 수 없습니다.' }
    }

    const history = (session.messages ?? []) as ChatMessage[]
    const newUserMsg: ChatMessage = {
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date().toISOString(),
    }

    // Claude 호출용 messages
    const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
    // 첫 메시지에만 데이터 스냅샷 attach (이후는 대화 흐름에 의존)
    const isFirst = history.length === 0
    let firstUserContent = newUserMsg.content
    if (isFirst) {
      const snapshot = await getCurrentSnapshot()
      firstUserContent = `${snapshot}\n\n---\n\n${newUserMsg.content}`
    }

    if (isFirst) {
      claudeMessages.push({ role: 'user', content: firstUserContent })
    } else {
      for (const m of history) {
        claudeMessages.push({ role: m.role, content: m.content })
      }
      claudeMessages.push({ role: 'user', content: newUserMsg.content })
    }

    const client = getAnthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    })
    const assistantContent = extractText(response).trim()

    const newAssistantMsg: ChatMessage = {
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date().toISOString(),
    }

    const updatedHistory = [...history, newUserMsg, newAssistantMsg]

    // 첫 메시지면 topic 추출 (사용자 메시지 첫 30자)
    const topicUpdate = isFirst
      ? userMessage.trim().slice(0, 30) + (userMessage.trim().length > 30 ? '…' : '')
      : session.topic

    const { error: updateErr } = await supabase
      .from('ai_consulting_sessions')
      .update({ messages: updatedHistory, topic: topicUpdate })
      .eq('id', sessionId)
    if (updateErr) return { ok: false, error: updateErr.message }

    revalidatePath('/finance/consult')
    revalidatePath(`/finance/consult/${sessionId}`)
    return { ok: true, assistant: assistantContent, topic: topicUpdate ?? undefined }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteSession(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { error } = await supabase
      .from('ai_consulting_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/consult')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
