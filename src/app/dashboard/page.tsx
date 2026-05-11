/**
 * 경영 대시보드 = 일일 운영 블록
 * 콘텐츠는 DailyOpsBlock 컴포넌트로 분리 — / 메인에서도 재사용.
 */
import DailyOpsBlock from '@/components/v11/diavis/DailyOpsBlock'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function DashboardPage() {
  return <DailyOpsBlock />
}
