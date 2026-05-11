import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { listClients as listAirtableClients } from '@/lib/airtable'

/**
 * GET /api/clients — 거래처 목록 (Airtable + Prisma 합본)
 *
 * 두 데이터 소스를 통합 반환:
 *  - Airtable (`AIRTABLE_CLIENTS_TABLE_ID`) — v1.0 시절 dian-quote 와 공유하는 메인 거래처 DB
 *  - Prisma `Client` 테이블 — v1.1 거래처 관리 (`/clients`, `/finance/clients`) 에서 등록한 신규
 *
 * 응답 스키마는 거래 입력 dialog 와의 호환성 위해 Prisma Client 에 가깝게 정규화.
 *  - id, name, phone, email, type, source('airtable' | 'db')
 *  - 중복 제거: 동일 이름이면 Airtable 우선
 */

interface UnifiedClient {
  id: string
  name: string
  phone: string | null
  email: string | null
  type: string | null
  source: 'airtable' | 'db'
  // Prisma 추가 필드 (있으면 노출)
  businessNumber?: string | null
  contactName?: string | null
  address?: string | null
  notes?: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim().toLowerCase() ?? ''
  const type = searchParams.get('type')?.trim() ?? ''

  // Airtable 호출 — env 누락/오류여도 Prisma 결과는 반환되도록 안전 처리
  let airtableClients: UnifiedClient[] = []
  try {
    if (process.env.AIRTABLE_API_TOKEN && process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_CLIENTS_TABLE_ID) {
      const list = await listAirtableClients()
      airtableClients = list.map((c) => ({
        id: `at_${c.id}`,
        name: c.name,
        phone: c.phone ?? null,
        email: c.email ?? null,
        type: c.type ?? null,
        source: 'airtable' as const,
      }))
    }
  } catch (err) {
    console.error('[/api/clients] Airtable error:', err)
    // continue without airtable
  }

  // Prisma 호출 — DB 없거나 오류여도 Airtable 결과는 반환
  let dbClients: UnifiedClient[] = []
  try {
    const where: Record<string, unknown> = { isActive: true }
    if (type) where.type = type
    if (search) where.name = { contains: search }
    const rows = await prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
    })
    dbClients = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      type: r.type,
      source: 'db' as const,
      businessNumber: r.businessNumber,
      contactName: r.contactName,
      address: r.address,
      notes: r.notes,
    }))
  } catch (err) {
    console.error('[/api/clients] Prisma error:', err)
  }

  // 합본 — 동일 이름은 Airtable 우선 (히스토리 보존), 그 다음 Prisma 추가분
  const seenNames = new Set<string>()
  const merged: UnifiedClient[] = []
  for (const c of airtableClients) {
    const key = c.name.trim().toLowerCase()
    if (seenNames.has(key)) continue
    seenNames.add(key)
    merged.push(c)
  }
  for (const c of dbClients) {
    const key = c.name.trim().toLowerCase()
    if (seenNames.has(key)) continue
    seenNames.add(key)
    merged.push(c)
  }

  // search 필터 (양쪽 합본 후 한 번 더)
  const filtered = search
    ? merged.filter((c) => c.name.toLowerCase().includes(search))
    : merged

  // 정렬 — 한국어 가나다
  filtered.sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  return NextResponse.json(filtered)
}

/**
 * POST /api/clients — 신규 거래처 등록
 *
 * v1.1 거래처 관리 흐름은 Prisma DB 에 저장 (24셀·티어 자동 매핑 정책 호환).
 * Airtable 등록은 별도 endpoint 또는 거래처 관리 페이지에서 수동 동기화.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, businessNumber, contactName, phone, email, address, type, notes } = body

    if (!name) {
      return NextResponse.json({ error: '거래처명을 입력해주세요' }, { status: 400 })
    }

    const client = await prisma.client.create({
      data: {
        name,
        businessNumber: businessNumber || null,
        contactName: contactName || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        type: type || 'CUSTOMER',
        notes: notes || null,
      },
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error('Clients POST Error:', error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
