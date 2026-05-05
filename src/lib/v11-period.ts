/**
 * 기간 계산 유틸 (매출 인수분해 페이지 등에서 공용)
 */

export type Period = 'this_month' | 'last_month' | '90d' | 'ytd'

export interface PeriodRange {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD inclusive
  label: string
  // 비교 기준이 되는 직전 동일 길이 구간
  prevStart: string
  prevEnd: string
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function isValidPeriod(p: string | undefined | null): p is Period {
  return p === 'this_month' || p === 'last_month' || p === '90d' || p === 'ytd'
}

export function resolvePeriod(period: Period, now: Date = new Date()): PeriodRange {
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (period) {
    case 'this_month': {
      const start = new Date(y, m, 1)
      const end = new Date(y, m + 1, 0)
      const prevStart = new Date(y, m - 1, 1)
      const prevEnd = new Date(y, m, 0)
      return {
        start: toDateStr(start),
        end: toDateStr(end),
        label: `${y}년 ${m + 1}월`,
        prevStart: toDateStr(prevStart),
        prevEnd: toDateStr(prevEnd),
      }
    }
    case 'last_month': {
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0)
      const prevStart = new Date(y, m - 2, 1)
      const prevEnd = new Date(y, m - 1, 0)
      return {
        start: toDateStr(start),
        end: toDateStr(end),
        label: `${start.getFullYear()}년 ${start.getMonth() + 1}월`,
        prevStart: toDateStr(prevStart),
        prevEnd: toDateStr(prevEnd),
      }
    }
    case '90d': {
      const end = new Date(now)
      const start = new Date(now)
      start.setDate(start.getDate() - 89)
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - 89)
      return {
        start: toDateStr(start),
        end: toDateStr(end),
        label: '최근 90일',
        prevStart: toDateStr(prevStart),
        prevEnd: toDateStr(prevEnd),
      }
    }
    case 'ytd': {
      const start = new Date(y, 0, 1)
      const end = new Date(now)
      // 작년 같은 기간을 비교 기준으로
      const prevStart = new Date(y - 1, 0, 1)
      const prevEnd = new Date(y - 1, end.getMonth(), end.getDate())
      return {
        start: toDateStr(start),
        end: toDateStr(end),
        label: `${y}년 누적`,
        prevStart: toDateStr(prevStart),
        prevEnd: toDateStr(prevEnd),
      }
    }
  }
}

/** 증감률 계산 (%, 소수점 1자리). 이전 값이 0이면 null. */
export function pctChange(current: number, prev: number): number | null {
  if (!prev || prev === 0) return null
  return ((current - prev) / prev) * 100
}
