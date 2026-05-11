/**
 * NVIDIA hero strip — 페이지 상단 검정 hero 띠
 *
 * 사용:
 *   <NvHeroStrip eyebrow="Daily" title="일일 운영." subtitle="오늘 ..." action={<Button .../>} />
 *
 * 페이지 상단의 main 패딩을 상쇄하기 위해 negative margin 으로 풀폭 확장.
 */
import type { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function NvHeroStrip({ eyebrow, title, subtitle, action }: Props) {
  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8 sm:-mt-10 lg:-mt-12 relative">
      {/* corner-square decorative motif */}
      <span
        aria-hidden
        className="absolute"
        style={{
          top: '12px',
          left: '12px',
          width: '10px',
          height: '10px',
          backgroundColor: 'var(--nv-primary)',
        }}
      />
      <div className="bg-black px-6 sm:px-10 py-6 sm:py-8 flex items-end justify-between flex-wrap gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2"
              style={{ color: 'var(--nv-primary)' }}
            >
              {eyebrow}
            </p>
          )}
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-white leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-[13px] sm:text-[14px] text-white/70 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
