import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getCatalogCustomers } from '@/lib/exhibition-leads'

export const dynamic = 'force-dynamic'

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : ''
}

export async function GET(request: NextRequest) {
  const start = request.nextUrl.searchParams.get('start') || undefined
  const end = request.nextUrl.searchParams.get('end') || undefined
  const validDate = (value: string | undefined) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (!validDate(start) || !validDate(end)) return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 })

  const leads = await getCatalogCustomers({ start, end })
  const rows = leads.map((lead) => ({
    '가입일시': formatDate(lead.createdAt),
    '작성 이메일': lead.email ?? '',
    '카카오 이메일': lead.kakaoEmail ?? '',
    '성함': lead.name ?? '',
    '전화번호': lead.phone ?? '',
    '회사명': lead.companyName ?? '',
    '직책': lead.jobTitle ?? '',
    '자주 쓰는 원단': lead.favoriteFabrics ?? '',
    '로그인 방식': lead.provider ?? '',
    '필수정보': lead.profileCompleted ? '완료' : '미완료',
  }))
  const headers = ['가입일시', '작성 이메일', '카카오 이메일', '성함', '전화번호', '회사명', '직책', '자주 쓰는 원단', '로그인 방식', '필수정보']
  const sheet = XLSX.utils.aoa_to_sheet([headers])
  XLSX.utils.sheet_add_json(sheet, rows, { origin: 'A2', skipHeader: true })
  sheet['!cols'] = [20, 30, 30, 16, 18, 24, 16, 28, 16, 14].map((wch) => ({ wch }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '카탈로그 가입 고객')
  const body = XLSX.write(book, { bookType: 'xlsx', type: 'buffer' })
  const period = start || end ? `${start || '전체'}~${end || '전체'}` : '전체'
  const filename = `DIAN_카탈로그-가입고객_${period}.xlsx`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
