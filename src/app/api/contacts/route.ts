/**
 * GET  /api/contacts  — Lead 목록 (검색·필터)
 * POST /api/contacts  — Lead 등록
 *
 * GET query:
 *   q            — 이름/회사/전화/이메일/메모 검색
 *   status       — 단일 상태 필터
 *   occupation   — 직군 코드 필터
 *   product      — 관심 제품 필터
 *   limit        — 기본 200
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ContactLead, LeadStatus } from '@/lib/contact-leads'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const status = searchParams.get('status') as LeadStatus | null
  const occupation = searchParams.get('occupation')
  const product = searchParams.get('product')
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 1000)

  try {
    const supabase = await createClient()
    let query = supabase
      .from('contact_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)
    if (occupation) query = query.contains('occupations', [occupation])
    if (product) query = query.contains('product_interests', [product])
    if (q) {
      // 콤마·괄호 등 PostgREST or() 파싱 깨질 수 있는 문자 제거
      const safe = q.replace(/[,()]/g, ' ').trim()
      if (safe) {
        query = query.or(
          `name.ilike.%${safe}%,company_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%,notes.ilike.%${safe}%,inquiry_summary.ilike.%${safe}%`,
        )
      }
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ leads: (data ?? []) as ContactLead[] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lead 조회 실패' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.name) {
      return NextResponse.json({ error: 'name 필수' }, { status: 400 })
    }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('contact_leads')
      .insert({
        name: body.name,
        position: body.position ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        company_name: body.company_name ?? null,
        address: body.address ?? null,
        occupations: body.occupations ?? [],
        product_interests: body.product_interests ?? [],
        inquiry_source: body.inquiry_source ?? null,
        inquiry_summary: body.inquiry_summary ?? null,
        notes: body.notes ?? null,
        status: body.status ?? 'new',
        next_action: body.next_action ?? null,
        next_action_date: body.next_action_date ?? null,
      })
      .select('*')
      .single<ContactLead>()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lead: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lead 등록 실패' },
      { status: 500 },
    )
  }
}
