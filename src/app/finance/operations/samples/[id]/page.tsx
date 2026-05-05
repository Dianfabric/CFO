/**
 * 샘플 요청 상세 (Phase 4 #2c)
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Sparkles, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SampleRequestForm, {
  type RequestRow,
  type ItemRow,
} from '@/components/v11/operations/SampleRequestForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SampleRequestDetail({ params }: PageProps) {
  const { id } = await params
  const reqId = parseInt(id, 10)
  if (!Number.isFinite(reqId)) notFound()

  const supabase = await createClient()
  const [reqRes, itemsRes, clientsRes] = await Promise.all([
    supabase.from('sample_requests').select('*').eq('id', reqId).maybeSingle(),
    supabase
      .from('sample_items')
      .select('*')
      .eq('request_id', reqId)
      .order('id', { ascending: true }),
    supabase.from('clients').select('id, name').eq('active', true).order('name'),
  ])

  if (reqRes.error || !reqRes.data) {
    return (
      <div className="space-y-4">
        <Link
          href="/finance/operations/samples"
          className="inline-flex items-center gap-1 text-xs text-slate-500"
        >
          <ChevronLeft className="h-3 w-3" />
          샘플 요청 목록
        </Link>
        <p className="text-sm text-rose-600">
          요청을 찾을 수 없습니다. {reqRes.error?.message}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link
        href="/finance/operations/samples"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        샘플 요청 목록
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2c 샘플 요청 #{reqRes.data.id}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">샘플 요청 상세</h1>
      </div>

      <SampleRequestForm
        request={reqRes.data as RequestRow}
        items={(itemsRes.data ?? []) as ItemRow[]}
        clients={clientsRes.data ?? []}
      />
    </div>
  )
}
