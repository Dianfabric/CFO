import { NextRequest, NextResponse } from 'next/server'
import { rentalDb, BOOK_IMAGE_BUCKET } from '@/lib/rental/db'

export const dynamic = 'force-dynamic'

// POST /api/samples/books/photo — 샘플북 사진 업로드 (클라이언트에서 1200px 리사이즈 후 전송)
//   formData: file(JPEG), bookId
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const bookId = form.get('bookId') as string | null
    if (!file || !bookId) return NextResponse.json({ error: 'file, bookId가 필요합니다' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: '5MB 이하로 올려주세요' }, { status: 400 })

    const db = rentalDb()
    const { data: book, error: bookErr } = await db.from('sample_books')
      .select('id').eq('id', bookId).single()
    if (bookErr || !book) return NextResponse.json({ error: '샘플북을 찾을 수 없습니다' }, { status: 404 })

    // 파일명은 UUID 사용 — 코드(#·: 포함)를 쓰면 URL이 깨짐
    const name = `${book.id}.jpg`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await db.storage.from(BOOK_IMAGE_BUCKET)
      .upload(name, buf, { contentType: 'image/jpeg', upsert: true })
    if (upErr) throw new Error(upErr.message)

    const { data: pub } = db.storage.from(BOOK_IMAGE_BUCKET).getPublicUrl(name)
    // 캐시 무효화를 위해 버전 쿼리 부착
    const url = `${pub.publicUrl}?v=${Date.now()}`
    const { error: updErr } = await db.from('sample_books').update({ image_url: url }).eq('id', bookId)
    if (updErr) throw new Error(updErr.message)

    return NextResponse.json({ imageUrl: url })
  } catch (e) {
    console.error('samples/books/photo', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
