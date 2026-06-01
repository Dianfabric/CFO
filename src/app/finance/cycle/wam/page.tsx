/**
 * WAM (Weekly Action Meeting) 회의용 페이지
 *
 * 매주 월요일 오전 8시 자동 생성된 회의 자료 표시.
 * 큰 화면 한 페이지 모드 — 회의실 화면에 띄우기 좋게.
 *
 * - 사이클 비전 + 이번 주 W{n} 헤더
 * - 지난 주 요약 (AI 한 줄 + 직원별 실행률 + WAM 점수)
 * - AI 분석 (잘된 점 / 우려 / 이번 주 권장)
 * - 직원별 다음 주 추천 액션
 * - 이번 주 회사 전체 메시지
 * - 수동 재생성 버튼
 */
import Link from 'next/link'
import { ChevronLeft, Sparkles } from 'lucide-react'
import WamMeetingView from '@/components/v11/cycle/WamMeetingView'

export const dynamic = 'force-dynamic'

export default function WamPage() {
  return (
    <div className="space-y-4">
      <Link
        href="/finance/cycle"
        className="inline-flex items-center gap-1.5 text-[12px] text-[#666] hover:text-[#000]"
      >
        <ChevronLeft className="w-3 h-3" />
        12주 대시보드
      </Link>
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-[#f59e0b]" />
        <h1 className="text-[20px] font-bold tracking-tight text-[#000]">
          WAM — 주간 회의 (AI 자동 생성)
        </h1>
      </div>
      <WamMeetingView />
    </div>
  )
}
