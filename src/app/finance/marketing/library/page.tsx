/**
 * 콘텐츠 라이브러리 (Phase 3.5 #2b ⑦)
 *
 * 발행된 콘텐츠를 채널·연도·캠페인 필터로 모아보는 갤러리.
 * 효과 점수(좋아요·조회) 기준 정렬.
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  ChevronLeft,
  AtSign,
  FileText,
  Video,
  Mail,
  Image as ImageIcon,
  ExternalLink,
  Heart,
  Eye,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PublishedContent {
  id: number
  channel: string
  title: string
  publish_date: string | null
  url: string | null
  thumbnail_url: string | null
  views: number | null
  likes: number | null
  shares: number | null
  comments: number | null
  campaign_id: number | null
  hook: string | null
  marketing_campaigns: { name: string } | null
}

const CHANNEL_INFO: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  instagram: { label: '인스타그램', icon: AtSign, color: 'text-pink-500' },
  blog: { label: '블로그', icon: FileText, color: 'text-blue-500' },
  youtube: { label: '유튜브', icon: Video, color: 'text-red-500' },
  pinterest: { label: '핀터레스트', icon: ImageIcon, color: 'text-rose-500' },
  lookbook: { label: '룩북', icon: ImageIcon, color: 'text-amber-500' },
  newsletter: { label: '뉴스레터', icon: Mail, color: 'text-emerald-500' },
}

interface PageProps {
  searchParams: Promise<{ channel?: string; year?: string }>
}

async function loadData(channel?: string, year?: string) {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('content_items')
      .select('*, marketing_campaigns(name)')
      .eq('status', 'published')

    if (channel) query = query.eq('channel', channel)
    if (year) {
      query = query
        .gte('publish_date', `${year}-01-01`)
        .lte('publish_date', `${year}-12-31`)
    }

    const { data, error } = await query
      .order('likes', { ascending: false })
      .order('publish_date', { ascending: false, nullsFirst: false })
      .limit(200)

    return { items: ((data ?? []) as unknown) as PublishedContent[], error: error?.message ?? null }
  } catch (e) {
    return {
      items: [] as PublishedContent[],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function LibraryPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const { items, error } = await loadData(sp.channel, sp.year)

  const totalViews = items.reduce((s, it) => s + (it.views ?? 0), 0)
  const totalLikes = items.reduce((s, it) => s + (it.likes ?? 0), 0)
  const channelCounts = new Map<string, number>()
  for (const it of items) {
    channelCounts.set(it.channel, (channelCounts.get(it.channel) ?? 0) + 1)
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear].map(String)

  return (
    <div className="space-y-6">
      <Link
        href="/finance/marketing"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        마케팅 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2b ⑦ 콘텐츠 라이브러리
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">콘텐츠 라이브러리</h1>
        <p className="mt-1 text-sm text-slate-500">
          발행된 모든 콘텐츠를 한 곳에서 — 좋아요·조회 기준 정렬
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* KPI 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">발행 수</div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {items.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">총 조회</div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {totalViews.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-3">
            <div className="text-xs font-medium text-slate-500">총 좋아요</div>
            <div className="text-2xl font-bold tabular-nums text-pink-600">
              {totalLikes.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="space-y-2 py-3">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-slate-500">채널:</span>
            <FilterPill href="/finance/marketing/library" label="전체" active={!sp.channel} />
            {Object.keys(CHANNEL_INFO).map((ch) => (
              <FilterPill
                key={ch}
                href={`/finance/marketing/library?channel=${ch}${sp.year ? `&year=${sp.year}` : ''}`}
                label={`${CHANNEL_INFO[ch].label} (${channelCounts.get(ch) ?? 0})`}
                active={sp.channel === ch}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-slate-500">연도:</span>
            <FilterPill
              href={
                sp.channel ? `/finance/marketing/library?channel=${sp.channel}` : '/finance/marketing/library'
              }
              label="전체"
              active={!sp.year}
            />
            {yearOptions.map((y) => (
              <FilterPill
                key={y}
                href={`/finance/marketing/library?year=${y}${
                  sp.channel ? `&channel=${sp.channel}` : ''
                }`}
                label={y}
                active={sp.year === y}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 갤러리 */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              발행된 콘텐츠가 없습니다.{' '}
              <Link href="/finance/marketing/content" className="text-blue-600 hover:underline">
                콘텐츠 캘린더
              </Link>
              에서 상태를 &quot;발행됨&quot;으로 바꾸면 여기에 표시됩니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const ch = CHANNEL_INFO[it.channel]
            const Icon = ch?.icon ?? FileText
            return (
              <Card key={it.id} className="overflow-hidden">
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-start gap-2">
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ch?.color ?? 'text-slate-500')} />
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 font-semibold text-slate-800">
                        {it.title}
                      </h3>
                      {it.publish_date && (
                        <p className="text-[10px] text-slate-500">
                          {it.publish_date}
                          {it.marketing_campaigns?.name && (
                            <span className="ml-1 text-blue-600">
                              · {it.marketing_campaigns.name}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {it.hook && (
                    <p className="rounded bg-amber-50 px-2 py-1 text-[11px] italic text-amber-900 line-clamp-2">
                      🎣 {it.hook}
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t pt-2 text-[11px] text-slate-600">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-3 w-3" />
                        {(it.views ?? 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Heart className="h-3 w-3" />
                        {(it.likes ?? 0).toLocaleString()}
                      </span>
                    </div>
                    {it.url && (
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-blue-600 hover:underline"
                      >
                        보기 <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded px-2 py-1 text-[11px] transition',
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
      )}
    >
      {label}
    </Link>
  )
}
