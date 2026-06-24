/**
 * 마케팅 허브 (Phase 3 #2b 진입점)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  Palette,
  Calendar,
  TrendingUp,
  Megaphone,
  Image as ImageIcon,
  Heart,
  AlertCircle,
  Trophy,
  Layers,
  Library,
  Wand2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const [brand, contentCount, scriptCount, growth] = await Promise.all([
      supabase.from('brand_identity').select('big_idea, brand_persona, updated_at').eq('id', 1).maybeSingle(),
      supabase.from('content_items').select('id', { count: 'exact', head: true }),
      supabase.from('marketing_scripts').select('id', { count: 'exact', head: true }),
      supabase.from('channel_growth').select('*'),
    ])
    return {
      brand: brand.data,
      contentCount: contentCount.count ?? 0,
      scriptCount: scriptCount.count ?? 0,
      growth: growth.data ?? [],
      errors: [brand.error, contentCount.error, scriptCount.error, growth.error].filter(
        Boolean,
      ) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      brand: null,
      contentCount: 0,
      scriptCount: 0,
      growth: [],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function MarketingHubPage() {
  const data = await loadData()

  const brandFilled = !!(data.brand?.big_idea && data.brand?.brand_persona)
  const totalFollowers = data.growth.reduce(
    (s, g) => s + Number(g.current_followers ?? 0),
    0,
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · Phase 3 · #2b 마케팅·브랜딩
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">마케팅 허브</h1>
        <p className="mt-1 text-sm text-slate-500">
          러셀·맥키·룬·비숍 — 빅 아이디어 → 콘텐츠 → 채널 → 결과
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
                <p className="mt-1 text-xs">
                  Supabase에 v11.2_marketing.sql 적용 후 재시도.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI 4개 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">브랜드 정체성</span>
              <Palette className="h-4 w-4 text-purple-500" />
            </div>
            <div
              className={
                'text-2xl font-bold tabular-nums ' +
                (brandFilled ? 'text-emerald-700' : 'text-slate-400')
              }
            >
              {brandFilled ? '✓ 정의됨' : '미정의'}
            </div>
            <p className="text-[11px] text-slate-400">
              {brandFilled ? '빅 아이디어 + 페르소나 작성됨' : '먼저 정의 필요'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">콘텐츠 항목</span>
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {data.contentCount}
            </div>
            <p className="text-[11px] text-slate-400">아이디어부터 발행까지</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">총 팔로워</span>
              <Heart className="h-4 w-4 text-pink-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {totalFollowers.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400">
              모든 채널 합계 (마지막 스냅샷)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">HSO 스크립트</span>
              <Megaphone className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {data.scriptCount}
            </div>
            <p className="text-[11px] text-slate-400">러셀 4부작 라이브러리</p>
          </CardContent>
        </Card>
      </div>

      {/* 페이지 그리드 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">⚡ 마케팅 페이지</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Link href="/finance/marketing/brand">
            <Card className="cursor-pointer transition hover:border-purple-300 hover:bg-purple-50/30">
              <CardContent className="space-y-1 py-3">
                <Palette className="h-5 w-5 text-purple-500" />
                <div className="text-sm font-semibold">① 브랜드 정체성</div>
                <div className="text-[11px] text-slate-500">빅아이디어·페르소나·시각</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/marketing/content">
            <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
              <CardContent className="space-y-1 py-3">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div className="text-sm font-semibold">② 콘텐츠 캘린더</div>
                <div className="text-[11px] text-slate-500">5단계 칸반</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/marketing/channels">
            <Card className="cursor-pointer transition hover:border-pink-300 hover:bg-pink-50/30">
              <CardContent className="space-y-1 py-3">
                <TrendingUp className="h-5 w-5 text-pink-500" />
                <div className="text-sm font-semibold">③ 채널 KPI</div>
                <div className="text-[11px] text-slate-500">팔로워·참여·문의</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/marketing/scripts">
            <Card className="cursor-pointer transition hover:border-amber-300 hover:bg-amber-50/30">
              <CardContent className="space-y-1 py-3">
                <Megaphone className="h-5 w-5 text-amber-500" />
                <div className="text-sm font-semibold">④ Hook·Story·Offer</div>
                <div className="text-[11px] text-slate-500">러셀 4부작 라이브러리</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/marketing/dream100">
            <Card className="cursor-pointer transition hover:border-amber-300 hover:bg-amber-50/30">
              <CardContent className="space-y-1 py-3">
                <Trophy className="h-5 w-5 text-amber-500" />
                <div className="text-sm font-semibold">⑤ 드림 100</div>
                <div className="text-[11px] text-slate-500">인플루언서·잡지·디자이너</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/marketing/campaigns">
            <Card className="cursor-pointer transition hover:border-blue-300 hover:bg-blue-50/30">
              <CardContent className="space-y-1 py-3">
                <Layers className="h-5 w-5 text-blue-500" />
                <div className="text-sm font-semibold">⑥ 캠페인 트래커</div>
                <div className="text-[11px] text-slate-500">시즌·이벤트·뉴스레터</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/marketing/library">
            <Card className="cursor-pointer transition hover:border-emerald-300 hover:bg-emerald-50/30">
              <CardContent className="space-y-1 py-3">
                <Library className="h-5 w-5 text-emerald-500" />
                <div className="text-sm font-semibold">⑦ 콘텐츠 라이브러리</div>
                <div className="text-[11px] text-slate-500">발행된 자산 갤러리</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/marketing/ai">
            <Card className="cursor-pointer transition hover:border-purple-300 hover:bg-purple-50/30">
              <CardContent className="space-y-1 py-3">
                <Wand2 className="h-5 w-5 text-purple-500" />
                <div className="text-sm font-semibold">⑧ AI 어시스턴트</div>
                <div className="text-[11px] text-slate-500">Hook·Story·Offer 자동 생성</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/marketing/newsletter">
            <Card className="cursor-pointer transition hover:border-emerald-300 hover:bg-emerald-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">⑨ 뉴스레터</div>
                <div className="text-[11px] text-slate-500">정기 발송 캠페인</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/marketing/brand-pdf">
            <Card className="cursor-pointer transition hover:border-slate-300 hover:bg-slate-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">⑩ 브랜드 가이드 PDF</div>
                <div className="text-[11px] text-slate-500">시각 정체성 인쇄용</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/finance/marketing/event-picker">
            <Card className="cursor-pointer transition hover:border-rose-300 hover:bg-rose-50/30">
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-semibold">⑪ 댓글 이벤트 추첨</div>
                <div className="text-[11px] text-slate-500">인스타 댓글 추첨·영상·DM</div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* 가이드 */}
      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 마케팅 시작 순서</CardTitle>
          <CardDescription className="text-xs">
            CLAUDE.md 10.3 미결정 항목 결정과 함께 채워나가세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="ml-4 list-decimal space-y-1 text-xs text-slate-700">
            <li>
              <strong>브랜드 정체성 작성</strong> (#10.3 #3) — 빅 아이디어·페르소나·시각 정체성 결정
            </li>
            <li>
              <strong>HSO 스크립트 1-2개 작성</strong> — 가장 자주 만나는 24셀부터 (예: 인테리어 프로젝트
              × 소파)
            </li>
            <li>
              <strong>채널별 첫 스냅샷 기록</strong> — 인스타·블로그 현재 팔로워·참여율
            </li>
            <li>
              <strong>콘텐츠 캘린더 채우기</strong> — 다음 2주치 인스타 발행 일정
            </li>
            <li>매주 채널 KPI 갱신 → 콘텐츠 효과 검증 → HSO 점수 업데이트</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
