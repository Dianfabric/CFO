/**
 * AI Create — 쇼츠 에이전트
 */
import { Video } from 'lucide-react'
import AgentPlaceholder from '@/components/v11/ai-create/AgentPlaceholder'

export const dynamic = 'force-dynamic'

export default function ShortsAgentPage() {
  return (
    <AgentPlaceholder
      agentName="쇼츠"
      headline={'15초 안에\n시선을 잡습니다.'}
      tagline="제품·메시지를 입력하면 인스타·릴스·쇼츠용 영상 스크립트를 만들어드립니다."
      icon={Video}
      inputs={[
        '제품 또는 캠페인 주제',
        '타겟 (24셀·티어)',
        '톤 (감성 ↔ 정보, 친근 ↔ 격조)',
        '플랫폼 (Reels / Shorts / TikTok)',
        '레퍼런스 영상 (선택)',
      ]}
      outputs={[
        '15·30·60초 3종 스크립트',
        '컷별 시간·자막·비주얼 가이드',
        'BGM 무드 추천',
        '내레이션 텍스트',
        '썸네일 카피 3안',
      ]}
    />
  )
}
