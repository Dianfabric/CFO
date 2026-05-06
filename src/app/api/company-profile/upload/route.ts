import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const kind = (form.get('kind') as string) || 'logo' // 'logo' | 'seal'

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
    }
    if (!['logo', 'seal'].includes(kind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext) ? ext : 'png'
    const mimeType = `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`

    const field = kind === 'logo' ? { logoPath: dataUrl } : { sealPath: dataUrl }
    await prisma.companyProfile.upsert({
      where: { id: 'singleton' },
      update: field,
      create: { id: 'singleton', name: '', ...field },
    })

    return NextResponse.json({ path: dataUrl })
  } catch (error) {
    console.error('Upload Error:', error)
    return NextResponse.json({ error: 'upload failed' }, { status: 500 })
  }
}
