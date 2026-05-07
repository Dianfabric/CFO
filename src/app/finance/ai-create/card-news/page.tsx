/**
 * AI Create — 카드뉴스 에이전트
 */
import { Newspaper } from 'lucide-react'
import AgentPlaceholder from '@/components/v11/ai-create/AgentPlaceholder'

export const dynamic = 'force-dynamic'

export default function CardNewsAgentPage() {
  return (
    <AgentPlaceholder
      agentName="카드뉴스"
      headline={'한 컷씩 넘기면\n메시지가 깊어집니다.'}
      tagline="인스타·블로그용 카드뉴스 5~10컷을 디안 시각 정체성으로 자동 생성합니다."
      icon={Newspaper}
      inputs={[
        '주제 + 핵심 메시지',
        '컷 수 (5 / 7 / 10)',
        '플랫폼 (Instagram / 블로그 / 카카오)',
        '톤 (정보 / 감성 / 트렌드)',
        '참고 이미지 (선택)',
      ]}
      outputs={[
        '컷별 카피 (제목 + 본문)',
        '컷별 비주얼 자리표시자 + 색감 가이드',
        '커버 컷 디안 톤 자동 적용',
        '해시태그 + 캡션 추천',
        '4티어별 톤 분리 (luxury / premium / mid / value)',
      ]}
    />
  )
}
