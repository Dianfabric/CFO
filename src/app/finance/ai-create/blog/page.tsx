/**
 * AI Create — 블로그 에이전트
 */
import { PenTool } from 'lucide-react'
import AgentPlaceholder from '@/components/v11/ai-create/AgentPlaceholder'

export const dynamic = 'force-dynamic'

export default function BlogAgentPage() {
  return (
    <AgentPlaceholder
      agentName="블로그"
      headline={'검색에서 발견되고\n읽혀서 신뢰가 됩니다.'}
      tagline="SEO 최적화된 1500~3000자 블로그 글을 디안 톤으로 자동 작성합니다."
      icon={PenTool}
      inputs={[
        '주제 + 핵심 키워드 (SEO)',
        '타겟 독자 (디자이너 / 스튜디오 / 일반)',
        '글 길이 (1500 / 2500 / 3000자)',
        '목적 (정보 / 사례 / 인터뷰 / 가이드)',
        '참고 자료 / 인용 (선택, 해외 자료 포함)',
      ]}
      outputs={[
        'SEO 제목 5안 + 메타 디스크립션',
        'H2/H3 목차 자동 구성',
        '도입 → 본론 → 결론 본문',
        '내부 링크 추천 (디안 다른 콘텐츠)',
        '관련 해시태그·키워드 + 썸네일 카피',
      ]}
    />
  )
}
