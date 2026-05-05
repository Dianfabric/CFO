/**
 * 1:1 미팅 노트 리스트 (Phase 7 #7 ⑥)
 * 캠벨 신뢰 보호 — 작성자 본인만 조회·편집 가능 (RLS 강제)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  ChevronLeft,
  Plus,
  Lock,
  Users,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createOneOnOne } from '@/app/finance/cockpit/actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { items: [], error: null }

    const { data, error } = await supabase
      .from('one_on_one_notes')
      .select('*')
      .order('meeting_date', { ascending: false })
      .limit(100)

    return { items: data ?? [], error: error?.message ?? null }
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export default async function OneOnOneListPage() {
  const { items, error } = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/cockpit"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        코크핏
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 · #7 ⑥ 1:1 노트 (개인)
            </span>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Lock className="h-5 w-5 text-emerald-600" />
            1:1 미팅 노트
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            <strong className="text-emerald-700">본인만 조회 가능</strong> — 다른 사용자(CEO 포함)는
            볼 수 없습니다 (RLS 강제). 캠벨 신뢰 원칙.
          </p>
        </div>
        <form action={createOneOnOne}>
          <Button type="submit">
            <Plus className="mr-1 h-4 w-4" />
            새 1:1 노트
          </Button>
        </form>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            내 1:1 이력 ({items.length})
          </CardTitle>
          <CardDescription>최근 100건</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Lock className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">
                아직 1:1 노트가 없습니다. 첫 미팅을 기록해 보세요.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/finance/cockpit/one-on-one/${n.id}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          {n.counterpart_name ?? '(이름 미입력)'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {n.meeting_date}
                        </span>
                      </div>
                      {(n.agenda || n.notes) && (
                        <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-1">
                          {n.agenda ?? n.notes}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-emerald-100 bg-emerald-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 캠벨 1:1 미팅 원칙</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>신뢰는 노출되지 않을 때만 자란다</strong> — 1:1 노트는 절대 다른 사람이 볼 수
              없어야 함 (시스템에서 RLS로 강제)
            </li>
            <li>
              <strong>관계 형성 (Rapport)</strong>: 안부·개인사부터 — 일이 아니라 사람이 먼저
            </li>
            <li>
              <strong>성과 (Performance)</strong>: 진행 사항 + 막힘
            </li>
            <li>
              <strong>피드백 양방향</strong>: 내가 주는 것뿐 아니라 내가 받는 것도 기록
            </li>
            <li>
              <strong>결정·다음 단계</strong>: 명확한 책임자와 기한
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
