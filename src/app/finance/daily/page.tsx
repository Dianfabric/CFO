/**
 * 일일 운영 → 대시보드 통합 (V2.1.2)
 *
 * 사이드바 "일일 운영" 메뉴 클릭 시 `/dashboard` 로 자동 이동.
 * 일일 운영 콘텐츠는 `/dashboard/page.tsx` 에 통합됨.
 */
import { redirect } from 'next/navigation'

export default function DailyOpsRedirect() {
  redirect('/dashboard')
}
