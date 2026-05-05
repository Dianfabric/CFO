'use server'
/**
 * 마케팅 (#2b) Server Actions
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── Brand identity (singleton) ──
export interface BrandIdentityInput {
  big_idea?: string | null
  brand_persona?: string | null
  voice_tone?: string | null
  story_origin?: string | null
  story_mission?: string | null
  story_vision?: string | null
  visual_primary_color?: string | null
  visual_secondary_color?: string | null
  visual_accent_color?: string | null
  visual_font_heading?: string | null
  visual_font_body?: string | null
  visual_image_style?: string | null
  visual_logo_url?: string | null
  target_persona_primary?: string | null
  target_persona_secondary?: string | null
}

export async function updateBrandIdentity(
  input: BrandIdentityInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const payload: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }

    const { error } = await supabase
      .from('brand_identity')
      .update(payload)
      .eq('id', 1)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/marketing/brand')
    revalidatePath('/finance/marketing')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Content items ──
export interface ContentItemInput {
  id?: number
  channel: string
  title: string
  publish_date?: string | null
  status?: string
  hook?: string | null
  story?: string | null
  offer?: string | null
  caption?: string | null
  url?: string | null
  views?: number | null
  likes?: number | null
  shares?: number | null
  comments?: number | null
  notes?: string | null
}

export async function upsertContentItem(
  input: ContentItemInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const payload: Record<string, unknown> = {
      channel: input.channel,
      title: input.title,
      publish_date: input.publish_date ?? null,
      status: input.status ?? 'idea',
      hook: input.hook ?? null,
      story: input.story ?? null,
      offer: input.offer ?? null,
      caption: input.caption ?? null,
      url: input.url ?? null,
      views: input.views ?? 0,
      likes: input.likes ?? 0,
      shares: input.shares ?? 0,
      comments: input.comments ?? 0,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await supabase
        .from('content_items')
        .update(payload)
        .eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/marketing/content')
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('content_items')
        .insert({ ...payload, created_by: user.id })
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/marketing/content')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteContentItem(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }
    const { error } = await supabase.from('content_items').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/marketing/content')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Channel snapshots ──
export interface ChannelSnapshotInput {
  id?: number
  channel: string
  snapshot_date: string
  followers?: number | null
  posts_count?: number | null
  reach?: number | null
  impressions?: number | null
  engagement_rate?: number | null
  inquiries_count?: number | null
  notes?: string | null
}

export async function upsertChannelSnapshot(
  input: ChannelSnapshotInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const payload = {
      channel: input.channel,
      snapshot_date: input.snapshot_date,
      followers: input.followers ?? 0,
      posts_count: input.posts_count ?? 0,
      reach: input.reach ?? 0,
      impressions: input.impressions ?? 0,
      engagement_rate: input.engagement_rate ?? null,
      inquiries_count: input.inquiries_count ?? 0,
      notes: input.notes ?? null,
      created_by: user.id,
    }

    const { error } = await supabase
      .from('channel_snapshots')
      .upsert(payload, { onConflict: 'channel,snapshot_date' })
    if (error) return { ok: false, error: error.message }

    revalidatePath('/finance/marketing/channels')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Marketing scripts (HSO) ──
export interface ScriptInput {
  id?: number
  name: string
  target_segment_id?: number | null
  hook?: string | null
  story?: string | null
  offer?: string | null
  call_to_action?: string | null
  context?: string | null
  effectiveness_score?: number | null
  notes?: string | null
}

export async function upsertScript(
  input: ScriptInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const payload = {
      name: input.name,
      target_segment_id: input.target_segment_id ?? null,
      hook: input.hook ?? null,
      story: input.story ?? null,
      offer: input.offer ?? null,
      call_to_action: input.call_to_action ?? null,
      context: input.context ?? null,
      effectiveness_score: input.effectiveness_score ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await supabase
        .from('marketing_scripts')
        .update(payload)
        .eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/marketing/scripts')
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('marketing_scripts')
        .insert({ ...payload, created_by: user.id })
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/marketing/scripts')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Marketing Dream 100 ──
export interface Dream100Input {
  id?: number
  name: string
  prospect_type?: string | null
  segment_hint?: string | null
  current_status?: string
  influence_score?: number | null
  contact_handle?: string | null
  contact_url?: string | null
  follower_count?: number | null
  last_contact_date?: string | null
  next_action?: string | null
  next_action_date?: string | null
  notes?: string | null
}

export async function upsertDream100(
  input: Dream100Input,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const payload = {
      name: input.name,
      prospect_type: input.prospect_type ?? null,
      segment_hint: input.segment_hint ?? null,
      current_status: input.current_status ?? 'identified',
      influence_score: input.influence_score ?? null,
      contact_handle: input.contact_handle ?? null,
      contact_url: input.contact_url ?? null,
      follower_count: input.follower_count ?? null,
      last_contact_date: input.last_contact_date ?? null,
      next_action: input.next_action ?? null,
      next_action_date: input.next_action_date ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await supabase.from('marketing_dream100').update(payload).eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/marketing/dream100')
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('marketing_dream100')
        .insert({ ...payload, added_by: user.id })
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/marketing/dream100')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteDream100(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }
    const { error } = await supabase.from('marketing_dream100').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/marketing/dream100')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Marketing Campaigns ──
export interface CampaignInput {
  id?: number
  name: string
  campaign_type?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string
  goal?: string | null
  budget?: number | null
  actual_spend?: number | null
  metrics_views?: number | null
  metrics_conversions?: number | null
  metrics_revenue?: number | null
  notes?: string | null
}

export async function upsertCampaign(
  input: CampaignInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }

    const payload = {
      name: input.name,
      campaign_type: input.campaign_type ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      status: input.status ?? 'planning',
      goal: input.goal ?? null,
      budget: input.budget ?? null,
      actual_spend: input.actual_spend ?? 0,
      metrics_views: input.metrics_views ?? 0,
      metrics_conversions: input.metrics_conversions ?? 0,
      metrics_revenue: input.metrics_revenue ?? 0,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await supabase
        .from('marketing_campaigns')
        .update(payload)
        .eq('id', input.id)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/marketing/campaigns')
      return { ok: true, id: input.id }
    } else {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .insert({ ...payload, created_by: user.id })
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath('/finance/marketing/campaigns')
      return { ok: true, id: data.id }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteCampaign(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }
    const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/marketing/campaigns')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteScript(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: '로그인이 필요합니다.' }
    const { error } = await supabase.from('marketing_scripts').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/finance/marketing/scripts')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
