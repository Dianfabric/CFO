/**
 * 팀 공지 관리 (#8)
 */
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Sparkles, Megaphone, ChevronLeft, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AnnouncementForm from '@/components/v11/team/AnnouncementForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('team_announcements')
      .select(
        'id, title, body, importance, target_channel, include_in_daily, include_in_weekly, scheduled_date, expires_at, sent_at',
      )
      .order('scheduled_date', { ascending: false })
      .limit(50)
    return { rows: data ?? [], error: error?.message }
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export default async function AnnouncementsPage() {
  const { rows, error } = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/team"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        팀 공유 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #8 팀 공유
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Megaphone className="h-5 w-5 text-slate-500" />
          공지 관리
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          직원·임원·CEO 채널에 공유할 공지를 등록·관리합니다.
        </p>
      </div>

      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-xs text-slate-700">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
            <div className="space-y-1">
              <p>
                <strong>일일 포함</strong> 체크: 일일 디지스트 발송 시 자동으로 포함되어
                상단에 노출됩니다.
              </p>
              <p>
                <strong>주간 포함</strong> 체크: 주간 디지스트에 포함됩니다 (장기 공지에
                적합).
              </p>
              <p>
                <strong>긴급</strong> 표시는 메시지 상단에 🚨 아이콘으로 강조됩니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-200 bg-rose-50/30">
          <CardContent className="py-3 text-xs text-rose-700">
            ⚠ 데이터 로드 실패: {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">공지 목록</CardTitle>
          <CardDescription className="text-xs">
            최근 50건 — 슬랙 일일/주간 디지스트에 자동 노출
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementForm rows={rows} />
        </CardContent>
      </Card>
    </div>
  )
}
