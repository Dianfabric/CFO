/**
 * 샘플북 관리 (Phase 4 #2c)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SampleBooksList, { type BookRow } from '@/components/v11/operations/SampleBooksList'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sample_books')
      .select('*')
      .order('year', { ascending: false, nullsFirst: false })
      .order('season')
      .order('name')
      .limit(100)
    return { items: (data ?? []) as BookRow[], error: error?.message ?? null }
  } catch (e) {
    return {
      items: [] as BookRow[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function SampleBooksPage() {
  const { items, error } = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/operations"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        운영 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2c 샘플북
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">시즌 샘플북</h1>
        <p className="mt-1 text-sm text-slate-500">
          시즌(SS·FW)·테마별 큐레이션 패키지 — 디자이너 작업실 비치용
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error} — v11.4_samples.sql 적용 필요
        </div>
      )}

      <SampleBooksList books={items} />

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 샘플북 활용</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>시즌 단위</strong>: SS·FW 매 시즌 새 샘플북. 디자이너의 시즌 작업과 정렬
            </li>
            <li>
              <strong>큐레이션 컨셉</strong>: 각 샘플북마다 명확한 스토리 (예: "베이지의 다양한 결",
              "도시 미니멀")
            </li>
            <li>
              <strong>디자이너 비치</strong>: 인기 디자이너 사무실에 한 권씩 — 자주 펼쳐지는 게 핵심
            </li>
            <li>
              <strong>발송 추적</strong>: 어느 디자이너에게 어느 샘플북을 보냈는지 기록 (송부 시{' '}
              <Link href="/finance/operations/samples" className="text-blue-600 hover:underline">
                샘플 요청
              </Link>
              으로 등록)
            </li>
            <li>
              <strong>보관</strong>: 시즌 종료 후 archived → 다음 시즌 작업 시 참고용
            </li>
          </ul>
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            💡 다음 단계로 샘플북에 제품을 등록하는 인터페이스(드래그·드롭) 추가 예정
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
