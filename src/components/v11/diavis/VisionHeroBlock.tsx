/**
 * DIAVIS Hero 안의 비전 미니 블록 (서버 컴포넌트)
 *
 * /finance/cycle/vision 에서 입력한 long_term_vision 의
 * BHAG + 5년/3년 비전 1줄 + 핵심가치 칩을 검정 surface 톤으로 표시.
 *
 * 입력 안 됐거나 테이블 미적용이면 "비전 설정 →" 안내 1줄만 노출.
 */
import Link from 'next/link'
import { Target, ArrowRight, Mountain } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

interface VisionData {
  bhag: string | null
  five_year_vision: string | null
  three_year_vision: string | null
  three_year_milestones: string | null
  core_values: string | null
}

async function loadVision(): Promise<VisionData | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('long_term_vision')
      .select(
        'bhag, five_year_vision, three_year_vision, three_year_milestones, core_values',
      )
      .eq('id', 1)
      .maybeSingle<VisionData>()
    if (error) return null
    return data ?? null
  } catch {
    // 테이블 미적용 등 — 조용히 무시
    return null
  }
}

export default async function VisionHeroBlock() {
  const vision = await loadVision()
  const hasContent =
    vision &&
    (vision.bhag ||
      vision.five_year_vision ||
      vision.three_year_vision ||
      vision.three_year_milestones)

  // ====== 비어있는 경우 — 작은 안내 한 줄 ======
  if (!hasContent) {
    return (
      <div className="mt-12">
        <Link
          href="/finance/cycle/vision"
          className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] hover:gap-3 transition-all"
          style={{ color: 'var(--nv-on-dark-mute)' }}
        >
          <Target className="w-3.5 h-3.5" strokeWidth={2} />
          비전을 설정해 시스템의 모든 의사결정에 일관성을 만드세요
          <ArrowRight className="w-3 h-3" strokeWidth={2} />
        </Link>
      </div>
    )
  }

  // ====== 데이터 있을 때 ======
  const headline = vision.bhag ?? vision.five_year_vision ?? vision.three_year_vision
  const subline =
    vision.bhag && vision.five_year_vision
      ? vision.five_year_vision
      : vision.bhag && vision.three_year_vision
        ? vision.three_year_vision
        : vision.five_year_vision && vision.three_year_vision
          ? vision.three_year_vision
          : null

  // 핵심가치 — 줄바꿈 또는 콤마 분리, 최대 4개 표시
  const valueChips: string[] = vision.core_values
    ? vision.core_values
        .split(/[\n,·•·]+/)
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 4)
    : []

  return (
    <div
      className="mt-12 relative overflow-hidden"
      style={{
        backgroundColor: 'rgba(118, 185, 0, 0.06)',
        border: '1px solid rgba(118, 185, 0, 0.24)',
        borderRadius: '2px',
        padding: '24px 28px',
      }}
    >
      {/* 좌측 그린 라인 */}
      <span
        className="absolute left-0 top-0 bottom-0"
        style={{ width: '3px', backgroundColor: 'var(--nv-primary)' }}
      />

      {/* eyebrow */}
      <div className="flex items-center gap-2 mb-3">
        <Mountain
          className="w-3.5 h-3.5"
          strokeWidth={2}
          style={{ color: 'var(--nv-primary)' }}
        />
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: 'var(--nv-primary)' }}
        >
          {vision.bhag ? 'BHAG · 큰 그림' : '장기 비전'}
        </span>
      </div>

      {/* Headline (BHAG 또는 5년 비전) */}
      <p
        className="text-[18px] sm:text-[22px] font-bold tracking-tight leading-snug mb-2"
        style={{ color: 'var(--nv-on-dark)' }}
      >
        {headline}
      </p>

      {/* Subline (있으면) */}
      {subline && (
        <p
          className="text-[13px] leading-relaxed mb-3"
          style={{ color: 'var(--nv-on-dark-mute)' }}
        >
          {subline}
        </p>
      )}

      {/* 핵심가치 chips */}
      {valueChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {valueChips.map((v, i) => (
            <span
              key={i}
              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--nv-on-dark)',
                borderRadius: '2px',
              }}
            >
              {v}
            </span>
          ))}
        </div>
      )}

      {/* 자세히 링크 */}
      <Link
        href="/finance/cycle/vision"
        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] mt-4 hover:gap-2 transition-all"
        style={{ color: 'var(--nv-primary)' }}
      >
        비전 워크북
        <ArrowRight className="w-3 h-3" strokeWidth={2} />
      </Link>
    </div>
  )
}
