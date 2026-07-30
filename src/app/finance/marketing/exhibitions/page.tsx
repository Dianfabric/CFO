import Link from 'next/link'
import { ChevronLeft, Download, Search, UsersRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCatalogCustomers } from '@/lib/exhibition-leads'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = { searchParams: Promise<{ start?: string; end?: string }> }

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'
}

function value(value: string | null) {
  return value || '-'
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

export default async function ExhibitionLeadsPage({ searchParams }: Props) {
  const params = await searchParams
  const start = validDate(params.start)
  const end = validDate(params.end)
  const leads = await getCatalogCustomers({ start: start || undefined, end: end || undefined })
  const exportParams = new URLSearchParams()
  if (start) exportParams.set('start', start)
  if (end) exportParams.set('end', end)
  const exportHref = `/finance/marketing/exhibitions/export${exportParams.size ? `?${exportParams}` : ''}`

  return (
    <div className="space-y-6">
      <Link href="/finance/marketing" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
        <ChevronLeft className="h-3 w-3" /> 마케팅 허브
      </Link>
      <div>
        <div className="mb-1 flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5 text-blue-500" /><span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">v1.1 · #2b ⑫ 카탈로그 가입 고객</span></div>
        <h1 className="text-2xl font-bold text-slate-900">카탈로그 가입 고객</h1>
        <p className="mt-1 text-sm text-slate-500">사이트에 가입한 모든 고객을 확인하고, 가입일로 기간을 필터할 수 있습니다.</p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">가입 고객 {leads.length}건</CardTitle><p className="mt-1 text-xs text-slate-500">시작일·종료일은 모두 포함되며, 비워 두면 전체 기간을 조회합니다.</p></div><a href={exportHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"><Download className="h-3.5 w-3.5" />현재 목록 엑셀 다운로드</a></div>
          <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-slate-50 p-3">
            <label className="grid gap-1 text-xs font-medium text-slate-600">가입 시작일<input name="start" type="date" defaultValue={start} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">가입 종료일<input name="end" type="date" defaultValue={end} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800" /></label>
            <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"><Search className="h-3.5 w-3.5" />조회</button>
            {(start || end) && <Link href="/finance/marketing/exhibitions" className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-100">필터 초기화</Link>}
          </form>
        </CardHeader>
        <CardContent>
          {leads.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[1400px] text-left text-sm"><thead className="border-y bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">가입일</th><th className="p-3">작성 이메일</th><th className="p-3">카카오 이메일</th><th className="p-3">성함</th><th className="p-3">전화번호</th><th className="p-3">회사명</th><th className="p-3">직책</th><th className="p-3">자주 쓰는 원단</th><th className="p-3">로그인 방식</th><th className="p-3">필수정보</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="border-b"><td className="p-3 text-xs text-slate-500">{formatDate(lead.createdAt)}</td><td className="p-3">{value(lead.email)}</td><td className="p-3">{value(lead.kakaoEmail)}</td><td className="p-3 font-medium">{value(lead.name)}</td><td className="p-3">{value(lead.phone)}</td><td className="p-3">{value(lead.companyName)}</td><td className="p-3">{value(lead.jobTitle)}</td><td className="p-3">{value(lead.favoriteFabrics)}</td><td className="p-3">{value(lead.provider)}</td><td className={`p-3 ${lead.profileCompleted ? 'text-emerald-700' : 'text-amber-700'}`}>{lead.profileCompleted ? '완료' : '미완료'}</td></tr>)}</tbody></table></div>
          ) : <p className="py-12 text-center text-sm text-slate-400">선택한 기간에 가입한 카탈로그 고객이 없습니다.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
