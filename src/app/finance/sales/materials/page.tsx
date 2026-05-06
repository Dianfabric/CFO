/**
 * 영업자료 자동생성 (#9) — 허브
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
  Wand2,
  Plus,
  FileText,
  Library,
  Brain,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TIER_LABEL: Record<string, { name: string; bg: string; text: string }> = {
  value: { name: '저가', bg: 'bg-blue-100', text: 'text-blue-700' },
  mid: { name: '중가', bg: 'bg-slate-100', text: 'text-slate-700' },
  premium: { name: '프리미엄', bg: 'bg-amber-100', text: 'text-amber-700' },
  luxury: { name: '럭셔리', bg: 'bg-stone-900 text-stone-100', text: '' },
}

const STATUS_LABEL: Record<string, { name: string; icon: typeof Clock; cls: string }> = {
  draft: { name: '초안', icon: Clock, cls: 'text-slate-500' },
  generating: { name: '생성 중', icon: Loader2, cls: 'text-amber-600' },
  generated: { name: '생성 완료', icon: CheckCircle2, cls: 'text-emerald-600' },
  published: { name: '발송됨', icon: CheckCircle2, cls: 'text-blue-600' },
  failed: { name: '실패', icon: AlertCircle, cls: 'text-rose-600' },
}

async function loadData() {
  try {
    const supabase = await createClient()
    const [matQ, fwCount, assetCount] = await Promise.all([
      supabase
        .from('sales_materials')
        .select(
          'id, title, status, target_tier, target_occupation, product_name_input, framework_ids, created_at, slide_count, video_durations',
        )
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('sales_psychology_frameworks')
        .select('id', { count: 'exact', head: true })
        .eq('active', true),
      supabase.from('sales_material_assets').select('id', { count: 'exact', head: true }),
    ])

    return {
      materials: matQ.data ?? [],
      fwCount: fwCount.count ?? 0,
      assetCount: assetCount.count ?? 0,
      error: matQ.error?.message,
    }
  } catch (e) {
    return {
      materials: [],
      fwCount: 0,
      assetCount: 0,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function MaterialsHubPage() {
  const data = await loadData()

  const totals = {
    all: data.materials.length,
    generated: data.materials.filter((m) => m.status === 'generated').length,
    failed: data.materials.filter((m) => m.status === 'failed').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #9 영업자료 자동생성
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Wand2 className="h-5 w-5 text-slate-500" />
          영업자료 자동생성
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          신제품·기획제품을 거래처에 보낼 자료(PPT + 영상 스크립트)를 디안 톤 + 심리·인지과학
          프레임워크로 5분 안에 자동 생성
        </p>
      </div>

      {/* 액션 영역 */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="py-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
              <Wand2 className="h-3.5 w-3.5" />
              새 자료 만들기
            </div>
            <p className="mt-1 text-xs text-slate-600">
              5단계 위저드 — 대상·제품·프레임워크·자료·생성
            </p>
            <Link
              href="/finance/sales/materials/new"
              className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-amber-600 px-4 text-xs font-semibold text-white shadow hover:bg-amber-700"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              생성 시작
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Library className="h-3.5 w-3.5" />
              자산 라이브러리
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {data.assetCount}
              <span className="ml-1 text-xs font-normal text-slate-500">건</span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              이미지·해외 자료·레퍼런스
            </p>
            <Link
              href="/finance/sales/materials/library"
              className="mt-2 inline-flex items-center text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline"
            >
              라이브러리 →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Brain className="h-3.5 w-3.5" />
              프레임워크
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {data.fwCount}
              <span className="ml-1 text-xs font-normal text-slate-500">종</span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              치알디니·스토리브랜드·러셀 등
            </p>
            <Link
              href="/finance/sales/materials/frameworks"
              className="mt-2 inline-flex items-center text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline"
            >
              프레임워크 →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 요약 통계 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="총 자료" value={totals.all} accent="slate" />
        <SummaryCard label="생성 완료" value={totals.generated} accent="emerald" />
        <SummaryCard label="실패" value={totals.failed} accent="rose" />
      </div>

      {data.error && (
        <Card className="border-rose-200 bg-rose-50/30">
          <CardContent className="py-3 text-xs text-rose-700">
            ⚠ 데이터 로드 실패: {data.error}
            <p className="mt-1 italic">
              ※ <code>v11.9_sales_materials.sql</code>을 Supabase에 적용했는지 확인하세요.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 최근 자료 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-slate-500" />
            최근 자료
          </CardTitle>
          <CardDescription className="text-xs">최근 20건</CardDescription>
        </CardHeader>
        <CardContent>
          {data.materials.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center">
              <p className="text-sm text-slate-400">아직 생성된 자료가 없습니다.</p>
              <Link
                href="/finance/sales/materials/new"
                className="mt-3 inline-flex h-8 items-center justify-center rounded-md border border-amber-400 bg-white px-3 text-xs font-medium text-amber-700 hover:bg-amber-50"
              >
                <Plus className="mr-1 h-3 w-3" />
                첫 자료 만들기
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {data.materials.map((m) => {
                const tier = m.target_tier ? TIER_LABEL[m.target_tier] : null
                const status = STATUS_LABEL[m.status] ?? STATUS_LABEL.draft
                const StatusIcon = status.icon
                return (
                  <li key={m.id}>
                    <Link
                      href={`/finance/sales/materials/${m.id}`}
                      className="flex items-center gap-3 px-2 py-3 -mx-2 rounded-md hover:bg-slate-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <StatusIcon
                            className={`h-3.5 w-3.5 shrink-0 ${status.cls} ${
                              m.status === 'generating' ? 'animate-spin' : ''
                            }`}
                          />
                          <span className={`text-[10px] font-semibold ${status.cls}`}>
                            {status.name}
                          </span>
                          {tier && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tier.bg} ${tier.text}`}
                            >
                              {tier.name}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            슬라이드 {m.slide_count} ·{' '}
                            {(m.video_durations as number[])?.join('/')}초 영상
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                          {m.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 truncate">
                          제품: {m.product_name_input}
                          {(m.framework_ids as string[])?.length > 0 && (
                            <>
                              {' '}
                              · 프레임워크{' '}
                              {(m.framework_ids as string[]).slice(0, 2).join(', ')}
                              {(m.framework_ids as string[]).length > 2 &&
                                ` 외 ${(m.framework_ids as string[]).length - 2}`}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-right">
                        <span className="text-[10px] text-slate-400">
                          {new Date(m.created_at).toLocaleDateString('ko-KR', {
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: 'slate' | 'emerald' | 'rose'
}) {
  const cls = {
    slate: 'text-slate-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  }[accent]
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-bold ${cls}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
