/**
 * 디안 CFO KPI Card — Apple-style
 * 기준: docs/design-system/apple-spec.md
 * - 화이트 배경 + 1px hairline (Card 기본)
 * - 큰 숫자가 주연 (display weight 600 + tabular-nums)
 * - 톤은 텍스트 색만 미세하게 (Apple 단일 액센트 원칙 유지)
 * - 아이콘은 quiet, parchment surface 에 ink-muted-48
 */
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone?: 'default' | 'positive' | 'negative' | 'neutral'
}

export default function KPICard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: KPICardProps) {
  // Apple: 컬러로 강조 안 함 — 모든 톤은 ink. 부정 신호만 alert-red 도트로.
  const valueClass =
    tone === 'negative'
      ? 'text-foreground'
      : tone === 'positive'
        ? 'text-foreground'
        : tone === 'neutral'
          ? 'text-[var(--color-ink-muted-48)]'
          : 'text-foreground'

  return (
    <Card className="relative">
      {/* NVIDIA corner-square */}
      <span
        aria-hidden
        className="absolute top-0 left-0"
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: 'var(--nv-primary)',
        }}
      />
      <CardContent className="flex items-start justify-between gap-3 py-2 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#757575]">
            {label}
          </p>
          <p
            className={cn(
              'mt-2 truncate text-[28px] font-bold tabular-nums tracking-tight leading-none',
              valueClass,
            )}
          >
            {value}
          </p>
          {hint && (
            <p className="mt-2 text-[12px] text-[#757575] flex items-center gap-1.5">
              {tone === 'negative' && (
                <span className="inline-block h-1.5 w-1.5 bg-[#e52020]" />
              )}
              {tone === 'positive' && (
                <span className="inline-block h-1.5 w-1.5 bg-[#76b900]" />
              )}
              {hint}
            </p>
          )}
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#f7f7f7] border border-[#cccccc] text-[#1a1a1a]"
          style={{ borderRadius: '2px' }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </div>
      </CardContent>
    </Card>
  )
}
