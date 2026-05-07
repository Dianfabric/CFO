'use server'

/**
 * AI Create — 상세페이지 Server Actions
 *
 * 위저드에서 폼 제출 → createRun 호출 → 즉시 /runs/[id] 로 redirect.
 * 파이프라인 실행은 createRun 안에서 동기적으로 진행 (작은 트래픽 가정).
 *
 * 추후 큐/백그라운드로 분리 가능 (현재는 단순함 우선).
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  makeRunId,
  writeProductBrief,
  writeRunMeta,
  updateRunStatus,
  writeSectionPlan,
  writeCopyDeck,
  readRunMeta,
  readProductBrief,
  readSectionPlan,
} from '@/lib/v11-ai-create/storage'
import { runSectionArchitect, runCopyCraftsman } from '@/lib/v11-ai-create/orchestrator'
import type {
  ProductBrief,
  WizardFormInput,
  RunMeta,
  BrandIdentity,
  DianTier,
} from '@/lib/v11-ai-create/types'

// ============================================================
// 디안 기본 브랜드 아이덴티티 (CLAUDE.md 톤·시각 가이드)
// ============================================================

const DIAN_BRAND_IDENTITY: BrandIdentity = {
  big_idea: '공간의 가치를 결정짓는 소재의 품격',
  brand_persona: '세련된 전문가 — 디자이너의 디자이너',
  voice_tone: '격조, 신뢰, 절제',
  visual_primary_color: '#0066cc',
  visual_secondary_color: '#1d1d1f',
  visual_accent_color: '#0066cc',
  visual_font_heading: 'Pretendard Variable',
  visual_font_body: 'Pretendard Variable',
  visual_image_style: 'natural light, editorial, minimal, museum gallery',
}

// ============================================================
// 폼 input → ProductBrief
// ============================================================

function inputToBrief(input: WizardFormInput, runId: string): ProductBrief {
  const colors = input.colors
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const sellingPoints = input.key_selling_points
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    run_id: runId,
    agent_kind: 'product_detail',
    input_mode: 'wizard',
    product_name: input.product_name.trim(),
    category: input.category,
    material: input.material.trim(),
    colors,
    season: input.season.trim(),
    estimated_unit_price: input.estimated_unit_price ?? null,
    target_occupations: input.target_occupations,
    target_division: input.category, // 동일 매핑 (사용자가 카테고리 선택)
    target_tier: input.target_tier,
    key_selling_points: sellingPoints,
    reference_urls: [],
    reference_images: [],
    competitor_pages: [],
    page_length: input.page_length,
    tone: {
      emotional: input.emotional,
      formal: input.formal,
      visual_density: input.visual_density,
    },
    brand_identity: DIAN_BRAND_IDENTITY,
    client_context: null,
    _meta: {
      created_at: new Date().toISOString().slice(0, 10),
      team_lead_version: '1.0',
      skills_used: ['dian-design-system', 'dian-13-sections', 'dian-tier-tone'],
    },
  }
}

// ============================================================
// 입력 검증 (서버에서 다시 한 번 — 클라이언트 검증 보완)
// ============================================================

function validateInput(input: WizardFormInput): string | null {
  if (!input.product_name?.trim()) return '제품명을 입력하세요.'
  if (!input.material?.trim()) return '소재 정보를 입력하세요.'
  if (!input.colors?.trim()) return '컬러를 1개 이상 입력하세요.'
  if (!input.season?.trim()) return '시즌을 입력하세요.'
  if (!input.target_occupations?.length) return '타겟 직업군을 1개 이상 선택하세요.'
  return null
}

// ============================================================
// createRun — 폼 제출 진입점 (writes brief + meta, kicks pipeline)
// ============================================================

export async function createRun(input: WizardFormInput): Promise<
  { ok: true; run_id: string } | { ok: false; error: string }
> {
  const validationError = validateInput(input)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  const runId = makeRunId(input.product_name, input.target_tier)
  const brief = inputToBrief(input, runId)

  try {
    // 1. brief + meta 먼저 저장 (파이프라인이 실패해도 진입점은 남음)
    await writeProductBrief(brief)
    const meta: RunMeta = {
      run_id: runId,
      product_name: brief.product_name,
      target_tier: brief.target_tier,
      target_division: brief.target_division,
      status: 'queued',
      artifacts: ['00-product-brief'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await writeRunMeta(meta)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : '런 생성 실패 (파일 저장 오류)',
    }
  }

  // 2. 파이프라인 실행 (동기) — 결과는 /runs/[id] 에서 표시
  await runFullPipeline(runId).catch((err) => {
    console.error('[createRun] pipeline error', err)
    // 파이프라인 실패해도 런은 만들어졌으니 redirect 는 그대로 진행
  })

  revalidatePath('/finance/ai-create/product-detail')
  // redirect 는 throw 라 try/catch 밖에서 호출
  redirect(`/finance/ai-create/product-detail/runs/${runId}`)
}

// ============================================================
// runFullPipeline — Section → Copy 순차 실행
// ============================================================

export async function runFullPipeline(runId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const brief = await readProductBrief(runId)
  if (!brief) {
    return { ok: false, error: `ProductBrief 를 찾을 수 없습니다: ${runId}` }
  }

  // ── Stage 1: section-architect ─────────────────────
  try {
    await updateRunStatus(runId, 'running:section')
    const plan = await runSectionArchitect(brief)
    await writeSectionPlan(runId, plan)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '섹션 계획 생성 실패'
    await updateRunStatus(runId, 'error', { error: `[section-architect] ${msg}` })
    return { ok: false, error: msg }
  }

  // ── Stage 2: copy-craftsman ─────────────────────
  try {
    await updateRunStatus(runId, 'running:copy')
    const plan = await readSectionPlan(runId)
    if (!plan) throw new Error('SectionPlan 을 읽을 수 없습니다.')
    const deck = await runCopyCraftsman(brief, plan)
    await writeCopyDeck(runId, deck)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '카피 생성 실패'
    await updateRunStatus(runId, 'error', { error: `[copy-craftsman] ${msg}` })
    return { ok: false, error: msg }
  }

  // ── 완료 ─────────────────────
  await updateRunStatus(runId, 'done')
  revalidatePath('/finance/ai-create/product-detail')
  revalidatePath(`/finance/ai-create/product-detail/runs/${runId}`)
  return { ok: true }
}

// ============================================================
// 재시도 — 결과 뷰어에서 호출
// ============================================================

export async function retryRun(runId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const meta = await readRunMeta(runId)
  if (!meta) return { ok: false, error: '런을 찾을 수 없습니다.' }
  await updateRunStatus(runId, 'queued', { error: undefined })
  return runFullPipeline(runId)
}

// ============================================================
// 기본값 채우기 — 위저드에서 "예시로 채우기" 버튼
// ============================================================

export async function getDefaultFill(tier: DianTier = 'premium'): Promise<WizardFormInput> {
  return {
    product_name: tier === 'luxury' ? '디안 SS26 Reserve' : '디안 SS26 워시드 리넨',
    category: 'curtain',
    material: '100% 워시드 리넨 (벨기에 직조)',
    colors:
      tier === 'luxury'
        ? '아이보리 (여명), 그레이지 (안개), 인디고 (심해)'
        : '아이보리 (여명), 그레이지 (안개), 모스 (숲), 인디고 (심해)',
    season: 'SS26',
    estimated_unit_price: tier === 'luxury' ? null : 55000,
    target_occupations: ['interior_project', 'curtain_styling'],
    target_tier: tier,
    key_selling_points: [
      '벨기에 직조사 Libeco — 1858년부터 같은 손',
      '자연 워싱 4단계 — 첫 세탁 후의 결을 미리 만든다',
      tier === 'luxury' ? '한정 30롤 큐레이션' : '4가지 자연 컬러',
    ].join('\n'),
    page_length: tier === 'luxury' ? 'medium' : 'long',
    emotional: tier === 'luxury' ? 9 : 7,
    formal: tier === 'luxury' ? 9 : 8,
    visual_density: tier === 'luxury' ? 5 : 7,
  }
}
