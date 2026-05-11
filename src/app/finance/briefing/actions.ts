'use server'
/**
 * 모닝/이브닝 브리핑 Server Actions (PRD #7 ① ③)
 *
 * Claude Sonnet 4.5에 어제 데이터 + 사이클 진행 + 미수금 상황을 컨텍스트로 보내
 * 구조화된 브리핑(JSON)을 생성받아 ai_briefings에 저장.
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAnthropic, MODEL, extractText, parseJsonResponse } from '@/lib/anthropic'
import { calculateCycleProgress } from '@/lib/v11-cycle'

interface BriefingPayload {
  top_changes?: string[]
  priorities?: string[]
  alerts?: string[]
  coaching_message?: string
  drucker_question?: string | null
}

interface EveningPayload {
  daily_summary?: string
  variance_analysis?: { plan?: string; actual?: string; gap?: string }
  five_habits_check?: Record<string, string>
  decisions_made?: string[]
  ai_feedback?: string
}

const SYSTEM_PROMPT_MORNING = `당신은 디안(Dian)의 CFO 보조 AI입니다. 디안은 B2B 프리미엄 인테리어 원단 유통·큐레이션 회사로, 4티어(저가/중가/프리미엄/럭셔리) × 6직업군(인테리어 프로젝트, 브랜드 가구, 프로젝트 가구, 업소용 천갈이, 커튼 스타일링, 디스플레이) × 4제품군(소파원단, 커튼원단, 벽원단, 소품원단) = 24셀 비즈니스 모델로 운영됩니다.

당신의 역할은 매일 아침 대표(CEO 한태원)에게 다음을 30초 안에 파악할 수 있게 제공하는 것입니다:

1. **어제 핵심 변화 3가지** (top_changes): 매출, 거래처, 미수금 등에서 의미 있는 변화
2. **오늘 우선순위 3가지** (priorities): 12주 목표와 정렬된 행동
3. **위기·기회 신호** (alerts): 지표 이상치, 즉시 조치 필요한 사항 (없으면 빈 배열)
4. **일일 코칭 메시지** (coaching_message): 드러커·그로브·캠벨 인사이트 1-2문장
5. **드러커 3가지 질문** (drucker_question): 월요일에만 1개 질문, 다른 요일은 null

응답 규칙:
- 반드시 다음 JSON 형식으로만 응답:
{
  "top_changes": ["...", "...", "..."],
  "priorities": ["...", "...", "..."],
  "alerts": ["..."],
  "coaching_message": "...",
  "drucker_question": "..." 또는 null
}
- 데이터에 명시된 사실만 기반으로. 추측 금지.
- 데이터가 비어있으면 "어제 거래 없음" 같이 명시.
- 한국어, 정중하지만 직설적인 CFO 동료 톤.
- 코드펜스(\`\`\`) 없이 순수 JSON만.`

const SYSTEM_PROMPT_EVENING = `당신은 디안의 CFO 보조 AI이며, 하루 마무리 시점에 대표(한태원)와 함께 오늘을 회고합니다.

당신의 역할:
1. **오늘 요약** (daily_summary): 1-2문장
2. **계획 vs 실제 분석** (variance_analysis): {"plan": "...", "actual": "...", "gap": "..."}
3. **드러커 5가지 점검** (five_habits_check): 시간 관리·기여·강점 활용·우선순위·의사결정 — 각각 한 문장
4. **오늘의 의사결정** (decisions_made): 오늘 내려진 주요 결정들
5. **AI 피드백** (ai_feedback): 패턴·코칭·내일 제안

응답은 JSON만:
{
  "daily_summary": "...",
  "variance_analysis": {"plan": "...", "actual": "...", "gap": "..."},
  "five_habits_check": {
    "time_management": "...",
    "contribution": "...",
    "strengths": "...",
    "priorities": "...",
    "decisions": "..."
  },
  "decisions_made": ["..."],
  "ai_feedback": "..."
}

데이터 기반, 한국어, 코드펜스 없이.`

async function gatherContext(date: string): Promise<string> {
  const supabase = await createClient()
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const [yTx, todayTx, ar, cycle, goals, recentDecisions, lastWAM] = await Promise.all([
    supabase
      .from('transactions')
      .select('client_id, total_amount, margin_amount, segment_id, tier')
      .eq('transaction_date', yesterdayStr)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
    supabase
      .from('transactions')
      .select('client_id, total_amount')
      .eq('transaction_date', date)
      .in('stage', ['confirmed', 'shipping', 'delivered', 'paid']),
    supabase
      .from('outstanding_payments')
      .select('client_name, outstanding, days_overdue, aging_bucket')
      .limit(20),
    supabase
      .from('cycles')
      .select('cycle_number, start_date, end_date, vision_statement')
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('goals')
      .select('title, category, target_value, current_value, unit, is_leading_indicator'),
    supabase
      .from('price_decisions')
      .select('type, decision_date, decided_price, ceo_approved, validation_completed')
      .order('decision_date', { ascending: false })
      .limit(5),
    supabase
      .from('weekly_action_meetings')
      .select('meeting_date, week_number, blockers, next_week_priorities')
      .order('meeting_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const yRevenue = (yTx.data ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0)
  const yMargin = (yTx.data ?? []).reduce((s, t) => s + Number(t.margin_amount || 0), 0)
  const yClients = new Set((yTx.data ?? []).map((t) => t.client_id).filter(Boolean)).size

  const tRevenue = (todayTx.data ?? []).reduce((s, t) => s + Number(t.total_amount || 0), 0)

  const overdue = (ar.data ?? []).filter(
    (o) => o.aging_bucket && o.aging_bucket.startsWith('overdue'),
  )
  const overdueAmount = overdue.reduce((s, o) => s + Number(o.outstanding || 0), 0)

  let cycleStr = '활성 사이클 없음'
  if (cycle.data) {
    const p = calculateCycleProgress(cycle.data.start_date, cycle.data.end_date)
    cycleStr = `사이클 #${cycle.data.cycle_number} · Week ${p.weekNumber}/12 (D-${p.daysRemaining})`
    if (cycle.data.vision_statement) cycleStr += ` · 비전: ${cycle.data.vision_statement}`
  }

  const goalsText = (goals.data ?? [])
    .map((g) => {
      const ratio =
        g.target_value && Number(g.target_value) > 0
          ? Math.round((Number(g.current_value || 0) / Number(g.target_value)) * 100)
          : 0
      return `- ${g.title} (${g.category}, ${g.is_leading_indicator ? '선행' : '후행'}): ${
        g.current_value ?? 0
      } / ${g.target_value ?? '-'} ${g.unit ?? ''} (${ratio}%)`
    })
    .join('\n')

  const decisionsText = (recentDecisions.data ?? [])
    .map(
      (d) =>
        `- ${d.decision_date} ${d.type} ${d.decided_price ?? '-'}원 (${
          d.ceo_approved ? '승인' : '작성중'
        })`,
    )
    .join('\n')

  const lastWAMText = lastWAM.data
    ? `최근 WAM: ${lastWAM.data.meeting_date} Week ${lastWAM.data.week_number}\n  블로커: ${
        lastWAM.data.blockers ?? '없음'
      }\n  다음주 우선순위: ${
        Array.isArray(lastWAM.data.next_week_priorities)
          ? lastWAM.data.next_week_priorities.join(', ')
          : '없음'
      }`
    : '아직 WAM 없음'

  const dow = new Date(date).getDay() // 0=Sun, 1=Mon
  const isMonday = dow === 1

  return `## 오늘 날짜
${date}${isMonday ? ' (월요일 — 드러커 3가지 질문 1개 포함)' : ''}

## 어제 (${yesterdayStr}) 거래
- 매출: ${yRevenue.toLocaleString()}원
- 공헌이익: ${yMargin.toLocaleString()}원
- 거래 건수: ${yTx.data?.length ?? 0}건
- 활성 거래처: ${yClients}곳

## 오늘 ${date} 진행 (현재까지)
- 매출: ${tRevenue.toLocaleString()}원
- 거래 건수: ${todayTx.data?.length ?? 0}건

## 미수금 현황
- 연체 건수: ${overdue.length}건
- 연체 금액: ${overdueAmount.toLocaleString()}원
- 가장 오래된 연체: ${
    overdue[0]
      ? `${overdue[0].client_name} ${overdue[0].days_overdue}일 (${Number(
          overdue[0].outstanding,
        ).toLocaleString()}원)`
      : '없음'
  }

## 12주 사이클
${cycleStr}

## 12주 목표 진행
${goalsText || '(목표 미설정)'}

## 최근 가격 결정 (최대 5건)
${decisionsText || '(없음)'}

## ${lastWAMText}`
}

export async function generateBriefing(
  type: 'morning' | 'evening',
  date?: string,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const briefingDate = date ?? new Date().toISOString().split('T')[0]

    // 이미 있으면 재생성 거부 (사용자가 수동 삭제 후 재생성)
    const { data: existing } = await supabase
      .from('ai_briefings')
      .select('id')
      .eq('user_id', userId)
      .eq('briefing_date', briefingDate)
      .eq('type', type)
      .maybeSingle()
    if (existing) {
      return {
        ok: false,
        error: `${briefingDate} ${type} 브리핑이 이미 있습니다. 삭제 후 재생성하세요.`,
      }
    }

    // 컨텍스트 수집
    const context = await gatherContext(briefingDate)

    // Claude 호출
    const client = getAnthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: type === 'morning' ? SYSTEM_PROMPT_MORNING : SYSTEM_PROMPT_EVENING,
      messages: [
        {
          role: 'user',
          content: `다음 데이터를 기반으로 ${
            type === 'morning' ? '모닝 브리핑' : '이브닝 노트'
          }를 JSON으로 생성해 주세요.\n\n${context}`,
        },
      ],
    })

    const text = extractText(response)
    const parsed = parseJsonResponse<BriefingPayload | EveningPayload>(text)
    if (!parsed) {
      return {
        ok: false,
        error: 'Claude 응답이 JSON 형식이 아닙니다. 다시 시도해 주세요.',
      }
    }

    // INSERT
    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      briefing_date: briefingDate,
      type,
    }

    if (type === 'morning') {
      const m = parsed as BriefingPayload
      insertPayload.top_changes = m.top_changes ?? []
      insertPayload.priorities = m.priorities ?? []
      insertPayload.alerts = m.alerts ?? []
      insertPayload.coaching_message = m.coaching_message ?? null
      insertPayload.drucker_question = m.drucker_question ?? null
    } else {
      const e = parsed as EveningPayload
      insertPayload.daily_summary = e.daily_summary ?? null
      insertPayload.variance_analysis = e.variance_analysis ?? {}
      insertPayload.five_habits_check = e.five_habits_check ?? {}
      insertPayload.decisions_made = e.decisions_made ?? []
      insertPayload.ai_feedback = e.ai_feedback ?? null
    }

    const { data, error } = await supabase
      .from('ai_briefings')
      .insert(insertPayload)
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/briefing')
    revalidatePath('/finance/daily')
    return { ok: true, id: data.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteBriefing(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { error } = await supabase
      .from('ai_briefings')
      .delete()
      .eq('id', id)
      .eq('user_id', userId) // 본인 것만
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/briefing')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function markReviewed(
  id: number,
  user_notes: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { error } = await supabase
      .from('ai_briefings')
      .update({ user_reviewed: true, user_notes })
      .eq('id', id)
      .eq('user_id', userId)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/briefing')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
