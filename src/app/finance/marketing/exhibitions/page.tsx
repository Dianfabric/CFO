import Link from 'next/link'
import { ChevronLeft, Download, UsersRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getExhibitionEvents, getExhibitionLeads } from '@/lib/exhibition-leads'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = { searchParams: Promise<{ event?: string }> }

export default async function ExhibitionLeadsPage({ searchParams }: Props) {
  const events = await getExhibitionEvents()
  const { event } = await searchParams
  const selected = events.find((item) => item.slug === event) ?? events[0]
  const leads = selected ? await getExhibitionLeads(selected.slug) : []

  return (
    <div className="space-y-6">
      <Link href="/finance/marketing" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
        <ChevronLeft className="h-3 w-3" /> 마케팅 허브
      </Link>
      <div>
        <div className="mb-1 flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5 text-blue-500" /><span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">v1.1 · #2b ⑫ 행사 업체 정보</span></div>
        <h1 className="text-2xl font-bold text-slate-900">행사 업체 정보</h1>
        <p className="mt-1 text-sm text-slate-500">전시회 QR VIP 고객 등록 정보를 행사별로 모아 이메일·문자 마케팅에 활용합니다.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {events.map((item) => (
          <Link key={item.slug} href={`/finance/marketing/exhibitions?event=${encodeURIComponent(item.slug)}`} className={`rounded-full border px-3 py-2 text-sm ${item.slug === selected?.slug ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'}`}>
            {item.name} <span className="ml-1 text-xs opacity-80">{item.leadCount}건</span>
          </Link>
        ))}
      </div>

      {selected ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div><CardTitle className="text-base">{selected.name}</CardTitle><p className="mt-1 text-xs text-slate-500">마케팅 수신 동의를 완료한 VIP 고객 {leads.length}건</p></div>
            <a href={`/finance/marketing/exhibitions/export?event=${encodeURIComponent(selected.slug)}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"><Download className="h-3.5 w-3.5" />엑셀 다운로드</a>
          </CardHeader>
          <CardContent>
            {leads.length ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-y bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">등록일</th><th className="p-3">회사명</th><th className="p-3">직책</th><th className="p-3">전화번호</th><th className="p-3">이메일</th><th className="p-3">수신동의</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="border-b"><td className="p-3 text-xs text-slate-500">{lead.createdAt ? new Date(lead.createdAt).toLocaleString('ko-KR') : '-'}</td><td className="p-3 font-medium">{lead.companyName}</td><td className="p-3">{lead.jobTitle}</td><td className="p-3">{lead.phone}</td><td className="p-3">{lead.email}</td><td className="p-3 text-emerald-700">{lead.marketingConsent ? '동의' : '미동의'}</td></tr>)}</tbody></table></div>
            ) : <p className="py-12 text-center text-sm text-slate-400">아직 등록된 VIP 고객이 없습니다.</p>}
          </CardContent>
        </Card>
      ) : <Card><CardContent className="py-12 text-center text-sm text-slate-400">등록된 행사가 없습니다.</CardContent></Card>}
    </div>
  )
}
