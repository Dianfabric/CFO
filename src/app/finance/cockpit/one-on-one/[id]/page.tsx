/**
 * 1:1 미팅 노트 상세 (Phase 7 #7 ⑥)
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Sparkles, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import OneOnOneForm, {
  type OneOnOneRow,
} from '@/components/v11/cockpit/OneOnOneForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OneOnOneDetail({ params }: PageProps) {
  const { id } = await params
  const noteId = parseInt(id, 10)
  if (!Number.isFinite(noteId)) notFound()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('one_on_one_notes')
    .select('*')
    .eq('id', noteId)
    .maybeSingle()

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/finance/cockpit/one-on-one"
          className="inline-flex items-center gap-1 text-xs text-slate-500"
        >
          <ChevronLeft className="h-3 w-3" />
          1:1 노트 목록
        </Link>
        <p className="text-sm text-rose-600">
          노트를 찾을 수 없습니다 (본인 작성 노트만 조회 가능). {error?.message}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link
        href="/finance/cockpit/one-on-one"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        1:1 노트 목록
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #7 ⑥ 1:1 노트 #{data.id}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          1:1 미팅 — {data.counterpart_name ?? '(이름 미입력)'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{data.meeting_date}</p>
      </div>

      <OneOnOneForm note={data as OneOnOneRow} />
    </div>
  )
}
