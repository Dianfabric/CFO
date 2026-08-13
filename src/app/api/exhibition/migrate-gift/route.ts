import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// One-time deployment migration. Delete this route immediately after applying.
export async function POST() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE cfo.exhibition_booth_records ADD COLUMN IF NOT EXISTS gift_checked boolean NOT NULL DEFAULT false')
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('exhibition gift migration failed', error)
    return NextResponse.json({ error: '선물 항목 저장소 생성에 실패했습니다.' }, { status: 500 })
  }
}
