/**
 * 12주 사이클 유틸 (PRD #1)
 */

export interface CycleProgress {
  weekNumber: number // 1..12 (현재 주차)
  weekProgress: number // 0..1 (이번 주 안에서의 진행)
  totalProgress: number // 0..1 (사이클 전체 진행)
  daysRemaining: number
  daysSinceStart: number
  isComplete: boolean
}

/** start_date~end_date 사이의 현재 진행 상황 계산 */
export function calculateCycleProgress(
  startDate: string,
  endDate: string,
  now: Date = new Date(),
): CycleProgress {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T23:59:59')

  const totalMs = end.getTime() - start.getTime()
  const elapsedMs = Math.max(0, now.getTime() - start.getTime())
  const totalProgress = Math.min(1, elapsedMs / totalMs)

  const daysSinceStart = Math.max(
    0,
    Math.floor(elapsedMs / (1000 * 60 * 60 * 24)),
  )
  const daysRemaining = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  )

  // 1주차 = days 0~6, 2주차 = 7~13, ... 12주차 = 77~83
  const weekNumber = Math.min(12, Math.floor(daysSinceStart / 7) + 1)
  const weekProgress = (daysSinceStart % 7) / 7

  return {
    weekNumber,
    weekProgress,
    totalProgress,
    daysRemaining,
    daysSinceStart,
    isComplete: now > end,
  }
}

/** 다음 월요일까지 남은 일수 (WAM 카운트다운용) */
export function daysUntilNextMonday(now: Date = new Date()): number {
  const dow = now.getDay() // 0=Sun, 1=Mon
  if (dow === 1) {
    // 오늘이 월요일이면 0 또는 7?
    // 오늘 안에 WAM 진행 가능하므로 0 반환
    return 0
  }
  return (8 - dow) % 7 || 7
}
