/**
 * 일일 운영 메뉴 통합 (V2.4)
 *
 * "일일 운영" 메뉴는 "일일 결산" 안으로 통합됨.
 * 사이드바에서 메뉴 자체는 제거됐지만, 옛 URL 직접 접근 시
 * /settlement (일일 결산) 로 자동 이동.
 */
import { redirect } from 'next/navigation'

export default function DailyOpsRedirect() {
  redirect('/settlement')
}
