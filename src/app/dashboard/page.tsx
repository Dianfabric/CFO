/**
 * v1.0 경영 대시보드 — NVIDIA hero strip + DashboardContent
 *
 * 콘텐츠 본체는 DashboardContent 클라이언트 컴포넌트로 분리되어
 * `/` (DIAVIS 홈) 페이지에서도 재사용됨.
 */
import DashboardContent from '@/components/v11/diavis/DashboardContent'
import NvHeroStrip from '@/components/v11/nvidia/NvHeroStrip'

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <NvHeroStrip
        eyebrow="CFO Cockpit"
        title="경영 대시보드."
        subtitle="실시간 경영 현황을 한눈에 확인하세요."
      />
      <DashboardContent showRefresh />
    </div>
  )
}
