/**
 * 12주 사이클 건의사항 목록
 *
 * - 직원들이 매주 작성한 건의사항을 한 페이지에 모아 보기
 * - 미해결(open) / 해결됨(resolved) 토글 필터
 * - 해결 처리 + 미해결로 되돌리기 + 메모 입력
 * - 사이클 진행 중·종료 후에 "이러이러한 건의가 있었고 어떻게 해결됐다"의 기록
 */
import Link from 'next/link'
import { ChevronLeft, MessageSquare } from 'lucide-react'
import SuggestionsBoard from '@/components/v11/cycle/SuggestionsBoard'

export const dynamic = 'force-dynamic'

export default function SuggestionsPage() {
  return (
    <div className="space-y-4">
      <Link
        href="/finance/cycle"
        className="inline-flex items-center gap-1.5 text-[12px]"
        style={{ color: 'var(--nv-mute)' }}
      >
        <ChevronLeft className="w-3 h-3" />
        12주 대시보드
      </Link>
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5" style={{ color: 'var(--nv-warning)' }} />
        <h1 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--nv-ink)' }}>
          건의사항 목록 — 12주 회사 차원
        </h1>
      </div>
      <p className="text-[12px]" style={{ color: 'var(--nv-mute)' }}>
        직원들이 매주 작성한 건의·개선 사항을 한 곳에 모아 봅니다. 해결된 항목은 사이클 종료 후 회고
        자료로 활용됩니다.
      </p>
      <SuggestionsBoard />
    </div>
  )
}
