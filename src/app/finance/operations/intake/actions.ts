'use server'
/**
 * 입고 워크플로우 (#10) Server Actions
 * - 입고 등록 → AI 평가 → 단계 진행 → 6개 카테고리 자동 연계
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { evaluateSample } from '@/lib/v11-intake/evaluator'
import type {
  Stage,
  Division,
  Tier,
  Occupation,
} from '@/lib/v11-intake/types'

// ── 입고 등록 (Stage 1) ──
export interface CreateIntakeInput {
  name: string
  supplier?: string
  source?: 'domestic' | 'overseas'
  arrival_date?: string
  sample_count?: number
  unit?: string
  material?: string
  colors?: string[]
  estimated_unit_price?: number | null
  notes?: string
  run_ai_eval?: boolean
}

export async function createIntake(
  input: CreateIntakeInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    // 1) DB insert
    const { data: row, error } = await supabase
      .from('incoming_samples')
      .insert({
        name: input.name,
        supplier: input.supplier ?? null,
        source: input.source ?? 'domestic',
        arrival_date: input.arrival_date ?? new Date().toISOString().slice(0, 10),
        sample_count: input.sample_count ?? 1,
        unit: input.unit ?? 'roll',
        material: input.material ?? null,
        colors: input.colors ?? [],
        estimated_unit_price: input.estimated_unit_price ?? null,
        notes: input.notes ?? null,
        stage: input.run_ai_eval ? 'evaluating' : 'arrived',
        created_by: userId,
      })
      .select('id')
      .single()

    if (error || !row) return { ok: false, error: error?.message ?? '등록 실패' }

    // 2) 자산 자동 등록 (#9 라이브러리)
    const { data: asset } = await supabase
      .from('sales_material_assets')
      .insert({
        kind: 'text',
        title: `[샘플] ${input.name}`,
        description: input.supplier ? `공급처: ${input.supplier}` : null,
        body_text: [
          `샘플명: ${input.name}`,
          input.material ? `소재: ${input.material}` : null,
          input.colors?.length ? `컬러: ${input.colors.join(', ')}` : null,
          input.estimated_unit_price
            ? `추정 단가: ${input.estimated_unit_price.toLocaleString('ko-KR')}원/${input.unit ?? 'roll'}`
            : null,
          input.notes ? `비고: ${input.notes}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        source: input.source === 'overseas' ? 'overseas' : 'domestic',
        tags: ['신제품 샘플', input.material ?? ''].filter(Boolean),
        uploaded_by: userId,
      })
      .select('id')
      .single()

    if (asset?.id) {
      await supabase
        .from('incoming_samples')
        .update({ asset_id: asset.id })
        .eq('id', row.id)
    }

    // 3) AI 평가 (옵션)
    if (input.run_ai_eval) {
      const evalResult = await evaluateSample({
        name: input.name,
        supplier: input.supplier,
        source: input.source ?? 'domestic',
        material: input.material,
        colors: input.colors,
        estimated_unit_price: input.estimated_unit_price ?? undefined,
        notes: input.notes,
      })

      if (evalResult.ok) {
        await supabase
          .from('incoming_samples')
          .update({
            division: evalResult.evaluation.recommended_division,
            recommended_tier: evalResult.evaluation.recommended_tier,
            recommended_occupations: evalResult.evaluation.recommended_occupations,
            competitive_score: evalResult.evaluation.competitive_score,
            differentiator: evalResult.evaluation.differentiator,
            ai_evaluation: evalResult.evaluation,
          })
          .eq('id', row.id)
      }
    }

    revalidatePath('/finance/operations/intake')
    return { ok: true, id: row.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function createIntakeAndRedirect(input: CreateIntakeInput): Promise<void> {
  const res = await createIntake(input)
  if (res.ok && res.id) redirect(`/finance/operations/intake/${res.id}`)
  else redirect(`/finance/operations/intake/new?error=${encodeURIComponent(res.error ?? '')}`)
}

// ── AI 평가 트리거 (이미 등록된 샘플) ──
export async function runAIEvaluation(
  sample_id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: row } = await supabase
      .from('incoming_samples')
      .select('name, supplier, source, material, colors, estimated_unit_price, notes')
      .eq('id', sample_id)
      .single()
    if (!row) return { ok: false, error: '샘플을 찾을 수 없습니다.' }

    const result = await evaluateSample({
      name: row.name,
      supplier: row.supplier,
      source: row.source,
      material: row.material,
      colors: row.colors as string[],
      estimated_unit_price: row.estimated_unit_price,
      notes: row.notes,
    })
    if (!result.ok) return { ok: false, error: result.error }

    await supabase
      .from('incoming_samples')
      .update({
        division: result.evaluation.recommended_division,
        recommended_tier: result.evaluation.recommended_tier,
        recommended_occupations: result.evaluation.recommended_occupations,
        competitive_score: result.evaluation.competitive_score,
        differentiator: result.evaluation.differentiator,
        ai_evaluation: result.evaluation,
        stage: 'evaluating',
      })
      .eq('id', sample_id)

    revalidatePath(`/finance/operations/intake/${sample_id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Stage 2 평가 저장 ──
export interface EvaluationInput {
  sample_id: number
  division: Division
  recommended_tier: Tier
  recommended_occupations: Occupation[]
  competitive_score: number
  differentiator?: string
  risk_note?: string
  go_next?: boolean
}

export async function saveEvaluation(
  input: EvaluationInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('incoming_samples')
      .update({
        division: input.division,
        recommended_tier: input.recommended_tier,
        recommended_occupations: input.recommended_occupations,
        competitive_score: input.competitive_score,
        differentiator: input.differentiator ?? null,
        risk_note: input.risk_note ?? null,
        stage: input.go_next ? 'planned' : 'evaluating',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.sample_id)
    if (error) return { ok: false, error: error.message }

    revalidatePath(`/finance/operations/intake/${input.sample_id}`)
    revalidatePath('/finance/operations/intake')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Stage 3 기획 저장 ──
export interface PlanInput {
  sample_id: number
  target_occupations: Occupation[]
  target_divisions: Division[]
  pricing_strategy?: string
  marketing_angle?: string
  priority_client_ids: number[]
  revenue_target_30d?: number | null
  revenue_target_90d?: number | null
  go_next?: boolean
}

export async function savePlan(
  input: PlanInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { error } = await supabase
      .from('incoming_samples')
      .update({
        target_occupations: input.target_occupations,
        target_divisions: input.target_divisions,
        pricing_strategy: input.pricing_strategy ?? null,
        marketing_angle: input.marketing_angle ?? null,
        priority_client_ids: input.priority_client_ids,
        revenue_target_30d: input.revenue_target_30d ?? null,
        revenue_target_90d: input.revenue_target_90d ?? null,
        stage: input.go_next ? 'in_action' : 'planned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.sample_id)
    if (error) return { ok: false, error: error.message }

    // Stage 4 진입 시 자동 체크리스트 생성
    if (input.go_next) {
      await ensureActionItems(input.sample_id, userId)
    }

    revalidatePath(`/finance/operations/intake/${input.sample_id}`)
    revalidatePath('/finance/operations/intake')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Stage 4 — 체크리스트 자동 생성 ──
async function ensureActionItems(sample_id: number, _user_id: string): Promise<void> {
  const supabase = await createClient()
  // 이미 있으면 스킵
  const { count } = await supabase
    .from('intake_action_items')
    .select('id', { count: 'exact', head: true })
    .eq('sample_id', sample_id)
  if ((count ?? 0) > 0) return

  const items = [
    { kind: 'showroom', label: '쇼룸 비치 (위치 입력)', order: 10 },
    {
      kind: 'sales_material',
      label: '영업자료 자동 생성 (#9 위저드 자동 채움)',
      order: 20,
    },
    { kind: 'marketing_content', label: '마케팅 콘텐츠 1건 등록 (#2b)', order: 30 },
    {
      kind: 'sample_send',
      label: '우선 거래처 5곳에 샘플 발송 요청 등록 (#2c)',
      order: 40,
    },
    { kind: 'wam', label: '다음 주 WAM 안건 등록 (#1)', order: 50 },
    { kind: 'slack', label: '슬랙 직원 채널 신제품 공지 (#8)', order: 60 },
  ]

  await supabase.from('intake_action_items').insert(
    items.map((i) => ({
      sample_id,
      label: i.label,
      action_kind: i.kind,
      display_order: i.order,
    })),
  )
}

// ── Stage 4 — 체크리스트 토글 / 완료 ──
export async function toggleActionItem(
  item_id: number,
  completed: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { data: item, error: itemErr } = await supabase
      .from('intake_action_items')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? userId : null,
      })
      .eq('id', item_id)
      .select('sample_id')
      .single()
    if (itemErr || !item) return { ok: false, error: itemErr?.message ?? '항목 없음' }

    // 모든 액션 완료 시 stage → tracking
    const { data: pending } = await supabase
      .from('intake_action_items')
      .select('id', { count: 'exact', head: true })
      .eq('sample_id', item.sample_id)
      .eq('completed', false)

    if ((pending as unknown as { count?: number })?.count === 0) {
      await supabase
        .from('incoming_samples')
        .update({ stage: 'tracking', updated_at: new Date().toISOString() })
        .eq('id', item.sample_id)
    }

    revalidatePath(`/finance/operations/intake/${item.sample_id}`)
    revalidatePath('/finance/operations/intake')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Stage 4 자동 액션: 마케팅 콘텐츠 카드 생성 ──
export async function actionCreateMarketingContent(
  sample_id: number,
): Promise<{ ok: boolean; error?: string; content_id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { data: m } = await supabase
      .from('incoming_samples')
      .select('id, name, marketing_angle, recommended_tier, content_item_ids')
      .eq('id', sample_id)
      .single()
    if (!m) return { ok: false, error: '샘플 없음' }

    const { data: content, error } = await supabase
      .from('content_items')
      .insert({
        channel: 'instagram',
        title: `[신제품] ${m.name}`,
        status: 'draft',
        hook: m.marketing_angle ?? null,
        notes: `샘플 입고 자동 생성. 티어: ${m.recommended_tier ?? '미정'}.`,
      })
      .select('id')
      .single()

    if (error || !content) {
      return { ok: false, error: error?.message ?? '콘텐츠 생성 실패' }
    }

    const ids = ((m.content_item_ids as number[]) ?? []).concat([content.id])
    await supabase
      .from('incoming_samples')
      .update({ content_item_ids: ids })
      .eq('id', sample_id)

    revalidatePath(`/finance/operations/intake/${sample_id}`)
    return { ok: true, content_id: content.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Stage 4 자동 액션: 샘플 발송 등록 ──
export async function actionCreateSampleRequests(
  sample_id: number,
): Promise<{ ok: boolean; error?: string; created?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { data: m } = await supabase
      .from('incoming_samples')
      .select('id, name, priority_client_ids, sample_request_ids')
      .eq('id', sample_id)
      .single()
    if (!m) return { ok: false, error: '샘플 없음' }

    const clientIds = (m.priority_client_ids as number[]) ?? []
    if (clientIds.length === 0) {
      return { ok: false, error: 'Stage 3에서 우선 거래처를 먼저 선택하세요.' }
    }

    const today = new Date().toISOString().slice(0, 10)
    const inserts = clientIds.map((cid) => ({
      client_id: cid,
      request_date: today,
      status: 'pending' as const,
      notes: `[자동 입고] ${m.name}`,
      requested_by: userId,
    }))

    const { data: rows, error } = await supabase
      .from('sample_requests')
      .insert(inserts)
      .select('id')

    if (error) return { ok: false, error: error.message }

    const ids = ((m.sample_request_ids as number[]) ?? []).concat(
      (rows ?? []).map((r) => r.id),
    )
    await supabase
      .from('incoming_samples')
      .update({ sample_request_ids: ids })
      .eq('id', sample_id)

    revalidatePath(`/finance/operations/intake/${sample_id}`)
    return { ok: true, created: rows?.length ?? 0 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Stage 4 자동 액션: 슬랙 공지 ──
export async function actionCreateSlackAnnouncement(
  sample_id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { data: m } = await supabase
      .from('incoming_samples')
      .select('name, recommended_tier, division, marketing_angle')
      .eq('id', sample_id)
      .single()
    if (!m) return { ok: false, error: '샘플 없음' }

    const { error } = await supabase.from('team_announcements').insert({
      title: `[신제품] ${m.name}`,
      body: [
        m.recommended_tier ? `티어: ${m.recommended_tier}` : null,
        m.division ? `제품군: ${m.division}` : null,
        m.marketing_angle ? `포인트: ${m.marketing_angle}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      importance: 'normal',
      target_channel: 'employees',
      include_in_daily: true,
      include_in_weekly: false,
      created_by: userId,
    })

    if (error) return { ok: false, error: error.message }
    revalidatePath(`/finance/operations/intake/${sample_id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Stage 5 회고 저장 ──
export interface ReviewInput {
  sample_id: number
  review_kind: '30d' | '90d' | 'final'
  what_worked?: string
  what_didnt?: string
  lessons_learned?: string
  measured_metrics?: Record<string, number>
}

export async function saveReview(
  input: ReviewInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { error } = await supabase.from('intake_performance_reviews').upsert(
      {
        sample_id: input.sample_id,
        review_kind: input.review_kind,
        what_worked: input.what_worked ?? null,
        what_didnt: input.what_didnt ?? null,
        lessons_learned: input.lessons_learned ?? null,
        measured_metrics: input.measured_metrics ?? {},
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: 'sample_id,review_kind' },
    )
    if (error) return { ok: false, error: error.message }

    revalidatePath(`/finance/operations/intake/${input.sample_id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Archive (종결) ──
export async function archiveIntake(
  sample_id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('incoming_samples')
      .update({ stage: 'archived', updated_at: new Date().toISOString() })
      .eq('id', sample_id)
    if (error) return { ok: false, error: error.message }

    revalidatePath(`/finance/operations/intake/${sample_id}`)
    revalidatePath('/finance/operations/intake')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 단계 강제 이동 (관리용) ──
export async function moveStage(
  sample_id: number,
  stage: Stage,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('incoming_samples')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', sample_id)
    if (error) return { ok: false, error: error.message }

    revalidatePath(`/finance/operations/intake/${sample_id}`)
    revalidatePath('/finance/operations/intake')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 삭제 ──
export async function deleteIntake(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('incoming_samples').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/operations/intake')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 플레이북 편집 ──
export interface PlaybookInput {
  occupation: Occupation
  division: Division
  tier: Tier
  recommended_actions: string[]
  notes?: string
}

export async function upsertPlaybook(
  input: PlaybookInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'

    const { error } = await supabase.from('sample_intake_playbook').upsert(
      {
        occupation: input.occupation,
        division: input.division,
        tier: input.tier,
        recommended_actions: input.recommended_actions,
        notes: input.notes ?? null,
        active: true,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'occupation,division,tier' },
    )
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/operations/intake/playbook')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
