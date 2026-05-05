'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2, X, ArrowUp, ArrowDown } from 'lucide-react'
import { upsertChannelSnapshot } from '@/app/finance/marketing/actions'
import { cn } from '@/lib/utils'

const CHANNELS = ['instagram', 'blog', 'youtube', 'pinterest', 'newsletter']

export interface SnapshotRow {
  id: number
  channel: string
  snapshot_date: string
  followers: number | null
  posts_count: number | null
  reach: number | null
  engagement_rate: number | null
  inquiries_count: number | null
}

export interface GrowthRow {
  channel: string
  latest_date: string
  current_followers: number | null
  prev_followers: number | null
  followers_delta: number | null
  posts_count: number | null
  reach: number | null
  engagement_rate: number | null
  inquiries_count: number | null
}

export default function ChannelKPI({
  growth,
  snapshots,
}: {
  growth: GrowthRow[]
  snapshots: SnapshotRow[]
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          스냅샷 기록
        </Button>
      </div>

      {adding && <SnapshotForm onClose={() => setAdding(false)} />}

      {/* 채널별 현재 상태 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {growth.length === 0 ? (
          <p className="col-span-3 py-4 text-center text-sm text-slate-400">
            아직 스냅샷이 없습니다 — 위 버튼으로 첫 기록 추가하세요
          </p>
        ) : (
          growth.map((g) => {
            const delta = Number(g.followers_delta ?? 0)
            const isUp = delta >= 0
            return (
              <Card key={g.channel}>
                <CardHeader>
                  <CardTitle className="text-sm capitalize">{g.channel}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div>
                    <div className="text-slate-500">팔로워</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold tabular-nums text-slate-900">
                        {(g.current_followers ?? 0).toLocaleString()}
                      </span>
                      {g.prev_followers != null && (
                        <span
                          className={cn(
                            'flex items-center text-xs font-semibold',
                            isUp ? 'text-emerald-600' : 'text-rose-600',
                          )}
                        >
                          {isUp ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )}
                          {Math.abs(delta)}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      마지막 기록: {g.latest_date}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t pt-2">
                    <div>
                      <div className="text-[10px] text-slate-400">발행 콘텐츠</div>
                      <div className="font-semibold tabular-nums">
                        {g.posts_count ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">도달</div>
                      <div className="font-semibold tabular-nums">
                        {(g.reach ?? 0).toLocaleString()}
                      </div>
                    </div>
                    {g.engagement_rate != null && (
                      <div>
                        <div className="text-[10px] text-slate-400">참여율</div>
                        <div className="font-semibold tabular-nums">
                          {Number(g.engagement_rate).toFixed(2)}%
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] text-slate-400">문의 발생</div>
                      <div className="font-semibold tabular-nums text-emerald-700">
                        {g.inquiries_count ?? 0}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* 스냅샷 이력 */}
      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">스냅샷 이력 (최근 50건)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="px-3 py-2 text-left">날짜</th>
                    <th className="px-3 py-2 text-left">채널</th>
                    <th className="px-3 py-2 text-right">팔로워</th>
                    <th className="px-3 py-2 text-right">발행</th>
                    <th className="px-3 py-2 text-right">도달</th>
                    <th className="px-3 py-2 text-right">참여율</th>
                    <th className="px-3 py-2 text-right">문의</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.slice(0, 50).map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-1.5 text-slate-600">{s.snapshot_date}</td>
                      <td className="px-3 py-1.5 capitalize font-medium text-slate-700">
                        {s.channel}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {(s.followers ?? 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {s.posts_count ?? 0}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {(s.reach ?? 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {s.engagement_rate
                          ? `${Number(s.engagement_rate).toFixed(2)}%`
                          : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">
                        {s.inquiries_count ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SnapshotForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const [channel, setChannel] = useState('instagram')
  const [date, setDate] = useState(today)
  const [followers, setFollowers] = useState('')
  const [posts, setPosts] = useState('')
  const [reach, setReach] = useState('')
  const [engagement, setEngagement] = useState('')
  const [inquiries, setInquiries] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await upsertChannelSnapshot({
        channel,
        snapshot_date: date,
        followers: followers ? parseInt(followers) : null,
        posts_count: posts ? parseInt(posts) : null,
        reach: reach ? parseInt(reach) : null,
        engagement_rate: engagement ? Number(engagement) : null,
        inquiries_count: inquiries ? parseInt(inquiries) : null,
      })
      if (!res.ok) {
        setError(res.error ?? '저장 실패')
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">새 채널 스냅샷</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>채널</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v ?? 'instagram')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>날짜</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>팔로워</Label>
              <Input
                type="number"
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>발행 수</Label>
              <Input
                type="number"
                value={posts}
                onChange={(e) => setPosts(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>도달 수</Label>
              <Input
                type="number"
                value={reach}
                onChange={(e) => setReach(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>참여율 (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={engagement}
                onChange={(e) => setEngagement(e.target.value)}
                placeholder="예: 3.50"
              />
            </div>
            <div className="space-y-1.5">
              <Label>문의 발생 수</Label>
              <Input
                type="number"
                value={inquiries}
                onChange={(e) => setInquiries(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                '저장'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
