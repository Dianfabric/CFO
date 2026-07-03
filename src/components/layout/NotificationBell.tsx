'use client'

/**
 * 알림 벨 — 색동 쇼핑몰 최근 3일 신규 주문·후기 (아임웹 실시간).
 *
 * - /api/saekdong/notifications 폴링(3분) + 열 때 갱신
 * - 안 읽은 알림 = time > lastSeen(localStorage) → 초록 배지
 * - 열면 모두 읽음 처리(lastSeen=now)
 * - 3일 지난 알림은 서버가 자동 제외 → 자연 삭제
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, ShoppingBag, Star, Loader2 } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface Notice {
  id: string
  kind: 'order' | 'review'
  time: number // Unix seconds
  amount?: number
  rating?: number
  text: string
}

const SEEN_KEY = 'saekdong_notice_seen' // localStorage: 마지막 확인 시각(ms)
const POLL_MS = 3 * 60 * 1000

function relTime(unixSec: number): string {
  const diff = Date.now() - unixSec * 1000
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function NotificationBell() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // 마운트 후 localStorage 하이드레이션 (SSR 불일치 방지)
  useEffect(() => {
    const v = Number(localStorage.getItem(SEEN_KEY) ?? 0)
    setLastSeen(Number.isFinite(v) ? v : 0)
    setHydrated(true)
  }, [])

  const fetchNotices = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/saekdong/notifications')
      const j = (await r.json()) as { notices?: Notice[] }
      setNotices(Array.isArray(j.notices) ? j.notices : [])
    } catch {
      // 조회 실패는 조용히 무시 (알림은 부가 기능)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotices()
    const t = setInterval(fetchNotices, POLL_MS)
    return () => clearInterval(t)
  }, [fetchNotices])

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const unread = hydrated
    ? notices.filter((n) => n.time * 1000 > lastSeen).length
    : 0

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      // 열면 모두 읽음 처리
      const now = Date.now()
      localStorage.setItem(SEEN_KEY, String(now))
      setLastSeen(now)
      fetchNotices()
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="알림"
        onClick={toggle}
        className="relative inline-flex h-8 w-8 items-center justify-center text-white/60 hover:text-white transition-colors"
        style={{ borderRadius: '2px' }}
      >
        <Bell className="w-4 h-4" strokeWidth={1.6} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 inline-flex items-center justify-center text-[10px] font-bold leading-none tabular-nums"
            style={{ backgroundColor: 'var(--nv-primary)', color: '#000', borderRadius: '9999px' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[300px] max-w-[calc(100vw-2rem)] bg-white shadow-lg z-50 overflow-hidden"
          style={{ border: '1px solid var(--nv-hairline)', borderRadius: '4px' }}
        >
          {/* 헤더 */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid var(--nv-hairline)' }}
          >
            <span className="text-[12px] font-bold" style={{ color: 'var(--nv-ink)' }}>
              색동 알림
            </span>
            <span className="text-[10px]" style={{ color: 'var(--nv-stone)' }}>
              최근 3일 · 신규 주문·후기
            </span>
          </div>

          {/* 목록 */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading && notices.length === 0 ? (
              <div
                className="px-3 py-6 text-center text-[12px]"
                style={{ color: 'var(--nv-mute)' }}
              >
                <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
                불러오는 중...
              </div>
            ) : notices.length === 0 ? (
              <div
                className="px-3 py-6 text-center text-[12px]"
                style={{ color: 'var(--nv-stone)' }}
              >
                새 알림이 없습니다.
              </div>
            ) : (
              <ul>
                {notices.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-start gap-2.5 px-3 py-2.5"
                    style={{ borderBottom: '1px solid var(--nv-hairline)' }}
                  >
                    <span
                      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center"
                      style={{
                        backgroundColor: 'var(--nv-surface-soft)',
                        borderRadius: '2px',
                        color:
                          n.kind === 'order' ? 'var(--nv-primary)' : 'var(--nv-warning, #d97706)',
                      }}
                    >
                      {n.kind === 'order' ? (
                        <ShoppingBag className="w-3.5 h-3.5" />
                      ) : (
                        <Star className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[12px] font-bold truncate"
                          style={{ color: 'var(--nv-ink)' }}
                        >
                          {n.kind === 'order'
                            ? `새 주문 ${formatKRW(n.amount ?? 0)}`
                            : `새 후기 ${'★'.repeat(n.rating ?? 0)}`}
                        </span>
                        <span
                          className="shrink-0 text-[10px] tabular-nums"
                          style={{ color: 'var(--nv-stone)' }}
                        >
                          {relTime(n.time)}
                        </span>
                      </div>
                      {/* 주문 = 품명·수량 (바로 준비용), 후기 = 본문 요약 */}
                      {n.text && (
                        <p
                          className="mt-0.5 text-[11px] line-clamp-2"
                          style={{
                            color: n.kind === 'order' ? 'var(--nv-ink)' : 'var(--nv-mute)',
                            fontWeight: n.kind === 'order' ? 600 : undefined,
                          }}
                          title={n.text}
                        >
                          {n.text}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 푸터 */}
          <div
            className="px-3 py-1.5 text-[10px] text-center"
            style={{ borderTop: '1px solid var(--nv-hairline)', color: 'var(--nv-stone)' }}
          >
            3일이 지난 알림은 자동으로 사라집니다.
          </div>
        </div>
      )}
    </div>
  )
}
