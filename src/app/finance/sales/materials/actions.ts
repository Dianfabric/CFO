'use server'
/**
 * 영업자료 자동생성 (#9) Server Actions
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generateMaterial } from '@/lib/v11-sales-materials/generator'
import type {
  GenerateInput,
  ToneSettings,
  Tier,
  Occupation,
  AssetRef,
  FrameworkRow,
  GeneratedMaterial,
} from '@/lib/v11-sales-materials/types'
import { buildPptxBuffer } from '@/lib/v11-sales-materials/pptxBuilder'

// ── 자료 생성 (위저드 제출) ──
export interface CreateMaterialInput {
  title: string
  target_client_id?: number | null
  target_segment_id?: number | null
  target_tier?: Tier | null
  target_occupation?: Occupation | null
  target_persona?: string | null
  product_id?: number | null
  product_name_input: string
  product_attrs?: {
    material?: string
    colors?: string[]
    season?: string
    estimated_unit_price?: number | null
    category?: string
  }
  framework_keys: string[]
  tone: ToneSettings
  slide_count?: number
  video_durations?: number[]
  asset_ids?: number[]
  source_text?: string
  reference_urls?: string[]
}

export async function createMaterial(
  input: CreateMaterialInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    // 1) 빈 자료 레코드 생성 (status: generating)
    const { data: created, error: createError } = await supabase
      .from('sales_materials')
      .insert({
        title: input.title,
        target_client_id: input.target_client_id ?? null,
        target_segment_id: input.target_segment_id ?? null,
        target_tier: input.target_tier ?? null,
        target_occupation: input.target_occupation ?? null,
        target_persona: input.target_persona ?? null,
        product_id: input.product_id ?? null,
        product_name_input: input.product_name_input,
        product_attrs: input.product_attrs ?? {},
        framework_ids: input.framework_keys,
        tone_settings: input.tone,
        slide_count: input.slide_count ?? 7,
        video_durations: input.video_durations ?? [15, 30],
        status: 'generating',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (createError || !created) {
      return { ok: false, error: createError?.message ?? '자료 레코드 생성 실패' }
    }

    // 2) 자산 매핑
    if (input.asset_ids?.length) {
      await supabase.from('sales_material_uses_assets').insert(
        input.asset_ids.map((aid) => ({
          material_id: created.id,
          asset_id: aid,
          role: 'reference',
        })),
      )
    }

    // 3) 컨텍스트 로드 (브랜드 + 프레임워크 + 자산)
    const [brandQ, fwQ, assetsQ] = await Promise.all([
      supabase.from('brand_identity').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('sales_psychology_frameworks')
        .select('*')
        .in('key', input.framework_keys),
      input.asset_ids?.length
        ? supabase
            .from('sales_material_assets')
            .select('id, kind, title, description, external_url, body_text, source')
            .in('id', input.asset_ids)
        : Promise.resolve({ data: [] }),
    ])

    const brand = brandQ.data
    const frameworks: FrameworkRow[] = (fwQ.data ?? []).map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      summary: f.summary,
      principles: f.principles ?? [],
      recommended_tiers: f.recommended_tiers ?? [],
      recommended_occupations: f.recommended_occupations ?? [],
      prompt_template: f.prompt_template,
    }))
    const assets: AssetRef[] = (assetsQ.data ?? []) as AssetRef[]

    // 4) AI 생성
    const genInput: GenerateInput = {
      title: input.title,
      target_tier: input.target_tier ?? undefined,
      target_occupation: input.target_occupation ?? undefined,
      target_persona: input.target_persona ?? undefined,
      product_name: input.product_name_input,
      product_attrs: input.product_attrs,
      framework_keys: input.framework_keys,
      tone: input.tone,
      slide_count: input.slide_count ?? 7,
      video_durations: input.video_durations ?? [15, 30],
      brand,
      source_text: input.source_text,
      reference_urls: input.reference_urls,
      reference_assets: assets,
    }

    const result = await generateMaterial(genInput, frameworks)

    if (!result.ok) {
      await supabase
        .from('sales_materials')
        .update({
          status: 'failed',
          generation_error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', created.id)
      return { ok: false, error: result.error, id: created.id }
    }

    // 5) 결과 저장
    const material: GeneratedMaterial = result.material
    await supabase
      .from('sales_materials')
      .update({
        status: 'generated',
        slides: material.slides ?? [],
        video_scripts: material.video_scripts ?? [],
        ai_meta: material.meta ?? {},
        title: material.title || input.title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', created.id)

    // 6) 첫 버전 저장
    await supabase.from('sales_material_versions').insert({
      material_id: created.id,
      version_number: 1,
      slides: material.slides ?? [],
      video_scripts: material.video_scripts ?? [],
      framework_ids: input.framework_keys,
      tone_settings: input.tone,
      ai_meta: material.meta ?? {},
      created_by: user.id,
    })

    revalidatePath('/finance/sales/materials')
    revalidatePath(`/finance/sales/materials/${created.id}`)
    return { ok: true, id: created.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function createMaterialAndRedirect(input: CreateMaterialInput): Promise<void> {
  const result = await createMaterial(input)
  if (result.ok && result.id) {
    redirect(`/finance/sales/materials/${result.id}`)
  } else {
    redirect(
      `/finance/sales/materials/new?error=${encodeURIComponent(result.error ?? 'unknown')}`,
    )
  }
}

// ── 재생성 ──
export interface RegenerateInput {
  material_id: number
  framework_keys?: string[]
  tone?: ToneSettings
}

export async function regenerateMaterial(
  input: RegenerateInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    // 기존 자료 + 자산 로드
    const { data: existing, error: existError } = await supabase
      .from('sales_materials')
      .select('*')
      .eq('id', input.material_id)
      .single()
    if (existError || !existing) return { ok: false, error: existError?.message ?? '자료 없음' }

    const frameworkKeys = input.framework_keys ?? existing.framework_ids ?? []
    const tone = input.tone ?? existing.tone_settings ?? { emotional: 5, formal: 5, visual_density: 5 }

    const [brandQ, fwQ, usesQ] = await Promise.all([
      supabase.from('brand_identity').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('sales_psychology_frameworks')
        .select('*')
        .in('key', frameworkKeys),
      supabase
        .from('sales_material_uses_assets')
        .select('asset_id, sales_material_assets(id, kind, title, description, external_url, body_text, source)')
        .eq('material_id', input.material_id),
    ])

    const brand = brandQ.data
    const frameworks: FrameworkRow[] = (fwQ.data ?? []).map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      summary: f.summary,
      principles: f.principles ?? [],
      recommended_tiers: f.recommended_tiers ?? [],
      recommended_occupations: f.recommended_occupations ?? [],
      prompt_template: f.prompt_template,
    }))
    const assets: AssetRef[] = (usesQ.data ?? [])
      .map((u) => u.sales_material_assets as unknown as AssetRef)
      .filter(Boolean)

    await supabase
      .from('sales_materials')
      .update({ status: 'generating' })
      .eq('id', input.material_id)

    const genInput: GenerateInput = {
      title: existing.title,
      target_tier: existing.target_tier ?? undefined,
      target_occupation: existing.target_occupation ?? undefined,
      target_persona: existing.target_persona ?? undefined,
      product_name: existing.product_name_input,
      product_attrs: existing.product_attrs ?? {},
      framework_keys: frameworkKeys,
      tone,
      slide_count: existing.slide_count ?? 7,
      video_durations: existing.video_durations ?? [15, 30],
      brand,
      reference_assets: assets,
    }

    const result = await generateMaterial(genInput, frameworks)
    if (!result.ok) {
      await supabase
        .from('sales_materials')
        .update({ status: 'failed', generation_error: result.error })
        .eq('id', input.material_id)
      return { ok: false, error: result.error }
    }

    // 다음 버전 번호
    const { data: maxVer } = await supabase
      .from('sales_material_versions')
      .select('version_number')
      .eq('material_id', input.material_id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextVer = (maxVer?.version_number ?? 0) + 1

    await Promise.all([
      supabase
        .from('sales_materials')
        .update({
          status: 'generated',
          slides: result.material.slides ?? [],
          video_scripts: result.material.video_scripts ?? [],
          ai_meta: result.material.meta ?? {},
          framework_ids: frameworkKeys,
          tone_settings: tone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.material_id),
      supabase.from('sales_material_versions').insert({
        material_id: input.material_id,
        version_number: nextVer,
        slides: result.material.slides ?? [],
        video_scripts: result.material.video_scripts ?? [],
        framework_ids: frameworkKeys,
        tone_settings: tone,
        ai_meta: result.material.meta ?? {},
        created_by: user.id,
      }),
    ])

    revalidatePath(`/finance/sales/materials/${input.material_id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── PPT 생성 (서버) → base64 반환 (클라가 다운로드) ──
export async function buildMaterialPptx(
  material_id: number,
): Promise<{ ok: boolean; error?: string; filename?: string; base64?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const [matQ, brandQ] = await Promise.all([
      supabase.from('sales_materials').select('*').eq('id', material_id).single(),
      supabase.from('brand_identity').select('*').eq('id', 1).maybeSingle(),
    ])

    const m = matQ.data
    if (!m) return { ok: false, error: '자료를 찾을 수 없습니다.' }
    if (!m.slides || (m.slides as unknown[]).length === 0) {
      return { ok: false, error: '슬라이드가 없습니다. 먼저 자료를 생성하세요.' }
    }

    const buffer = await buildPptxBuffer({
      title: m.title,
      slides: m.slides,
      brand: brandQ.data,
      tier: (m.target_tier as Tier) ?? undefined,
      productName: m.product_name_input,
      authorLabel: '디안 (Dian) — 인테리어 원단 큐레이터',
    })

    const safeTitle = m.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
    const filename = `Dian_${safeTitle}_v${m.id}.pptx`
    const base64 = buffer.toString('base64')

    return { ok: true, filename, base64 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 자료 삭제 ──
export async function deleteMaterial(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('sales_materials').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/sales/materials')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── 자산 업로드 (URL/텍스트 — 이미지 업로드는 별도) ──
export interface AssetInput {
  kind: 'image' | 'pdf' | 'url' | 'text'
  title?: string
  description?: string
  external_url?: string
  body_text?: string
  source?: 'domestic' | 'overseas'
  storage_path?: string
  tags?: string[]
}

export async function createAsset(
  input: AssetInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const { data, error } = await supabase
      .from('sales_material_assets')
      .insert({
        kind: input.kind,
        title: input.title ?? null,
        description: input.description ?? null,
        external_url: input.external_url ?? null,
        body_text: input.body_text ?? null,
        source: input.source ?? 'domestic',
        storage_path: input.storage_path ?? null,
        tags: input.tags ?? [],
        uploaded_by: user.id,
      })
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/sales/materials/library')
    return { ok: true, id: data.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteAsset(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('sales_material_assets').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/sales/materials/library')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
