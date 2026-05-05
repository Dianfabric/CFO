/**
 * 12주 회고 워크북 (Phase 8 #1 ⑤)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CycleRetroForm, { type RetroRow } from '@/components/v11/cycle/CycleRetroForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()

    // 가장 최근 사이클 (활성/완료 모두)
    const { data: cycles, error } = await supabase
      .from('cycles')
      .select('*')
      .order('cycle_number', { ascending: false })
      .limit(10)

    return { cycles: (cycles ?? []) as RetroRow[], error: error?.message ?? null }
  } catch (e) {
    return {
      cycles: [] as RetroRow[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function RetroPage() {
  const { cycles, error } = await loadData()

  // 활성 사이클을 최상단에 (편집), 완료된 것은 아래
  const active = cycles.find((c) => !c.retro_completed) ?? cycles[0]
  const completed = cycles.filter((c) => c.retro_completed)

  return (
    <div className="space-y-6">
      <Link
        href="/finance/cycle"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        12주 대시보드
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #1 ⑤ 12주 회고 워크북
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">12주 회고 워크북</h1>
        <p className="mt-1 text-sm text-slate-500">
          잘 된 것 / 안 된 것 / 학습 / 다음 집중 — 매 사이클 끝에 작성하면 영구 자산
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {!active ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-slate-400">아직 사이클이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                사이클 #{active.cycle_number} 회고 — {active.start_date} ~ {active.end_date}
              </CardTitle>
              <CardDescription>
                회고는 매 사이클 끝에 작성. 진행 중이라면 임시 저장 가능
              </CardDescription>
            </CardHeader>
          </Card>

          <CycleRetroForm cycle={active} />
        </>
      )}

      {/* 과거 회고 이력 */}
      {completed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-slate-500" />
              과거 회고 ({completed.length})
            </CardTitle>
            <CardDescription>완료된 사이클의 학습 누적</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {completed.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-slate-800">
                      사이클 #{c.cycle_number}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {c.start_date} ~ {c.end_date}
                    </div>
                  </div>
                  {c.lessons_learned && (
                    <div className="mt-2 rounded-md border border-blue-100 bg-blue-50/40 p-2 text-xs text-slate-700">
                      <strong className="text-blue-700">학습:</strong> {c.lessons_learned}
                    </div>
                  )}
                  {c.next_cycle_focus && (
                    <div className="mt-1 rounded-md border border-amber-100 bg-amber-50/40 p-2 text-xs text-slate-700">
                      <strong className="text-amber-700">다음 집중:</strong>{' '}
                      {c.next_cycle_focus}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 위대한 12주 회고 핵심</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>잘 된 것</strong>: 결과를 만든 행동·시스템 — 다음에도 계속하라
            </li>
            <li>
              <strong>안 된 것</strong>: 기대 못 미친 것 — 원인까지 분석. 그만하거나 바꿔라
            </li>
            <li>
              <strong>학습</strong>: 이번 사이클로 얻은 영구 자산 — 3~5가지로 압축
            </li>
            <li>
              <strong>다음 집중</strong>: 학습을 어떻게 적용할 것인가 — 구체적 행동
            </li>
            <li>
              <strong>회고는 1주 (사이클 종료 후 휴식 주)에 천천히</strong>. 다음 사이클 시작 전 비전·목표
              조정
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
