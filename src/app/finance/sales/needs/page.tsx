/**
 * 니즈 카드 / 디자이너 인사이트 보드 (Phase 2 #2a ④)
 *
 * 디자이너 인터뷰·관찰에서 발견한 니즈를 칸반 보드로 추적.
 * 새 → 팀 공유 → 대응 중 → 해결됨.
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import NeedCardsBoard, { type NeedCardRow } from '@/components/v11/sales/NeedCardsBoard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()

    const [cardsRes, clientsRes] = await Promise.all([
      supabase
        .from('need_cards')
        .select('*, clients(name)')
        .order('votes', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('clients').select('id, name').eq('active', true).order('name'),
    ])

    return {
      cards: ((cardsRes.data ?? []) as unknown) as NeedCardRow[],
      clients: clientsRes.data ?? [],
      errors: [cardsRes.error, clientsRes.error].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      cards: [] as NeedCardRow[],
      clients: [],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function NeedsPage() {
  const data = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/sales"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        영업 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2a ④ 니즈 카드
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">니즈 카드 / 인사이트 보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          디자이너·거래처 인터뷰에서 발견한 니즈를 칸반으로 추적. 좋아요·우선순위가 높은 니즈는
          AI 추천에 반영됩니다.
        </p>
      </div>

      {data.errors.length > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                {data.errors.slice(0, 2).map((e, i) => (
                  <div key={i}>{e.message}</div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <NeedCardsBoard cards={data.cards} clients={data.clients} />

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 니즈 카드 활용</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>발견</strong> (new): 인터뷰·관찰에서 처음 본 니즈 즉시 등록
            </li>
            <li>
              <strong>팀 공유</strong> (shared): 가치 있다고 판단되어 팀에 공유
            </li>
            <li>
              <strong>대응 중</strong> (in_progress): 신제품/서비스로 응답 중
            </li>
            <li>
              <strong>해결됨</strong> (addressed): 디안의 라인업·서비스에 반영 완료
            </li>
            <li>
              <strong>좋아요</strong>는 동일 니즈를 다른 거래처에서 듣고 공감했다는 신호 — 우선순위
              결정에 활용
            </li>
          </ul>
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            💡 일정 기간 (예: 분기) 동안 좋아요 5+ 가 모인 니즈는 신제품 라인업이나 카탈로그 보강에
            우선 반영하시면 좋습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
