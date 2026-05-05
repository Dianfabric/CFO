/**
 * 채널 KPI 대시보드 (Phase 3 #2b ③)
 */
import Link from 'next/link'
import { Sparkles, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ChannelKPI, {
  type GrowthRow,
  type SnapshotRow,
} from '@/components/v11/marketing/ChannelKPI'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const [growthRes, snapshotsRes] = await Promise.all([
      supabase.from('channel_growth').select('*').order('current_followers', { ascending: false }),
      supabase
        .from('channel_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(100),
    ])
    return {
      growth: (growthRes.data ?? []) as GrowthRow[],
      snapshots: (snapshotsRes.data ?? []) as SnapshotRow[],
      errors: [growthRes.error, snapshotsRes.error].filter(Boolean) as Array<{ message: string }>,
    }
  } catch (e) {
    return {
      growth: [] as GrowthRow[],
      snapshots: [] as SnapshotRow[],
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    }
  }
}

export default async function ChannelsPage() {
  const data = await loadData()

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
            v1.1 · #2b ③ 채널 KPI
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">채널 KPI 대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          인스타·블로그·유튜브·핀터레스트·뉴스레터 — 주간/월간 스냅샷 기록
        </p>
      </div>

      {data.errors.length > 0 && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {data.errors[0].message} — v11.2_marketing.sql 적용 필요
        </div>
      )}

      <ChannelKPI growth={data.growth} snapshots={data.snapshots} />
    </div>
  )
}
