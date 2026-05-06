/**
 * 시즌 사이클 운영 (Phase 9 #2c)
 * SS·FW 시즌별 운영 캘린더 (placeholder + 기본 구조)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, ChevronLeft, Calendar, Sprout, Snowflake } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SeasonStage {
  name: string
  start: string
  end: string
  description: string
}

const SS_STAGES: SeasonStage[] = [
  { name: '시즌 기획', start: '11-01', end: '12-31', description: '다음 SS 컨셉·트렌드 리서치' },
  { name: '샘플북 제작', start: '01-01', end: '02-28', description: 'SS 룩북 큐레이션·인쇄' },
  { name: '디자이너 발송', start: '03-01', end: '03-31', description: '주요 디자이너에게 룩북·샘플 발송' },
  { name: '시즌 진행', start: '04-01', end: '08-31', description: 'SS 시즌 매출 발생' },
  { name: '시즌 마감', start: '09-01', end: '09-30', description: 'SS 회고·재고 정리' },
]

const FW_STAGES: SeasonStage[] = [
  { name: '시즌 기획', start: '05-01', end: '06-30', description: '다음 FW 컨셉·트렌드 리서치' },
  { name: '샘플북 제작', start: '07-01', end: '08-31', description: 'FW 룩북 큐레이션·인쇄' },
  { name: '디자이너 발송', start: '09-01', end: '09-30', description: '주요 디자이너에게 룩북·샘플 발송' },
  { name: '시즌 진행', start: '10-01', end: '02-28', description: 'FW 시즌 매출 발생' },
  { name: '시즌 마감', start: '03-01', end: '03-31', description: 'FW 회고·재고 정리' },
]

function getCurrentStage(stages: SeasonStage[]): number {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const md = `${month}-${day}`
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i]
    // crude comparison — works for single-year stages, FW 시즌 진행 (10-01~02-28) needs special logic
    if (s.start <= s.end) {
      if (md >= s.start && md <= s.end) return i
    } else {
      // wraps across year (e.g., 10-01~02-28)
      if (md >= s.start || md <= s.end) return i
    }
  }
  return -1
}

async function loadData() {
  try {
    const supabase = await createClient()
    const [sampleBooks, samplesThisQuarter] = await Promise.all([
      supabase
        .from('sample_books')
        .select('id, name, season, year, status, product_count')
        .order('year', { ascending: false }),
      supabase
        .from('sample_requests')
        .select('id, request_date')
        .gte('request_date', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0]),
    ])
    return {
      books: sampleBooks.data ?? [],
      samples90: samplesThisQuarter.data?.length ?? 0,
    }
  } catch {
    return { books: [], samples90: 0 }
  }
}

export default async function SeasonsPage() {
  const data = await loadData()
  const ssStage = getCurrentStage(SS_STAGES)
  const fwStage = getCurrentStage(FW_STAGES)

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
            v1.1 · #2c 시즌 사이클
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Calendar className="h-5 w-5 text-slate-500" />
          시즌 사이클 운영
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          SS · FW 두 시즌 흐름 — 기획 → 샘플북 → 디자이너 발송 → 진행 → 마감
        </p>
      </div>

      {/* SS 시즌 */}
      <Card className="border-emerald-200 bg-emerald-50/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-emerald-500" />
            SS 시즌 (봄·여름)
          </CardTitle>
          <CardDescription>4월~8월 매출 시즌</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {SS_STAGES.map((s, i) => (
              <StageRow key={i} stage={s} active={i === ssStage} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FW 시즌 */}
      <Card className="border-blue-200 bg-blue-50/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-blue-500" />
            FW 시즌 (가을·겨울)
          </CardTitle>
          <CardDescription>10월~2월 매출 시즌</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {FW_STAGES.map((s, i) => (
              <StageRow key={i} stage={s} active={i === fwStage} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 활성 샘플북 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">활성 시즌 샘플북</CardTitle>
          <CardDescription>
            샘플북 관리 →{' '}
            <Link href="/finance/operations/sample-books" className="text-blue-600 hover:underline">
              샘플북 페이지
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.books.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">활성 샘플북 없음</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {data.books.slice(0, 6).map((b) => (
                <div
                  key={b.id}
                  className="rounded-md border border-slate-200 bg-white p-2 text-xs"
                >
                  <div className="font-semibold text-slate-800 truncate">{b.name}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {b.year} · {b.season?.toUpperCase()} · {b.product_count}개 제품
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 시즌 사이클 운영 핵심</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              <strong>리드 타임</strong>: 시즌 시작 5개월 전에 기획 시작
            </li>
            <li>
              <strong>샘플북</strong>: 시즌 시작 1개월 전에 디자이너 작업실 도달
            </li>
            <li>
              <strong>회고</strong>: 시즌 종료 직후 매출·마진·전환율 분석. 다음 시즌 기획에 반영
            </li>
            <li>
              디안의 <strong>12주 사이클</strong>은 시즌과 정렬되도록 — 사이클 1: 기획·샘플북, 2: 발송·진행, 3: 마감·회고
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function StageRow({ stage, active }: { stage: SeasonStage; active: boolean }) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 flex items-center gap-3 text-xs',
        active
          ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-300'
          : 'border-slate-200 bg-white',
      )}
    >
      <div className="font-mono text-[10px] text-slate-500 shrink-0 w-24">
        {stage.start} ~ {stage.end}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'font-semibold',
            active ? 'text-emerald-800' : 'text-slate-700',
          )}
        >
          {active && '▶ '}
          {stage.name}
        </div>
        <div className="text-[10px] text-slate-500">{stage.description}</div>
      </div>
    </div>
  )
}
