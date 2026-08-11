import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const EVENT_SLUG = 'shanghai-intertextile-2026'
const BUCKET = 'exhibition-attachments'

type BoothRecordInput = {
  boothId: string
  brand: string
  hall: string
  boothCode: string
  isCustom?: boolean
  contact?: string
  purchaseRequestSamples?: string
  meetingMemo?: string
  nextAction?: string
  status?: string
  websiteChecked?: boolean
  inventoryChecked?: boolean
  photos?: string[]
  boothPhotoPath?: string
  businessCardPath?: string
}

function config() {
  const url = process.env.SUPABASE_FABRIC_URL
  const key = process.env.SUPABASE_FABRIC_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase 공유 저장소 연결 정보가 없습니다.')
  return { url, key }
}

async function signedUrl(path: string | null) {
  if (!path) return null
  const { url, key } = config()
  const response = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
  })
  if (!response.ok) return null
  const data = await response.json() as { signedURL?: string }
  return data.signedURL ? `${url}/storage/v1${data.signedURL}` : null
}

async function present(record: Awaited<ReturnType<typeof prisma.exhibitionBoothRecord.findMany>>[number]) {
  const paths = Array.isArray(record.photos) ? record.photos.filter((path): path is string => typeof path === 'string') : []
  return {
    ...record,
    photos: await Promise.all(paths.map(async (path) => ({ path, url: await signedUrl(path) }))),
    boothPhotoUrl: await signedUrl(record.boothPhotoPath),
    businessCardUrl: await signedUrl(record.businessCardPath),
  }
}

export async function GET() {
  try {
    const records = await prisma.exhibitionBoothRecord.findMany({ where: { eventSlug: EVENT_SLUG }, orderBy: { updatedAt: 'desc' } })
    return NextResponse.json({ records: await Promise.all(records.map(present)) })
  } catch (error) {
    console.error('exhibition records GET failed', error)
    return NextResponse.json({ error: '공유 현장 기록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as BoothRecordInput
    if (!input.boothId || !input.brand?.trim() || !input.hall || !input.boothCode?.trim()) {
      return NextResponse.json({ error: '업체명, Hall, 부스번호가 필요합니다.' }, { status: 400 })
    }
    const record = await prisma.exhibitionBoothRecord.upsert({
      where: { eventSlug_boothId: { eventSlug: EVENT_SLUG, boothId: input.boothId } },
      create: {
        eventSlug: EVENT_SLUG, boothId: input.boothId, brand: input.brand.trim(), hall: input.hall,
        boothCode: input.boothCode.trim().toUpperCase(), isCustom: Boolean(input.isCustom), contact: input.contact || null,
        purchaseRequestSamples: input.purchaseRequestSamples || null, meetingMemo: input.meetingMemo || null,
        nextAction: input.nextAction || null, status: input.status || '방문 예정', websiteChecked: Boolean(input.websiteChecked),
        inventoryChecked: Boolean(input.inventoryChecked), photos: input.photos ?? [], boothPhotoPath: input.boothPhotoPath || null,
        businessCardPath: input.businessCardPath || null,
      },
      update: {
        brand: input.brand.trim(), hall: input.hall, boothCode: input.boothCode.trim().toUpperCase(), isCustom: Boolean(input.isCustom),
        contact: input.contact || null, purchaseRequestSamples: input.purchaseRequestSamples || null, meetingMemo: input.meetingMemo || null,
        nextAction: input.nextAction || null, status: input.status || '방문 예정', websiteChecked: Boolean(input.websiteChecked),
        inventoryChecked: Boolean(input.inventoryChecked), photos: input.photos ?? [], boothPhotoPath: input.boothPhotoPath || null,
        businessCardPath: input.businessCardPath || null, updatedAt: new Date(),
      },
    })
    return NextResponse.json({ record: await present(record) })
  } catch (error) {
    console.error('exhibition records POST failed', error)
    return NextResponse.json({ error: '공유 현장 기록을 저장하지 못했습니다.' }, { status: 500 })
  }
}
