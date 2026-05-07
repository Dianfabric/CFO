/**
 * AI Create — 프리젠테이션 에이전트
 */
import { Presentation } from 'lucide-react'
import AgentPlaceholder from '@/components/v11/ai-create/AgentPlaceholder'

export const dynamic = 'force-dynamic'

export default function PresentationAgentPage() {
  return (
    <AgentPlaceholder
      agentName="프리젠테이션"
      headline={'슬라이드는\n결정의 기록입니다.'}
      tagline="회의·발표용 5~10장 슬라이드 + 영상 스크립트를 .pptx 로 즉시 생성합니다."
      icon={Presentation}
      inputs={[
        '발표 주제 + 핵심 메시지',
        '타겟 청중 (내부·외부·투자자)',
        '슬라이드 수 (5 / 7 / 10)',
        '심리 프레임워크 (8종 자동 추천)',
        '참고 데이터 / 그래프 (선택)',
      ]}
      outputs={[
        '디안 톤 슬라이드 (.pptx)',
        '티어별 자동 톤 분리 (luxury 검정 여백 / value 화이트 강조)',
        '15·30·60초 영상 스크립트',
        '발표자 노트 (대본)',
        '재생성 + 버전 히스토리',
      ]}
    />
  )
}
