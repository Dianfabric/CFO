import type { Metadata } from 'next'
import Hiem2026Planner from '@/components/exhibition/Hiem2026Planner'

export const metadata: Metadata = {
  title: '2026 상하이 INTERTEXTILE | DIAVIS',
  description: '2026 상하이 INTERTEXTILE 부스 탐색과 현장 미팅 기록',
}

export default function Hiem2026ExhibitionPage() {
  return <Hiem2026Planner />
}
