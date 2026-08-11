import { NextRequest, NextResponse } from 'next/server'

const BUCKET = 'exhibition-attachments'
const MAX_BYTES = 10 * 1024 * 1024

function config() {
  const url = process.env.SUPABASE_FABRIC_URL
  const key = process.env.SUPABASE_FABRIC_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase 공유 저장소 연결 정보가 없습니다.')
  return { url, key }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('file')
    const boothId = String(form.get('boothId') ?? '').replace(/[^a-zA-Z0-9_-]/g, '')
    const kind = String(form.get('kind') ?? 'sample').replace(/[^a-zA-Z0-9_-]/g, '')
    if (!(file instanceof File) || !boothId) return NextResponse.json({ error: '이미지와 업체 정보가 필요합니다.' }, { status: 400 })
    if (!file.type.startsWith('image/') || file.size > MAX_BYTES) return NextResponse.json({ error: '10MB 이하 이미지 파일만 올릴 수 있습니다.' }, { status: 400 })
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `shanghai-intertextile-2026/${boothId}/${kind}-${crypto.randomUUID()}.${extension}`
    const { url, key } = config()
    const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': file.type, 'x-upsert': 'false' },
      body: await file.arrayBuffer(),
    })
    if (!response.ok) throw new Error(`Storage upload failed: ${response.status}`)
    return NextResponse.json({ path }, { status: 201 })
  } catch (error) {
    console.error('exhibition image upload failed', error)
    return NextResponse.json({ error: '사진 업로드에 실패했습니다.' }, { status: 500 })
  }
}
