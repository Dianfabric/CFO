/**
 * AI Create — 롱폼 에이전트
 */
import { Film } from 'lucide-react'
import AgentPlaceholder from '@/components/v11/ai-create/AgentPlaceholder'

export const dynamic = 'force-dynamic'

export default function LongformAgentPage() {
  return (
    <AgentPlaceholder
      agentName="롱폼"
      headline={'5분의 시간이\n10년의 신뢰가 됩니다.'}
      tagline="유튜브·브랜드 다큐멘터리용 5~10분 시나리오를 디안 톤으로 자동 작성합니다."
      icon={Film}
      inputs={[
        '주제 (브랜드 스토리 / 제품 / 인물)',
        '타겟 시청자',
        '영상 길이 (5 / 7 / 10분)',
        '구조 (인터뷰 / 다큐 / 튜토리얼)',
        '주요 인용·에피소드 (선택)',
      ]}
      outputs={[
        '인트로 / 본론 / 결론 구조 시나리오',
        '챕터 제목 5~7개',
        'B-roll 비주얼 가이드',
        '인터뷰 질문 리스트 (해당 시)',
        '썸네일 카피 + 영상 제목 5안',
      ]}
    />
  )
}
