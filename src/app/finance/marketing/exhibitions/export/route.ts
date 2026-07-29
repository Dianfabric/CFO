import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getExhibitionLeads } from '@/lib/exhibition-leads'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const event = request.nextUrl.searchParams.get('event')
  if (!event || !/^[a-z0-9-]+$/.test(event)) return NextResponse.json({ error: '행사 정보가 올바르지 않습니다.' }, { status: 400 })

  const leads = await getExhibitionLeads(event)
  const rows = leads
    .filter((lead) => lead.marketingConsent)
    .map((lead) => ({
      '등록일시': lead.createdAt ? new Date(lead.createdAt).toLocaleString('ko-KR') : '',
      '회사명': lead.companyName,
      '직책': lead.jobTitle,
      '전화번호': lead.phone,
      '이메일': lead.email,
      '마케팅 수신 동의일시': lead.consentedAt ?? '',
      '등록 경로': '공간디자인페어 QR VIP 등록',
    }))
  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = [18, 24, 16, 18, 30, 22, 22].map((wch) => ({ wch }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'VIP 고객 등록')
  const body = XLSX.write(book, { bookType: 'xlsx', type: 'buffer' })
  const filename = `DIAN_${event}_VIP-고객등록.xlsx`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
